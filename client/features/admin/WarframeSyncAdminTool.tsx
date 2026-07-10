import { useCallback, useEffect, useRef, useState } from 'react';

import type { WarframeSyncResult as SyncResult } from '../../../shared/warframeTypes.js';
import { apiFetch } from '../../utils/api';

type WarframeSyncAdminToolProps = {
  onSyncComplete?: (result: SyncResult) => void | Promise<void>;
};

export function WarframeSyncAdminTool({ onSyncComplete }: WarframeSyncAdminToolProps) {
  const [runningSync, setRunningSync] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<SyncResult | null>(null);
  const mountedRef = useRef(true);
  const syncAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      syncAbortRef.current?.abort();
    };
  }, []);

  const handleSync = useCallback(async (): Promise<void> => {
    syncAbortRef.current?.abort();
    const controller = new AbortController();
    syncAbortRef.current = controller;
    setRunningSync(true);
    setError(null);
    try {
      const response = await apiFetch('/api/warframe/admin/sync-source', {
        method: 'POST',
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | SyncResult
        | { error?: string; runId?: number; pollUrl?: string }
        | null;
      if (!response.ok || (body && 'error' in body && body.error)) {
        throw new Error((body && 'error' in body && body.error) || 'Failed to run sync');
      }

      let result: SyncResult | null = null;
      if (response.status === 202 && body && 'runId' in body && typeof body.runId === 'number') {
        const pollUrl =
          typeof body.pollUrl === 'string'
            ? body.pollUrl
            : `/api/warframe/admin/sync/runs/${body.runId}`;
        const deadline = Date.now() + 30 * 60 * 1000;
        while (Date.now() < deadline) {
          if (controller.signal.aborted || !mountedRef.current) return;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const pollRes = await apiFetch(pollUrl, { signal: controller.signal });
          const pollBody = (await pollRes.json().catch(() => null)) as {
            status?: string;
            summary?: SyncResult | null;
            error?: string | null;
          } | null;
          if (!pollRes.ok || !pollBody) throw new Error('Failed to poll sync status');
          if (pollBody.status === 'failed') throw new Error(pollBody.error || 'Sync failed');
          if (pollBody.status === 'succeeded' && pollBody.summary) {
            result = pollBody.summary;
            break;
          }
        }
        if (!result) throw new Error('Sync timed out while waiting for completion');
      } else {
        result = body as SyncResult;
      }

      if (controller.signal.aborted || !mountedRef.current) return;
      setLastReport(result);
      await onSyncComplete?.(result);
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to run sync');
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setRunningSync(false);
      }
    }
  }, [onSyncComplete]);

  return (
    <div className="glass-surface space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sync from Armory</h2>
          <p className="text-muted mt-1 text-sm">
            Reconcile Warframe worksheet rows and market links against Armory&apos;s catalog
            database.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void handleSync()}
          disabled={runningSync}
        >
          {runningSync ? 'Syncing…' : 'Run sync'}
        </button>
      </div>
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {lastReport ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Added</dt>
          <dd className="font-mono tabular-nums">{lastReport.summary.added}</dd>
          <dt className="text-muted">Deleted</dt>
          <dd className="font-mono tabular-nums">{lastReport.summary.deleted}</dd>
          <dt className="text-muted">Unavailable</dt>
          <dd className="font-mono tabular-nums">{lastReport.summary.markedUnavailable}</dd>
          <dt className="text-muted">Mismatched</dt>
          <dd className="font-mono tabular-nums">{lastReport.summary.mismatched}</dd>
        </dl>
      ) : (
        <p className="text-muted text-sm">No sync has been run this session yet.</p>
      )}
    </div>
  );
}

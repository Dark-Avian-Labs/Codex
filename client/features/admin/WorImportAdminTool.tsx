import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '../../utils/api';

type ImportSnapshot = {
  running: boolean;
  lines: { ts: string; level: string; message: string }[];
  summary: {
    heroes: number;
    artifacts: number;
    demons: number;
    missingPortraits?: string[];
    missingStarAssets?: string[];
  } | null;
  error: string | null;
};

function parseSnapshot(body: unknown): ImportSnapshot | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as { snapshot?: ImportSnapshot } & ImportSnapshot;
  return record.snapshot ?? record;
}

export function WorImportAdminTool() {
  const [snapshot, setSnapshot] = useState<ImportSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [forceImport, setForceImport] = useState(false);
  const [forceImages, setForceImages] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const applySnapshot = useCallback((next: ImportSnapshot) => {
    setSnapshot(next);
    if (next.running) {
      setError((previous) => (previous?.includes('already running') ? previous : null));
    }
  }, []);

  const loadStatus = useCallback(async () => {
    const response = await apiFetch('/api/wor/admin/import/status');
    if (!response.ok) throw new Error('Failed to load import status');
    const body = parseSnapshot(await response.json());
    if (!body) throw new Error('Failed to parse import status');
    applySnapshot(body);
  }, [applySnapshot]);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        await loadStatus();
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Failed to load status');
        }
      }
    })();

    const stream = new EventSource('/api/wor/admin/import/stream', { withCredentials: true });
    stream.addEventListener('snapshot', (event) => {
      if (disposed) return;
      try {
        const next = parseSnapshot(JSON.parse((event as MessageEvent).data));
        if (next) applySnapshot(next);
      } catch {
        // ignore malformed events
      }
    });
    stream.onerror = () => {
      if (disposed) return;
      setError((previous) =>
        previous?.includes('already running')
          ? previous
          : 'Live import log disconnected. Polling will keep updating while a job runs.',
      );
    };

    return () => {
      disposed = true;
      stream.close();
    };
  }, [applySnapshot, loadStatus]);

  useEffect(() => {
    if (!snapshot?.running) return undefined;

    const poll = window.setInterval(() => {
      void loadStatus().catch(() => {
        // ignore transient poll errors
      });
    }, 2000);

    return () => window.clearInterval(poll);
  }, [loadStatus, snapshot?.running]);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [snapshot?.lines.length, snapshot?.running]);

  const startImport = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await apiFetch('/api/wor/admin/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceImport, forceImages }),
      });
      const body = (await response.json().catch(() => null)) as
        | ({ error?: string; snapshot?: ImportSnapshot } & ImportSnapshot)
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to start import');
      }
      const next = parseSnapshot(body);
      if (next) applySnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import');
    } finally {
      setStarting(false);
    }
  }, [applySnapshot, forceImages, forceImport]);

  const lines = snapshot?.lines ?? [];

  return (
    <div className="glass-surface space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Catalog import</h2>
          <p className="text-muted mt-1 text-sm">
            Scrape Fastidious.gg metadata, download Fandom portraits (with Fastidious card
            fallback), and sync class/faction icons into the local image cache.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void startImport()}
          disabled={starting || snapshot?.running}
        >
          {snapshot?.running ? 'Importing…' : starting ? 'Starting…' : 'Run import'}
        </button>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={forceImport}
            onChange={(event) => setForceImport(event.target.checked)}
          />
          Force catalog refresh
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={forceImages}
            onChange={(event) => setForceImages(event.target.checked)}
          />
          Force image re-download
        </label>
      </div>
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {snapshot?.summary ? (
        <div className="space-y-1 text-sm">
          <p>
            Catalog: {snapshot.summary.heroes} heroes, {snapshot.summary.artifacts} artifacts,{' '}
            {snapshot.summary.demons} demons.
          </p>
          {snapshot.summary.missingPortraits && snapshot.summary.missingPortraits.length > 0 ? (
            <p className="text-muted">
              Missing portraits: {snapshot.summary.missingPortraits.length} (see log).
            </p>
          ) : null}
          {snapshot.summary.missingStarAssets && snapshot.summary.missingStarAssets.length > 0 ? (
            <p className="text-muted">
              Missing star UI assets: {snapshot.summary.missingStarAssets.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
      {snapshot?.error ? (
        <p className="text-danger text-sm" role="alert">
          {snapshot.error}
        </p>
      ) : null}
      <div
        ref={logContainerRef}
        className="max-h-48 overflow-y-auto rounded-lg border border-[var(--color-glass-border)] bg-black/20 p-3 font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-muted">Import log will appear here.</p>
        ) : (
          lines.slice(-80).map((line, index) => (
            <div
              key={`${line.ts}-${index}`}
              className={line.level === 'error' ? 'text-danger' : ''}
            >
              [{line.ts}] {line.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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

export function WorImportAdminTool() {
  const [snapshot, setSnapshot] = useState<ImportSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [forceImport, setForceImport] = useState(false);
  const [forceImages, setForceImages] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadStatus = useCallback(async () => {
    const response = await apiFetch('/api/wor/admin/import/status');
    if (!response.ok) throw new Error('Failed to load import status');
    const body = (await response.json()) as ImportSnapshot;
    setSnapshot(body);
  }, []);

  useEffect(() => {
    void loadStatus().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    });
  }, [loadStatus]);

  useEffect(() => {
    eventSourceRef.current?.close();
    const source = new EventSource('/api/wor/admin/import/stream', { withCredentials: true });
    eventSourceRef.current = source;
    source.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as ImportSnapshot);
      } catch {
        // ignore malformed events
      }
    };
    return () => source.close();
  }, []);

  const startImport = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await apiFetch('/api/wor/admin/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceImport, forceImages }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to start import');
      }
      setSnapshot((await response.json()) as ImportSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import');
    } finally {
      setStarting(false);
    }
  }, [forceImages, forceImport]);

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
      <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--color-glass-border)] bg-black/20 p-3 font-mono text-xs leading-relaxed">
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

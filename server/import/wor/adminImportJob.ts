import { getWorDb } from '@codex/game-wor';
import type Database from 'better-sqlite3';

import {
  runWorStartupPipeline,
  type WorImportLogLine,
  type WorImportSummary,
} from './startupPipeline.js';

export type WorAdminImportSnapshot = {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lines: WorImportLogLine[];
  summary: WorImportSummary | null;
  error: string | null;
};

type SnapshotListener = (snapshot: WorAdminImportSnapshot) => void;

const MAX_LINES = 2000;
const listeners = new Set<SnapshotListener>();

let state: WorAdminImportSnapshot = {
  runId: 0,
  running: false,
  startedAt: null,
  finishedAt: null,
  lines: [],
  summary: null,
  error: null,
};

let activeJobPromise: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function notify(): void {
  const snapshot = { ...state, lines: [...state.lines] };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function pushLine(level: WorImportLogLine['level'], message: string): void {
  state.lines.push({ ts: nowIso(), level, message });
  if (state.lines.length > MAX_LINES) {
    state.lines.splice(0, state.lines.length - MAX_LINES);
  }
  notify();
}

export function getWorAdminImportSnapshot(): WorAdminImportSnapshot {
  return { ...state, lines: [...state.lines] };
}

export function subscribeWorAdminImport(listener: SnapshotListener): () => void {
  listeners.add(listener);
  listener(getWorAdminImportSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function isWorImportRunning(): boolean {
  return state.running;
}

export async function startWorAdminImport(options?: {
  forceImport?: boolean;
}): Promise<{ started: boolean; reason?: string }> {
  if (state.running || activeJobPromise) {
    return { started: false, reason: 'Import already running' };
  }

  const db = getWorDb() as Database.Database;
  const runId = Number(
    db.prepare(`INSERT INTO import_runs (status) VALUES ('running')`).run().lastInsertRowid,
  );

  state = {
    runId,
    running: true,
    startedAt: nowIso(),
    finishedAt: null,
    lines: [],
    summary: null,
    error: null,
  };
  notify();

  activeJobPromise = (async () => {
    try {
      pushLine('info', 'Starting Watcher of Realms catalog import…');
      const summary = await runWorStartupPipeline({
        forceImport: options?.forceImport,
        onLog: (line) => pushLine(line.level, line.message),
      });
      state.summary = summary;
      state.finishedAt = nowIso();
      state.running = false;
      db.prepare(
        `UPDATE import_runs SET status = 'succeeded', finished_at = datetime('now'), steps_json = ? WHERE id = ?`,
      ).run(JSON.stringify({ lines: state.lines, summary }), runId);
      pushLine('info', 'Import finished successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.error = message;
      state.finishedAt = nowIso();
      state.running = false;
      db.prepare(
        `UPDATE import_runs SET status = 'failed', finished_at = datetime('now'), error = ?, steps_json = ? WHERE id = ?`,
      ).run(message, JSON.stringify({ lines: state.lines }), runId);
      pushLine('error', message);
    } finally {
      activeJobPromise = null;
      notify();
    }
  })();

  await activeJobPromise;
  return { started: true };
}

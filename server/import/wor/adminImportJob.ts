import { getWorDb } from '@codex/game-wor';
import type Database from 'better-sqlite3';

import {
  isWorImportLeaseHeld,
  releaseWorImportLease,
  tryAcquireWorImportLease,
} from './importLease.js';
import {
  runWorStartupPipeline,
  type WorImportLogLine,
  type WorImportSummary,
} from './startupPipeline.js';
import type { WorPipelineStepKey } from './worPipelineSteps.js';
import { WOR_PIPELINE_STEPS } from './worPipelineSteps.js';

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
let activeLockToken: string | null = null;

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
  if (state.running) return true;
  try {
    return isWorImportLeaseHeld(getWorDb() as Database.Database);
  } catch {
    return false;
  }
}

function parseForceSteps(forceSteps: string[] | undefined): WorPipelineStepKey[] | undefined {
  if (!forceSteps?.length) return undefined;
  const allowed = new Set<string>(WOR_PIPELINE_STEPS);
  const parsed = forceSteps.filter((step): step is WorPipelineStepKey => allowed.has(step));
  return parsed.length > 0 ? parsed : undefined;
}

export function startWorAdminImport(options?: {
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: string[];
}): { started: boolean; reason?: string; snapshot: WorAdminImportSnapshot } {
  if (state.running || activeJobPromise) {
    return {
      started: false,
      reason: 'Import already running',
      snapshot: getWorAdminImportSnapshot(),
    };
  }

  const db = getWorDb() as Database.Database;
  if (isWorImportLeaseHeld(db)) {
    return {
      started: false,
      reason: 'Import lease held by another process',
      snapshot: getWorAdminImportSnapshot(),
    };
  }

  const runId = Number(
    db.prepare(`INSERT INTO import_runs (status) VALUES ('running')`).run().lastInsertRowid,
  );
  const lockToken = tryAcquireWorImportLease(db, runId);
  if (!lockToken) {
    db.prepare(
      `UPDATE import_runs SET status = 'failed', finished_at = datetime('now'), error = ? WHERE id = ?`,
    ).run('Failed to acquire import lease', runId);
    return {
      started: false,
      reason: 'Import lease held by another process',
      snapshot: getWorAdminImportSnapshot(),
    };
  }
  activeLockToken = lockToken;

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
        forceImages: options?.forceImages,
        forceSteps: parseForceSteps(options?.forceSteps),
        onLog: (line) => pushLine(line.level, line.message),
        importLockToken: lockToken,
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
      if (activeLockToken) {
        releaseWorImportLease(db, activeLockToken);
        activeLockToken = null;
      }
      activeJobPromise = null;
      notify();
    }
  })();

  return { started: true, snapshot: getWorAdminImportSnapshot() };
}

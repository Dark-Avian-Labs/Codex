import { createHash, randomUUID } from 'node:crypto';

import type Database from 'better-sqlite3';

import { normalizeStartupPipelineSummary } from '../../../shared/warframeImport/pipelineSummary.js';
import { getCatalogDb } from './db/connection.js';
import type { StartupPipelineSummary } from './pipelineSummary.js';

export type ImportRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export type ImportLogLine = {
  ts: string;
  level: 'info' | 'error';
  message: string;
};

export type ImportRunSteps = {
  lines: ImportLogLine[];
  summary: StartupPipelineSummary | null;
};

export type ImportRunRow = {
  id: number;
  status: ImportRunStatus;
  actor_hash: string;
  started_at: string;
  finished_at: string | null;
  steps_json: string | null;
  error_text: string | null;
  lock_token: string | null;
};

export type ImportRunResponse = {
  id: number;
  status: ImportRunStatus;
  actorHash: string;
  actorMasked: string;
  startedAt: string;
  finishedAt: string | null;
  steps: ImportRunSteps;
  error: string | null;
};

const LEASE_ROW_ID = 1;
let schemaReady = false;

export class ImportAlreadyRunningError extends Error {
  constructor(message = 'An import job is already running.') {
    super(message);
    this.name = 'ImportAlreadyRunningError';
  }
}

export class ImportLeaseLostError extends Error {
  constructor(message = 'Import lease was lost; catalog writes aborted.') {
    super(message);
    this.name = 'ImportLeaseLostError';
  }
}

export type ImportLeaseWatch = { lost: boolean };

export function ensureImportRunsSchema(db: Database.Database = getCatalogDb()): void {
  if (schemaReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      actor_hash TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      steps_json TEXT,
      error_text TEXT,
      lock_token TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_import_runs_status ON import_runs(status);
    CREATE TABLE IF NOT EXISTS import_lease (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lock_token TEXT,
      run_id INTEGER,
      acquired_at TEXT
    );
  `);
  schemaReady = true;
}

export function hashActor(clerkUserId: string): string {
  return createHash('sha256').update(clerkUserId).digest('hex');
}

export function maskClerkUserId(clerkUserId: string): string {
  const trimmed = clerkUserId.trim();
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}

export function actorMaskedFromHash(actorHash: string): string {
  if (actorHash.length <= 4) return '****';
  return `****${actorHash.slice(-4)}`;
}

export function createImportRun(actorClerkUserId: string): ImportRunRow {
  ensureImportRunsSchema();
  const db = getCatalogDb();
  const actor_hash = hashActor(actorClerkUserId);
  const result = db
    .prepare(`INSERT INTO import_runs (status, actor_hash) VALUES ('pending', ?)`)
    .run(actor_hash);
  const id = Number(result.lastInsertRowid);
  return getImportRunRow(id)!;
}

export function getImportRunRow(id: number): ImportRunRow | null {
  ensureImportRunsSchema();
  const row = getCatalogDb()
    .prepare(
      `SELECT id, status, actor_hash, started_at, finished_at, steps_json, error_text, lock_token
       FROM import_runs WHERE id = ?`,
    )
    .get(id) as ImportRunRow | undefined;
  return row ?? null;
}

export function parseImportRunSteps(stepsJson: string | null): ImportRunSteps {
  if (!stepsJson) {
    return { lines: [], summary: null };
  }
  try {
    const parsed = JSON.parse(stepsJson) as Partial<ImportRunSteps>;
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      summary: normalizeStartupPipelineSummary(parsed.summary),
    };
  } catch {
    return { lines: [], summary: null };
  }
}

export function toImportRunResponse(row: ImportRunRow): ImportRunResponse {
  return {
    id: row.id,
    status: row.status,
    actorHash: row.actor_hash,
    actorMasked: actorMaskedFromHash(row.actor_hash),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    steps: parseImportRunSteps(row.steps_json),
    error: row.error_text,
  };
}

export function updateImportRun(
  id: number,
  patch: Partial<
    Pick<ImportRunRow, 'status' | 'finished_at' | 'steps_json' | 'error_text' | 'lock_token'>
  >,
): void {
  ensureImportRunsSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status);
  }
  if (patch.finished_at !== undefined) {
    fields.push('finished_at = ?');
    values.push(patch.finished_at);
  }
  if (patch.steps_json !== undefined) {
    fields.push('steps_json = ?');
    values.push(patch.steps_json);
  }
  if (patch.error_text !== undefined) {
    fields.push('error_text = ?');
    values.push(patch.error_text);
  }
  if (patch.lock_token !== undefined) {
    fields.push('lock_token = ?');
    values.push(patch.lock_token);
  }
  if (fields.length === 0) return;
  values.push(id);
  getCatalogDb()
    .prepare(`UPDATE import_runs SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values);
}

export function persistImportRunSteps(id: number, steps: ImportRunSteps): void {
  updateImportRun(id, { steps_json: JSON.stringify(steps) });
}

const IMPORT_LEASE_TTL_MINUTES = 30;
const IMPORT_INTERRUPTED_MESSAGE = 'Interrupted by server restart or stale import lock.';

export function tryAcquireImportLease(runId: number | null): string | null {
  ensureImportRunsSchema();
  const lockToken = randomUUID();
  const db = getCatalogDb();
  const acquired = db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO import_lease (id, lock_token, run_id, acquired_at) VALUES (1, NULL, NULL, NULL)',
    ).run();
    const updated = db
      .prepare(
        `UPDATE import_lease
         SET lock_token = ?, run_id = ?, acquired_at = datetime('now')
         WHERE id = ?
           AND (
             lock_token IS NULL
             OR acquired_at IS NULL
             OR acquired_at <= datetime('now', '-${IMPORT_LEASE_TTL_MINUTES} minutes')
           )`,
      )
      .run(lockToken, runId, LEASE_ROW_ID);
    return updated.changes === 1;
  })();
  if (!acquired) return null;
  if (runId !== null) {
    updateImportRun(runId, { lock_token: lockToken });
  }
  return lockToken;
}

export function releaseImportLease(lockToken: string): void {
  ensureImportRunsSchema();
  const db = getCatalogDb();
  db.transaction(() => {
    db.prepare(
      'UPDATE import_lease SET lock_token = NULL, run_id = NULL WHERE id = ? AND lock_token = ?',
    ).run(LEASE_ROW_ID, lockToken);
    db.prepare('UPDATE import_runs SET lock_token = NULL WHERE lock_token = ?').run(lockToken);
  })();
}

export function renewImportLease(lockToken: string): boolean {
  ensureImportRunsSchema();
  const updated = getCatalogDb()
    .prepare(
      `UPDATE import_lease SET acquired_at = datetime('now') WHERE id = ? AND lock_token = ?`,
    )
    .run(LEASE_ROW_ID, lockToken);
  return updated.changes === 1;
}

export function noteImportLeaseHeartbeat(lockToken: string, watch: ImportLeaseWatch): void {
  if (!renewImportLease(lockToken)) {
    watch.lost = true;
  }
}

export function touchLiveImportLease(lockToken: string | null, watch: ImportLeaseWatch): void {
  if (!lockToken) return;
  if (watch.lost || !renewImportLease(lockToken)) {
    watch.lost = true;
    throw new ImportLeaseLostError();
  }
}

function getImportLeaseRow(): {
  lock_token: string | null;
  run_id: number | null;
  acquired_at: string | null;
} | null {
  ensureImportRunsSchema();
  const row = getCatalogDb()
    .prepare('SELECT lock_token, run_id, acquired_at FROM import_lease WHERE id = ?')
    .get(LEASE_ROW_ID) as
    | { lock_token: string | null; run_id: number | null; acquired_at: string | null }
    | undefined;
  return row ?? null;
}

function isLeaseRowStale(acquiredAt: string | null): boolean {
  if (!acquiredAt) return true;
  ensureImportRunsSchema();
  const row = getCatalogDb()
    .prepare(
      `SELECT CASE WHEN ? <= datetime('now', '-${IMPORT_LEASE_TTL_MINUTES} minutes') THEN 1 ELSE 0 END AS stale`,
    )
    .get(acquiredAt) as { stale: number } | undefined;
  return row?.stale === 1;
}

function clearImportLeaseRow(): void {
  ensureImportRunsSchema();
  getCatalogDb()
    .prepare(
      'UPDATE import_lease SET lock_token = NULL, run_id = NULL, acquired_at = NULL WHERE id = ?',
    )
    .run(LEASE_ROW_ID);
}

function failInterruptedImportRuns(runId: number | null): void {
  ensureImportRunsSchema();
  const db = getCatalogDb();
  if (runId != null) {
    db.prepare(
      `UPDATE import_runs
       SET status = 'failed',
           finished_at = datetime('now'),
           error_text = COALESCE(error_text, ?),
           lock_token = NULL
       WHERE id = ? AND status IN ('pending', 'running')`,
    ).run(IMPORT_INTERRUPTED_MESSAGE, runId);
  }
  db.prepare(
    `UPDATE import_runs
     SET status = 'failed',
         finished_at = datetime('now'),
         error_text = COALESCE(error_text, ?),
         lock_token = NULL
     WHERE status IN ('pending', 'running')`,
  ).run(IMPORT_INTERRUPTED_MESSAGE);
}

export function releaseStaleImportLease(): boolean {
  const row = getImportLeaseRow();
  if (!row?.lock_token) return false;
  if (!isLeaseRowStale(row.acquired_at)) return false;
  const db = getCatalogDb();
  db.transaction(() => {
    clearImportLeaseRow();
    failInterruptedImportRuns(row.run_id);
  })();
  return true;
}

export function recoverImportLeaseOnStartup(): void {
  ensureImportRunsSchema();
  const row = getImportLeaseRow();
  if (!row?.lock_token) return;
  const db = getCatalogDb();
  db.transaction(() => {
    clearImportLeaseRow();
    failInterruptedImportRuns(row.run_id);
  })();
}

export function forceReleaseImportLease(): boolean {
  ensureImportRunsSchema();
  const db = getCatalogDb();
  return db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO import_lease (id, lock_token, run_id, acquired_at) VALUES (1, NULL, NULL, NULL)',
    ).run();
    const row = getImportLeaseRow();
    const updated = db
      .prepare(
        `UPDATE import_lease
         SET lock_token = NULL, run_id = NULL, acquired_at = NULL
         WHERE id = ?
           AND (
             lock_token IS NULL
             OR acquired_at IS NULL
             OR acquired_at <= datetime('now', '-${IMPORT_LEASE_TTL_MINUTES} minutes')
           )`,
      )
      .run(LEASE_ROW_ID);
    if (updated.changes !== 1) return false;
    if (row?.lock_token) {
      failInterruptedImportRuns(row.run_id);
    }
    return true;
  })();
}

export function isImportLeaseHeld(): boolean {
  releaseStaleImportLease();
  const row = getImportLeaseRow();
  return Boolean(row?.lock_token);
}

export function getActiveImportRunId(): number | null {
  ensureImportRunsSchema();
  const row = getImportLeaseRow();
  return row?.run_id ?? null;
}

export function getLatestImportRunRow(): ImportRunRow | null {
  ensureImportRunsSchema();
  const row = getCatalogDb()
    .prepare(
      `SELECT id, status, actor_hash, started_at, finished_at, steps_json, error_text, lock_token
       FROM import_runs
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get() as ImportRunRow | undefined;
  return row ?? null;
}

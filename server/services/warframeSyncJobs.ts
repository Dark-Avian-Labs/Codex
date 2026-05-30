import { createHash, randomUUID } from 'node:crypto';

import { getSessionDb } from '@codex/core';
import type Database from 'better-sqlite3';

import type { WarframeSyncResult } from './warframeSync.js';

export type WarframeSyncRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export type WarframeSyncRunRow = {
  id: number;
  status: WarframeSyncRunStatus;
  initiator_hash: string;
  started_at: string;
  finished_at: string | null;
  summary_json: string | null;
  error_text: string | null;
  lock_token: string | null;
};

export type WarframeSyncRunResponse = {
  id: number;
  status: WarframeSyncRunStatus;
  initiatorHash: string;
  initiatorMasked: string;
  startedAt: string;
  finishedAt: string | null;
  summary: WarframeSyncResult | null;
  error: string | null;
};

const LEASE_ROW_ID = 1;

let schemaReady = false;

export function ensureWarframeSyncJobsSchema(db: Database.Database = getSessionDb()): void {
  if (schemaReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS warframe_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      initiator_hash TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      summary_json TEXT,
      error_text TEXT,
      lock_token TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_warframe_sync_runs_status ON warframe_sync_runs(status);
    CREATE TABLE IF NOT EXISTS warframe_sync_lease (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lock_token TEXT,
      run_id INTEGER,
      acquired_at TEXT
    );
  `);
  schemaReady = true;
}

export function hashInitiator(clerkUserId: string): string {
  return createHash('sha256').update(clerkUserId).digest('hex');
}

export function maskClerkUserId(clerkUserId: string): string {
  const trimmed = clerkUserId.trim();
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}

export function initiatorMaskedFromHash(initiatorHash: string): string {
  if (initiatorHash.length <= 4) return '****';
  return `****${initiatorHash.slice(-4)}`;
}

export function maskWarframeSyncResult(result: WarframeSyncResult): WarframeSyncResult {
  const marketLinkSync =
    result.marketLinkSync.ran === true
      ? {
          ...result.marketLinkSync,
          failedWorksheets: result.marketLinkSync.failedWorksheets.map((entry) => ({
            ...entry,
            clerkUserId: maskClerkUserId(entry.clerkUserId),
          })),
        }
      : result.marketLinkSync;

  return {
    ...result,
    users: result.users.map((user) => ({
      ...user,
      clerkUserId: maskClerkUserId(user.clerkUserId),
    })),
    marketLinkSync,
  };
}

export function createWarframeSyncRun(initiatorClerkUserId: string): WarframeSyncRunRow {
  ensureWarframeSyncJobsSchema();
  const db = getSessionDb();
  const initiator_hash = hashInitiator(initiatorClerkUserId);
  const pendingMeta = JSON.stringify({ _initiatorMasked: maskClerkUserId(initiatorClerkUserId) });
  const result = db
    .prepare(
      `INSERT INTO warframe_sync_runs (status, initiator_hash, summary_json)
       VALUES ('pending', ?, ?)`,
    )
    .run(initiator_hash, pendingMeta);
  const id = Number(result.lastInsertRowid);
  return getWarframeSyncRunRow(id)!;
}

export function getWarframeSyncRunRow(id: number): WarframeSyncRunRow | null {
  ensureWarframeSyncJobsSchema();
  const row = getSessionDb()
    .prepare(
      `SELECT id, status, initiator_hash, started_at, finished_at, summary_json, error_text, lock_token
       FROM warframe_sync_runs WHERE id = ?`,
    )
    .get(id) as WarframeSyncRunRow | undefined;
  return row ?? null;
}

function readInitiatorMasked(summaryJson: string | null, initiatorHash: string): string {
  if (summaryJson) {
    try {
      const parsed = JSON.parse(summaryJson) as { _initiatorMasked?: string };
      if (typeof parsed._initiatorMasked === 'string' && parsed._initiatorMasked.length > 0) {
        return parsed._initiatorMasked;
      }
    } catch {
      // ignore
    }
  }
  return initiatorMaskedFromHash(initiatorHash);
}

export function toWarframeSyncRunResponse(row: WarframeSyncRunRow): WarframeSyncRunResponse {
  let summary: WarframeSyncResult | null = null;
  if (row.summary_json) {
    try {
      const parsed = JSON.parse(row.summary_json) as WarframeSyncResult & {
        _initiatorMasked?: string;
      };
      if (parsed.mode) {
        summary = maskWarframeSyncResult(parsed);
      }
    } catch {
      summary = null;
    }
  }
  return {
    id: row.id,
    status: row.status,
    initiatorHash: row.initiator_hash,
    initiatorMasked: readInitiatorMasked(row.summary_json, row.initiator_hash),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    summary,
    error: row.error_text,
  };
}

export function updateWarframeSyncRun(
  id: number,
  patch: Partial<
    Pick<
      WarframeSyncRunRow,
      'status' | 'finished_at' | 'summary_json' | 'error_text' | 'lock_token'
    >
  >,
): void {
  ensureWarframeSyncJobsSchema();
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
  if (patch.summary_json !== undefined) {
    fields.push('summary_json = ?');
    values.push(patch.summary_json);
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
  getSessionDb()
    .prepare(`UPDATE warframe_sync_runs SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values);
}

const WARFRAME_SYNC_LEASE_TTL_MINUTES = 30;

export function tryAcquireWarframeSyncLease(runId: number | null): string | null {
  ensureWarframeSyncJobsSchema();
  const lockToken = randomUUID();
  const db = getSessionDb();
  const acquired = db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO warframe_sync_lease (id, lock_token, run_id, acquired_at) VALUES (1, NULL, NULL, NULL)',
    ).run();
    const updated = db
      .prepare(
        `UPDATE warframe_sync_lease
         SET lock_token = ?, run_id = ?, acquired_at = datetime('now')
         WHERE id = ?
           AND (
             lock_token IS NULL
             OR acquired_at IS NULL
             OR acquired_at <= datetime('now', '-${WARFRAME_SYNC_LEASE_TTL_MINUTES} minutes')
           )`,
      )
      .run(lockToken, runId, LEASE_ROW_ID);
    return updated.changes === 1;
  })();
  if (!acquired) return null;
  if (runId !== null) {
    updateWarframeSyncRun(runId, { lock_token: lockToken });
  }
  return lockToken;
}

export function releaseWarframeSyncLease(lockToken: string): void {
  ensureWarframeSyncJobsSchema();
  const db = getSessionDb();
  db.transaction(() => {
    db.prepare(
      'UPDATE warframe_sync_lease SET lock_token = NULL, run_id = NULL WHERE id = ? AND lock_token = ?',
    ).run(LEASE_ROW_ID, lockToken);
    db.prepare('UPDATE warframe_sync_runs SET lock_token = NULL WHERE lock_token = ?').run(
      lockToken,
    );
  })();
}

export function isWarframeSyncLeaseHeld(): boolean {
  ensureWarframeSyncJobsSchema();
  const row = getSessionDb()
    .prepare('SELECT lock_token FROM warframe_sync_lease WHERE id = ?')
    .get(LEASE_ROW_ID) as { lock_token: string | null } | undefined;
  return Boolean(row?.lock_token);
}

export function getActiveWarframeSyncRunId(): number | null {
  ensureWarframeSyncJobsSchema();
  const row = getSessionDb()
    .prepare('SELECT run_id FROM warframe_sync_lease WHERE id = ?')
    .get(LEASE_ROW_ID) as { run_id: number | null } | undefined;
  return row?.run_id ?? null;
}

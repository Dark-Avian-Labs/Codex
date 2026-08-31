import { randomUUID } from 'node:crypto';

import type Database from 'better-sqlite3';

const LEASE_ROW_ID = 1;
const IMPORT_LEASE_TTL_MINUTES = 60;

export function ensureWorImportLeaseColumns(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(import_lease)`).all() as { name: string }[];
  if (!cols.some((col) => col.name === 'lock_token')) {
    db.exec(`ALTER TABLE import_lease ADD COLUMN lock_token TEXT`);
  }
}

export function tryAcquireWorImportLease(
  db: Database.Database,
  runId: number | null,
): string | null {
  ensureWorImportLeaseColumns(db);
  const lockToken = randomUUID();
  const acquired = db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO import_lease (id, run_id, locked_at, lock_token) VALUES (1, NULL, NULL, NULL)',
    ).run();
    const updated = db
      .prepare(
        `UPDATE import_lease
         SET lock_token = ?, run_id = ?, locked_at = datetime('now')
         WHERE id = ?
           AND (
             lock_token IS NULL
             OR locked_at IS NULL
             OR locked_at <= datetime('now', '-${IMPORT_LEASE_TTL_MINUTES} minutes')
           )`,
      )
      .run(lockToken, runId, LEASE_ROW_ID);
    return updated.changes === 1;
  })();
  return acquired ? lockToken : null;
}

export function releaseWorImportLease(db: Database.Database, lockToken: string): void {
  ensureWorImportLeaseColumns(db);
  db.prepare(
    'UPDATE import_lease SET lock_token = NULL, run_id = NULL, locked_at = NULL WHERE id = ? AND lock_token = ?',
  ).run(LEASE_ROW_ID, lockToken);
}

export function isWorImportLeaseHeld(db: Database.Database): boolean {
  ensureWorImportLeaseColumns(db);
  const row = db
    .prepare(
      `SELECT lock_token FROM import_lease
       WHERE id = ?
         AND lock_token IS NOT NULL
         AND locked_at IS NOT NULL
         AND locked_at > datetime('now', '-${IMPORT_LEASE_TTL_MINUTES} minutes')`,
    )
    .get(LEASE_ROW_ID) as { lock_token: string | null } | undefined;
  return Boolean(row?.lock_token);
}

export function renewWorImportLease(db: Database.Database, lockToken: string): boolean {
  ensureWorImportLeaseColumns(db);
  const updated = db
    .prepare(`UPDATE import_lease SET locked_at = datetime('now') WHERE id = ? AND lock_token = ?`)
    .run(LEASE_ROW_ID, lockToken);
  return updated.changes === 1;
}

export class WorImportLeaseLostError extends Error {
  constructor(message = 'WoR import lease was lost; catalog writes aborted.') {
    super(message);
    this.name = 'WorImportLeaseLostError';
  }
}

export type WorImportLeaseWatch = { lost: boolean };

export function noteWorImportLeaseHeartbeat(
  db: Database.Database,
  lockToken: string,
  watch: WorImportLeaseWatch,
): void {
  if (!renewWorImportLease(db, lockToken)) {
    watch.lost = true;
  }
}

export function requireWorImportLease(
  db: Database.Database,
  lockToken: string,
  watch: WorImportLeaseWatch,
): void {
  if (watch.lost || !renewWorImportLease(db, lockToken)) {
    watch.lost = true;
    throw new WorImportLeaseLostError();
  }
}

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/connection.js', () => {
  let db: Database.Database | null = null;
  return {
    getCatalogDb: () => {
      if (!db) {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
      }
      return db;
    },
  };
});

import { getCatalogDb } from './db/connection.js';
import {
  createImportRun,
  ensureImportRunsSchema,
  forceReleaseImportLease,
  ImportLeaseLostError,
  isImportLeaseHeld,
  maskClerkUserId,
  recoverImportLeaseOnStartup,
  releaseImportLease,
  tryAcquireImportLease,
  renewImportLease,
  touchLiveImportLease,
} from './importRuns.js';

describe('importRuns', () => {
  beforeEach(() => {
    ensureImportRunsSchema();
  });

  afterEach(() => {
    const db = getCatalogDb();
    db.exec('DELETE FROM import_runs');
    db.exec('UPDATE import_lease SET lock_token = NULL, run_id = NULL WHERE id = 1');
  });

  it('masks clerk user ids to last four characters', () => {
    expect(maskClerkUserId('user_importabcd')).toBe('****abcd');
  });

  it('allows only one import lease at a time', () => {
    const run = createImportRun('user_admin');
    const first = tryAcquireImportLease(run.id);
    const second = tryAcquireImportLease(run.id + 1);
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    releaseImportLease(first!);
    const third = tryAcquireImportLease(run.id + 1);
    expect(third).toBeTruthy();
    releaseImportLease(third!);
  });

  it('clears orphan leases on startup so imports can run again', () => {
    const run = createImportRun('user_admin');
    const token = tryAcquireImportLease(run.id);
    expect(token).toBeTruthy();
    expect(isImportLeaseHeld()).toBe(true);

    recoverImportLeaseOnStartup();

    expect(isImportLeaseHeld()).toBe(false);
    expect(tryAcquireImportLease(run.id + 1)).toBeTruthy();
  });

  it('renews acquired_at so a live lease is not treated as stale', () => {
    const run = createImportRun('user_admin');
    const token = tryAcquireImportLease(run.id);
    expect(token).toBeTruthy();
    expect(renewImportLease(token!)).toBe(true);
    expect(renewImportLease('not-the-token')).toBe(false);
    releaseImportLease(token!);
  });

  it('does not force-release a live lease held by another token', () => {
    const run = createImportRun('user_admin');
    const token = tryAcquireImportLease(run.id);
    expect(token).toBeTruthy();
    expect(forceReleaseImportLease()).toBe(false);
    expect(renewImportLease(token!)).toBe(true);
    releaseImportLease(token!);
    expect(forceReleaseImportLease()).toBe(true);
  });

  it('does not run a later catalog write after the lease token is replaced', () => {
    const writes: string[] = [];
    const run = createImportRun('user_admin');
    const token = tryAcquireImportLease(run.id);
    expect(token).toBeTruthy();
    const watch = { lost: false };
    const write = (label: string) => {
      touchLiveImportLease(token, watch);
      writes.push(label);
    };

    write('first');
    getCatalogDb().prepare('UPDATE import_lease SET lock_token = ? WHERE id = 1').run('stolen');
    expect(() => write('second')).toThrow(ImportLeaseLostError);
    expect(writes).toEqual(['first']);
  });
});

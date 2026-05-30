import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionDbRef = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('@codex/core', async () => {
  const actual = await vi.importActual<typeof import('@codex/core')>('@codex/core');
  return {
    ...actual,
    getSessionDb: () => {
      if (!sessionDbRef.current) {
        sessionDbRef.current = new Database(':memory:');
        sessionDbRef.current.pragma('foreign_keys = ON');
      }
      return sessionDbRef.current;
    },
  };
});

import {
  ensureWarframeSyncJobsSchema,
  hashInitiator,
  maskClerkUserId,
  maskWarframeSyncResult,
  tryAcquireWarframeSyncLease,
  releaseWarframeSyncLease,
  createWarframeSyncRun,
} from './warframeSyncJobs.js';

describe('warframeSyncJobs', () => {
  beforeEach(() => {
    ensureWarframeSyncJobsSchema();
    const db = sessionDbRef.current;
    if (db) {
      db.exec('DELETE FROM warframe_sync_lease; DELETE FROM warframe_sync_runs;');
    }
  });

  it('masks clerk user ids to last four characters', () => {
    expect(maskClerkUserId('user_abcdefghijklmnop')).toBe('****mnop');
    expect(hashInitiator('user_abcdefghijklmnop')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('masks clerk user ids inside sync summaries', () => {
    const masked = maskWarframeSyncResult({
      mode: 'execute',
      users: [{ clerkUserId: 'user_secret1234', worksheets: [] }],
      summary: { added: 0, deleted: 0, markedUnavailable: 0, mismatched: 0 },
      cleanup: {
        deleted: 0,
        requiresConfirmation: 0,
        deletedRows: [],
        requiresConfirmationRows: [],
      },
      marketLinkSync: {
        ran: true,
        rowsProcessed: 0,
        rowsWithLink: 0,
        failedWorksheets: [{ clerkUserId: 'user_other5678', worksheet: 'Warframes' }],
      },
    });
    expect(masked.users[0]?.clerkUserId).toBe('****1234');
    if (masked.marketLinkSync.ran) {
      expect(masked.marketLinkSync.failedWorksheets[0]?.clerkUserId).toBe('****5678');
    }
  });

  it('allows only one sync lease at a time', () => {
    const run = createWarframeSyncRun('user_admin');
    const first = tryAcquireWarframeSyncLease(run.id);
    const second = tryAcquireWarframeSyncLease(run.id + 1);
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    releaseWarframeSyncLease(first!);
    const third = tryAcquireWarframeSyncLease(run.id + 1);
    expect(third).toBeTruthy();
    releaseWarframeSyncLease(third!);
  });
});

import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, removeTempDbDir } from './helpers/sqliteTestHarness.js';

const pipelineControl = vi.hoisted(() => {
  let release: (() => void) | null = null;
  return {
    wait(): Promise<void> {
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    go(): void {
      release?.();
      release = null;
    },
    run: vi.fn(async () => {
      await pipelineControl.wait();
      return { heroes: 1, artifacts: 0, demons: 0 };
    }),
  };
});

const dbState = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('@codex/game-wor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codex/game-wor')>();
  return {
    ...actual,
    getWorDb: () => {
      if (!dbState.db) throw new Error('Test DB not initialized');
      return dbState.db;
    },
  };
});

vi.mock('../server/import/wor/startupPipeline.js', () => ({
  runWorStartupPipeline: pipelineControl.run,
}));

import {
  __resetWorAdminImportForTests,
  getWorAdminImportSnapshot,
  startWorAdminImport,
} from '../server/import/wor/adminImportJob.js';
import { tryAcquireWorImportLease } from '../server/import/wor/importLease.js';

describeWithSqlite('WoR admin import job', () => {
  let tmpDir: string;

  beforeEach(() => {
    const paths = createTempDbDir('wor-admin-import-');
    tmpDir = paths.tmpDir;
    dbState.db = new Database(paths.dbPath);
    createWorSchema(dbState.db);
    __resetWorAdminImportForTests();
    pipelineControl.run.mockClear();
  });

  afterEach(async () => {
    pipelineControl.go();
    await vi.waitFor(() => {
      expect(getWorAdminImportSnapshot().running).toBe(false);
    });
    __resetWorAdminImportForTests();
    dbState.db?.close();
    dbState.db = null;
    removeTempDbDir(tmpDir);
  });

  it('starts a job and refuses a second in-process start', async () => {
    const first = startWorAdminImport();
    expect(first.started).toBe(true);
    expect(first.snapshot.running).toBe(true);

    const second = startWorAdminImport();
    expect(second.started).toBe(false);
    expect(second.reason).toBe('Import already running');
    expect(pipelineControl.run).toHaveBeenCalledOnce();

    pipelineControl.go();
    await vi.waitFor(() => {
      expect(getWorAdminImportSnapshot().running).toBe(false);
    });
    expect(getWorAdminImportSnapshot().error).toBeNull();
    expect(getWorAdminImportSnapshot().summary).toEqual({
      heroes: 1,
      artifacts: 0,
      demons: 0,
    });
  });

  it('refuses to start when another process holds the lease', () => {
    const token = tryAcquireWorImportLease(dbState.db!, 99);
    expect(token).toBeTruthy();

    const result = startWorAdminImport();
    expect(result.started).toBe(false);
    expect(result.reason).toBe('Import lease held by another process');
    expect(pipelineControl.run).not.toHaveBeenCalled();
  });
});

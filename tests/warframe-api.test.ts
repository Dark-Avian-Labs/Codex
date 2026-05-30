import fs from 'node:fs';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: null as string | null,
  sessionClaims: undefined as Record<string, unknown> | undefined,
}));

const dbState = vi.hoisted(() => ({
  db: null as ReturnType<typeof createWarframeTestDb> | null,
  dbPath: '',
}));

vi.mock('@clerk/express', () => ({
  getAuth: () => ({
    userId: authState.userId,
    sessionClaims: authState.sessionClaims,
  }),
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('@codex/game-warframe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codex/game-warframe')>();
  return {
    ...actual,
    getWarframeDb: () => {
      if (!dbState.db) throw new Error('Test DB not initialized');
      return dbState.db.db;
    },
    get WARFRAME_DB_PATH() {
      return dbState.dbPath;
    },
  };
});

import { apiRouter } from '../server/routes/api.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import {
  createTempDbDir,
  createWarframeTestDb,
  removeTempDbDir,
  seedMinimalWarframeFixture,
} from './helpers/sqliteTestHarness.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

function cleanupTempDb(clearState = false): void {
  const harness = dbState.db;
  if (!harness) return;
  harness.closeDb();
  removeTempDbDir(harness.tmpDir);
  if (clearState) {
    dbState.db = null;
  }
}

describeWithSqlite('warframe API routes', () => {
  let accessSpy: MockInstance | undefined;

  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
    cleanupTempDb();
    const { dbPath } = createTempDbDir('codex-api-');
    dbState.dbPath = dbPath;
    dbState.db = createWarframeTestDb(dbPath);
    seedMinimalWarframeFixture(dbState.db.db);
    accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
  });

  afterEach(() => {
    accessSpy?.mockRestore();
    cleanupTempDb(true);
  });

  it('returns 401 for unauthenticated /api/status', async () => {
    const res = await request(createTestApp()).get('/api/status');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid cell patch body', async () => {
    authState.userId = 'user_test';
    const res = await request(createTestApp())
      .patch('/api/warframe/cells')
      .send({ row_id: 'bad', column_id: 1, value: 'Obtained' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 for invalid status enum', async () => {
    authState.userId = 'user_test';
    const res = await request(createTestApp())
      .patch('/api/warframe/cells')
      .send({ row_id: 1, column_id: 1, value: 'NotARealStatus' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid status/i);
  });

  it('returns 403 for non-admin on admin cell patch', async () => {
    authState.userId = 'user_test';
    authState.sessionClaims = { metadata: { apps: { codex: 'user' } } };
    const res = await request(createTestApp())
      .patch('/api/warframe/admin/cells')
      .send({ row_id: 1, column_id: 1, value: 'Unavailable' });
    expect(res.status).toBe(403);
  });
});

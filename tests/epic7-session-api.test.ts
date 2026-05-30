import { epic7Queries as q } from '@codex/game-epic7';
import Database from 'better-sqlite3';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createSchema as createEpic7Schema } from '../packages/games/epic7/src/db/schema.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';

const authState = vi.hoisted(() => ({
  userId: null as string | null,
}));

const dbState = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('@clerk/express', () => ({
  getAuth: () => ({ userId: authState.userId }),
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../server/epic7DbState.js', () => ({
  isEpic7DbAvailable: () => true,
}));

vi.mock('@codex/game-epic7', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codex/game-epic7')>();
  return {
    ...actual,
    getEpic7Db: () => {
      if (!dbState.db) throw new Error('Test DB not initialized');
      return dbState.db;
    },
  };
});

import { epic7ApiRouter } from '../server/routes/epic7Api.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use('/api/epic7', epic7ApiRouter);
  return app;
}

describeWithSqlite('Epic7 session isolation', () => {
  beforeEach(() => {
    authState.userId = null;
    dbState.db?.close();
    dbState.db = new Database(':memory:');
    createEpic7Schema(dbState.db);
    q.createGameAccount(dbState.db, 'user_a', 'Account A', true);
    q.createGameAccount(dbState.db, 'user_b', 'Account B', true);
  });

  afterEach(() => {
    dbState.db?.close();
    dbState.db = null;
  });

  it('rejects stale account_id from another user session', async () => {
    authState.userId = 'user_a';
    const agent = request.agent(createTestApp());
    await agent.post('/api/epic7/accounts/switch').send({ account_id: 1 }).expect(200);

    authState.userId = 'user_b';
    const heroes = await agent.get('/api/epic7/heroes');
    expect(heroes.status).toBe(200);
    expect(heroes.body.heroes).toEqual([]);
  });

  it('clears session account on logout via binding when user switches', async () => {
    authState.userId = 'user_a';
    const agent = request.agent(createTestApp());
    const accounts = await agent.get('/api/epic7/accounts');
    expect(accounts.body.current_account_id).toBe(1);

    authState.userId = 'user_b';
    const afterSwitch = await agent.get('/api/epic7/accounts');
    expect(afterSwitch.body.current_account_id).toBe(2);
    expect(afterSwitch.body.accounts.map((a: { id: number }) => a.id)).toEqual([2]);
  });
});

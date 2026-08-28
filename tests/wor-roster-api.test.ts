import { worQueries as q } from '@codex/game-wor';
import Database from 'better-sqlite3';
import express from 'express';
import session from 'express-session';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createSessionAgent } from './helpers/testExpress.js';

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

vi.mock('../server/worDbState.js', () => ({
  isWorDbAvailable: () => true,
  ensureWorDbAvailable: () => true,
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

import { worApiRouter } from '../server/routes/worApi.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      },
    }),
  );
  app.use('/api/wor', worApiRouter);
  return app;
}

function seedCatalog(db: Database.Database): void {
  db.prepare(
    `INSERT INTO catalog_heroes (
      slug, name, class, faction, faction_secondary, rarity, star_rating, is_lord, display_order, active
    ) VALUES
      ('lian', 'Lian', 'marksman', 'watchguard', null, 'legendary', 5, 0, 0, 1),
      ('aja', 'Aja', 'mage', 'north_throne', null, 'legendary', 5, 0, 1, 1)`,
  ).run();
  db.prepare(
    `INSERT INTO catalog_artifacts (
      slug, name, rarity, star_rating, is_universal, exclusive_hero_slug, display_order, active
    ) VALUES
      ('generic-bow', 'Generic Bow', 'legendary', 5, 1, null, 0, 1),
      ('lian-sig', 'Lian Signature', 'legendary', 5, 0, 'lian', 1, 1)`,
  ).run();
  db.prepare(
    `INSERT INTO catalog_demons (
      slug, name, rarity, star_rating, max_level, display_order, active
    ) VALUES
      ('wrath', 'Wrath', 'legendary', 5, 5, 0, 1),
      ('captain-x', 'Captain X', 'captain', 5, 5, 1, 1)`,
  ).run();
}

describeWithSqlite('WoR roster API', () => {
  beforeEach(() => {
    authState.userId = null;
    dbState.db?.close();
    dbState.db = new Database(':memory:');
    createWorSchema(dbState.db);
    seedCatalog(dbState.db);
    q.createGameAccount(dbState.db, 'user_a', 'Main', true);
    q.createGameAccount(dbState.db, 'user_b', 'Other', true);

    const lian = dbState.db
      .prepare('SELECT id FROM account_heroes WHERE account_id = 1 AND catalog_hero_slug = ?')
      .get('lian') as { id: number };
    q.updateHeroOwned(dbState.db, lian.id, 1, 1);
    q.updateHeroGauge(dbState.db, lian.id, 1, 3);

    const bow = dbState.db
      .prepare('SELECT id FROM account_artifacts WHERE account_id = 1 AND catalog_artifact_slug = ?')
      .get('generic-bow') as { id: number };
    q.updateArtifactOwned(dbState.db, bow.id, 1, 1);
    q.updateArtifactGauge(dbState.db, bow.id, 1, 2);

    const wrath = dbState.db
      .prepare('SELECT id FROM account_demons WHERE account_id = 1 AND catalog_demon_slug = ?')
      .get('wrath') as { id: number };
    q.updateDemonOwned(dbState.db, wrath.id, 1, 1);
    q.updateDemonGauge(dbState.db, wrath.id, 1, 4);
  });

  afterEach(() => {
    dbState.db?.close();
    dbState.db = null;
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when the user has no game account', async () => {
    authState.userId = 'user_empty';
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No game account/i);
  });

  it('returns owned rows only by default, without portrait fields', async () => {
    authState.userId = 'user_a';
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster');
    expect(res.status).toBe(200);
    expect(res.body.account).toEqual({ id: 1, name: 'Main' });
    expect(res.body.stats.heroes).toEqual({ total: 2, owned: 1, maxed: 0 });
    expect(res.body.heroes).toEqual([
      expect.objectContaining({
        slug: 'lian',
        name: 'Lian',
        owned: true,
        awakening: 3,
        is_lord: false,
      }),
    ]);
    expect(res.body.artifacts).toEqual([
      expect.objectContaining({
        slug: 'generic-bow',
        owned: true,
        promotion: 2,
        is_universal: true,
      }),
    ]);
    expect(res.body.demons).toEqual([expect.objectContaining({ slug: 'wrath', owned: true, level: 4, max_level: 5 })]);
    expect(JSON.stringify(res.body)).not.toContain('portrait');
    expect(res.body.heroes[0]).not.toHaveProperty('display_order');
  });

  it('returns unowned rows when owned=all', async () => {
    authState.userId = 'user_a';
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster?owned=all');
    expect(res.status).toBe(200);
    expect(res.body.heroes.map((hero: { slug: string }) => hero.slug).sort()).toEqual(['aja', 'lian']);
  });

  it('limits collections with include=', async () => {
    authState.userId = 'user_a';
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster?include=heroes');
    expect(res.status).toBe(200);
    expect(res.body.heroes).toHaveLength(1);
    expect(res.body.artifacts).toBeUndefined();
    expect(res.body.demons).toBeUndefined();
    expect(res.body.stats.artifacts.total).toBe(2);
  });

  it('applies hero class filters', async () => {
    authState.userId = 'user_a';
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster?owned=all&class=mage');
    expect(res.status).toBe(200);
    expect(res.body.heroes.map((hero: { slug: string }) => hero.slug)).toEqual(['aja']);
  });

  it('does not expose another user account', async () => {
    authState.userId = 'user_b';
    const res = await createSessionAgent(createTestApp()).get('/api/wor/roster?owned=all');
    expect(res.status).toBe(200);
    expect(res.body.account).toEqual({ id: 2, name: 'Other' });
    expect(res.body.heroes.every((hero: { owned: boolean }) => hero.owned === false)).toBe(true);
    expect(res.body.stats.heroes.owned).toBe(0);
  });
});

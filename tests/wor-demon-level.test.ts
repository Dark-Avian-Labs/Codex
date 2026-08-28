import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import * as q from '../packages/games/wor/src/db/queries.js';
import { createSchema as createWorSchema, ensureWorSchemaMigrations } from '../packages/games/wor/src/db/schema.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';

describeWithSqlite('WoR demon owned level', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createWorSchema(db);
    db.prepare(
      `INSERT INTO catalog_demons (slug, name, rarity, star_rating, max_level, display_order, active)
       VALUES ('wrath', 'Wrath', 'legendary', 5, 5, 0, 1)`,
    ).run();
    q.createGameAccount(db, 'user_a', 'Main', true);
  });

  afterEach(() => {
    db.close();
  });

  function demonRow(): { id: number; owned: number; gauge_level: number } {
    return db.prepare('SELECT id, owned, gauge_level FROM account_demons WHERE account_id = 1').get() as {
      id: number;
      owned: number;
      gauge_level: number;
    };
  }

  it('starts owned demons at level 1', () => {
    const { id } = demonRow();
    expect(demonRow().gauge_level).toBe(0);
    expect(q.updateDemonOwned(db, id, 1, 1)).toBe(true);
    expect(demonRow()).toEqual({ id, owned: 1, gauge_level: 1 });
  });

  it('does not reset an already-leveled owned demon', () => {
    const { id } = demonRow();
    q.updateDemonOwned(db, id, 1, 1);
    expect(q.updateDemonGauge(db, id, 1, 4)).toBe(true);
    expect(q.updateDemonOwned(db, id, 1, 1)).toBe(true);
    expect(demonRow().gauge_level).toBe(4);
  });

  it('clears level when unowned', () => {
    const { id } = demonRow();
    q.updateDemonOwned(db, id, 1, 1);
    q.updateDemonGauge(db, id, 1, 3);
    q.updateDemonOwned(db, id, 1, 0);
    expect(demonRow()).toEqual({ id, owned: 0, gauge_level: 0 });
  });

  it('rejects gauge level 0 on an owned demon', () => {
    const { id } = demonRow();
    q.updateDemonOwned(db, id, 1, 1);
    expect(q.updateDemonGauge(db, id, 1, 0)).toBe(false);
    expect(demonRow().gauge_level).toBe(1);
  });

  it('repairs owned demons stored at level 0', () => {
    const { id } = demonRow();
    db.prepare('UPDATE account_demons SET owned = 1, gauge_level = 0 WHERE id = ?').run(id);
    ensureWorSchemaMigrations(db);
    expect(demonRow()).toEqual({ id, owned: 1, gauge_level: 1 });
  });
});

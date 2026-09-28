import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { heroHasAwakening } from '../packages/games/wor/src/constants.js';
import * as q from '../packages/games/wor/src/db/queries.js';
import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';

describeWithSqlite('WoR 3-star hero awakening', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createWorSchema(db);
    db.prepare(
      `INSERT INTO catalog_heroes (slug, name, class, faction, rarity, star_rating, display_order, active)
       VALUES
         ('rare', 'Rare', 'fighter', 'watchguard', 'rare', 3, 0, 1),
         ('epic', 'Epic', 'mage', 'watchguard', 'epic', 4, 1, 1),
         ('legend', 'Legend', 'marksman', 'watchguard', 'legendary', 5, 2, 1)`,
    ).run();
    q.createGameAccount(db, 'user_a', 'Main', true);
  });

  afterEach(() => {
    db.close();
  });

  function heroId(slug: string): number {
    const row = db
      .prepare('SELECT id FROM account_heroes WHERE account_id = 1 AND catalog_hero_slug = ?')
      .get(slug) as { id: number };
    return row.id;
  }

  it('counts an owned 3-star as maxed and refuses awakening', () => {
    expect(heroHasAwakening(3)).toBe(false);
    expect(heroHasAwakening(4)).toBe(true);

    const rareId = heroId('rare');
    const epicId = heroId('epic');
    const legendId = heroId('legend');

    expect(q.getHeroStats(db, 1)).toEqual({ total: 3, owned: 0, maxed: 0 });

    q.updateHeroOwned(db, rareId, 1, 1);
    q.updateHeroOwned(db, epicId, 1, 1);
    expect(q.getHeroStats(db, 1)).toEqual({ total: 3, owned: 2, maxed: 1 });
    expect(q.updateHeroGauge(db, rareId, 1, 1)).toBe(false);

    q.updateHeroOwned(db, legendId, 1, 1);
    expect(q.updateHeroGauge(db, legendId, 1, 5)).toBe(true);
    expect(q.getHeroStats(db, 1)).toEqual({ total: 3, owned: 3, maxed: 2 });
  });
});

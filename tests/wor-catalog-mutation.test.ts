import { worQueries } from '@codex/game-wor';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import type { CatalogBundle } from '../server/import/wor/catalogQueries.js';
import { applyWorCatalogMutation } from '../server/import/wor/startupPipeline.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, removeTempDbDir } from './helpers/sqliteTestHarness.js';

describeWithSqlite('WoR catalog mutation transaction', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    const paths = createTempDbDir('wor-catalog-tx-');
    tmpDir = paths.tmpDir;
    db = new Database(paths.dbPath);
    createWorSchema(db);
  });

  afterEach(() => {
    db.close();
    removeTempDbDir(tmpDir);
  });

  it('upserts, deactivates missing catalog rows, prunes unknown slugs, and seeds accounts', () => {
    const firstBundle: CatalogBundle = {
      heroes: [
        {
          slug: 'lian',
          name: 'Lian',
          class: 'marksman',
          faction: 'watchguard',
          rarity: 'legendary',
        },
        {
          slug: 'aja',
          name: 'Aja',
          class: 'mage',
          faction: 'north_throne',
          rarity: 'legendary',
        },
      ],
      artifacts: [
        {
          slug: 'generic-bow',
          name: 'Generic Bow',
          rarity: 'legendary',
          is_universal: 1,
        },
      ],
      demons: [{ slug: 'wrath', name: 'Wrath', rarity: 'legendary', max_level: 5 }],
    };
    applyWorCatalogMutation(db, firstBundle);

    const accountId = worQueries.createGameAccount(db, 'user_a', 'Main', true);
    db.prepare(
      'UPDATE account_heroes SET owned = 1, gauge_level = 3 WHERE account_id = ? AND catalog_hero_slug = ?',
    ).run(accountId, 'lian');

    applyWorCatalogMutation(db, {
      heroes: [
        {
          slug: 'lian',
          name: 'Lian Renamed',
          class: 'marksman',
          faction: 'watchguard',
          rarity: 'legendary',
        },
        {
          slug: 'hex',
          name: 'Hex',
          class: 'fighter',
          faction: 'chaos_dominion',
          rarity: 'legendary',
        },
      ],
      artifacts: firstBundle.artifacts,
      demons: firstBundle.demons,
    });

    const aja = db.prepare('SELECT active FROM catalog_heroes WHERE slug = ?').get('aja') as { active: number };
    expect(aja.active).toBe(0);

    const ajaAccount = db
      .prepare('SELECT owned, gauge_level FROM account_heroes WHERE catalog_hero_slug = ?')
      .get('aja') as { owned: number; gauge_level: number } | undefined;
    expect(ajaAccount).toEqual({ owned: 0, gauge_level: 0 });

    const lianAccount = db
      .prepare('SELECT name, owned, gauge_level FROM account_heroes WHERE catalog_hero_slug = ?')
      .get('lian') as { name: string; owned: number; gauge_level: number };
    expect(lianAccount).toEqual({ name: 'Lian Renamed', owned: 1, gauge_level: 3 });

    const hexAccount = db.prepare('SELECT owned FROM account_heroes WHERE catalog_hero_slug = ?').get('hex') as
      | { owned: number }
      | undefined;
    expect(hexAccount?.owned).toBe(0);

    db.prepare('DELETE FROM catalog_heroes WHERE slug = ?').run('aja');
    const pruned = worQueries.pruneInactiveCatalogAccountRows(db);
    expect(pruned.heroes).toBe(1);
    expect(db.prepare('SELECT 1 FROM account_heroes WHERE catalog_hero_slug = ?').get('aja')).toBeUndefined();
  });
});

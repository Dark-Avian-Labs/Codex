import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import { fillMissingHeroStatsFromProspector, type ProspectorSnapshot } from '../server/import/wor/prospectorCatalog.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, removeTempDbDir } from './helpers/sqliteTestHarness.js';

function emptySnapshot(heroes: ProspectorSnapshot['heroes']): ProspectorSnapshot {
  return {
    heroes,
    artifacts: [],
    terms: {
      class: [],
      faction: [],
      rarity: [],
      damage: [],
      artifactRarity: [],
      summon: [],
    },
    media: {},
  };
}

describeWithSqlite('fillMissingHeroStatsFromProspector', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    const paths = createTempDbDir('wor-prospector-stats-');
    tmpDir = paths.tmpDir;
    db = new Database(paths.dbPath);
    createWorSchema(db);
  });

  afterEach(() => {
    db.close();
    removeTempDbDir(tmpDir);
  });

  it('fills only heroes that still lack base_hp or base_atk', () => {
    db.prepare(
      `INSERT INTO catalog_heroes (
        slug, name, class, faction, rarity, star_rating, is_lord, is_regular, is_ancient, is_limited,
        display_order, active, base_hp, base_atk
      ) VALUES
        ('has-stats', 'Has Stats', 'mage', 'watchguard', 'legendary', 5, 0, 1, 0, 0, 1, 1, 9000, 3000),
        ('needs-stats', 'Needs Stats', 'mage', 'watchguard', 'legendary', 5, 0, 1, 0, 0, 2, 1, NULL, NULL),
        ('no-prospector', 'No Prospector', 'mage', 'watchguard', 'legendary', 5, 0, 1, 0, 0, 3, 1, NULL, NULL)`,
    ).run();

    const summary = fillMissingHeroStatsFromProspector(
      db,
      emptySnapshot([
        {
          id: 1,
          slug: 'has-stats',
          name: 'Has Stats',
          classId: 58,
          factionIds: [],
          rarityId: 173,
          damageId: null,
          summonId: null,
          isLord: false,
          mediaId: null,
          stats: {
            hp: 1,
            atk: 1,
            def: 1,
            mdef: 1,
            block: 1,
            cost: 1,
            atkInterval: 1,
            rrAuto: 1,
            rrAttack: 1,
            rrAttacked: 1,
          },
        },
        {
          id: 2,
          slug: 'needs-stats',
          name: 'Needs Stats',
          classId: 58,
          factionIds: [],
          rarityId: 173,
          damageId: null,
          summonId: null,
          isLord: false,
          mediaId: null,
          stats: {
            hp: 10720,
            atk: 4171,
            def: 768,
            mdef: 2581,
            block: 1,
            cost: 22,
            atkInterval: 3.5,
            rrAuto: 14,
            rrAttack: 10,
            rrAttacked: 6,
          },
        },
      ]),
    );

    expect(summary).toEqual({ updated: 1, missing: 1 });
    const hasStats = db.prepare(`SELECT base_hp, base_atk FROM catalog_heroes WHERE slug = 'has-stats'`).get() as {
      base_hp: number;
      base_atk: number;
    };
    expect(hasStats).toEqual({ base_hp: 9000, base_atk: 3000 });
    const filled = db
      .prepare(
        `SELECT base_hp, base_atk, base_def, base_atk_interval, base_rr_auto, base_rr_attack, base_rr_attacked
         FROM catalog_heroes WHERE slug = 'needs-stats'`,
      )
      .get() as Record<string, number>;
    expect(filled).toEqual({
      base_hp: 10720,
      base_atk: 4171,
      base_def: 768,
      base_atk_interval: 3.5,
      base_rr_auto: 14,
      base_rr_attack: 10,
      base_rr_attacked: 6,
    });
  });
});

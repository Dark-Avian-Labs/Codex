import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  ensureWarframeCatalogActiveColumn,
  ensureWarframeCatalogMasterTable,
  ensureWarframeCatalogMaxLevelColumn,
} from '../packages/games/warframe/src/db/schema.js';
import { runWarframeSync } from '../server/services/warframeSync.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, createWarframeTestDb, removeTempDbDir } from './helpers/sqliteTestHarness.js';

function seedArmoryArcanes(armoryPath: string): void {
  const armory = new Database(armoryPath);
  armory.exec(`
    CREATE TABLE IF NOT EXISTS warframes (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      product_category TEXT
    );
    CREATE TABLE IF NOT EXISTS weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT,
      product_category TEXT,
      slot TEXT
    );
    CREATE TABLE IF NOT EXISTS companions (
      unique_name TEXT PRIMARY KEY,
      name TEXT
    );
    CREATE TABLE IF NOT EXISTS arcanes (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rarity TEXT,
      level_stats TEXT,
      compat_tags TEXT,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS warframe_market_links (
      canonical_key TEXT NOT NULL,
      worksheet_category TEXT NOT NULL,
      market_href TEXT,
      market_href_prime TEXT,
      link_kind TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (canonical_key, worksheet_category)
    );
    DELETE FROM arcanes;
    DELETE FROM warframe_market_links;
  `);
  armory
    .prepare(
      `INSERT INTO arcanes (unique_name, name, rarity, level_stats)
       VALUES (?, ?, 'Legendary', ?)`,
    )
    .run(
      '/Lotus/Upgrades/CosmeticEnhancers/Offensive/ArcaneEnergize',
      'Arcane Energize',
      JSON.stringify([{}, {}, {}, {}, {}, {}]),
    );
  // Internal DE row (path ends with Sub); must not appear in Codex catalog.
  armory
    .prepare(
      `INSERT INTO arcanes (unique_name, name, rarity, level_stats)
       VALUES (?, ?, 'Rare', ?)`,
    )
    .run(
      '/Lotus/Upgrades/CosmeticEnhancers/Offensive/AbilityStrengthOnSummonAttackSub',
      'Arcane',
      JSON.stringify([{}, {}]),
    );
  armory.close();
}

describeWithSqlite('warframe arcanes sync', () => {
  const armoryPath = process.env.ARMORY_DB_PATH!;
  let codexTmp: ReturnType<typeof createTempDbDir>;
  let codexDb: Database.Database;
  let closeCodex: () => void;

  beforeEach(() => {
    seedArmoryArcanes(armoryPath);
    codexTmp = createTempDbDir('codex-arcanes-sync-');
    const warframe = createWarframeTestDb(codexTmp.dbPath);
    codexDb = warframe.db;
    closeCodex = warframe.closeDb;
    ensureWarframeCatalogMasterTable(codexDb);
    ensureWarframeCatalogActiveColumn(codexDb);
    ensureWarframeCatalogMaxLevelColumn(codexDb);
  });

  afterEach(() => {
    closeCodex();
    removeTempDbDir(codexTmp.tmpDir);
  });

  it('syncs Arcanes into catalog_rows with per-item max_level', () => {
    runWarframeSync(codexDb, {
      execute: true,
      initiatedByClerkUserId: 'admin_test',
    });

    const rows = codexDb
      .prepare(
        `SELECT item_name, canonical_key, max_level, active
         FROM catalog_rows WHERE worksheet_name = 'Arcanes' ORDER BY item_name`,
      )
      .all() as Array<{
      item_name: string;
      canonical_key: string;
      max_level: number | null;
      active: number;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.item_name).toBe('Arcane Energize');
    expect(rows[0]?.max_level).toBe(5);
    expect(rows[0]?.active).toBe(1);
    expect(rows.some((row) => row.item_name === 'Arcane')).toBe(false);
  });
});

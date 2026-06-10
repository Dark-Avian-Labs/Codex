import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  ensureWarframeCatalogActiveColumn,
  ensureWarframeCatalogMasterTable,
  ensureWarframeCatalogMaxLevelColumn,
  ensureWarframeRowOrphanColumn,
} from '../packages/games/warframe/src/db/schema.js';
import { runWarframeSync } from '../server/services/warframeSync.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, createWarframeTestDb, removeTempDbDir } from './helpers/sqliteTestHarness.js';

function seedArmoryModularCatalog(armoryPath: string): void {
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
    CREATE TABLE IF NOT EXISTS codex_modular_weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    DELETE FROM codex_modular_weapons;
    DELETE FROM warframe_market_links;
  `);

  const modularNames = [
    'Catchmoon',
    'Gaze',
    'Rattleguts',
    'Tombfinger',
    'Sporelacer',
    'Vermisplicer',
    'Balla',
    'Mote Amp',
  ];
  modularNames.forEach((name, index) => {
    armory
      .prepare(
        `INSERT INTO codex_modular_weapons (unique_name, name, display_order, active)
         VALUES (?, ?, ?, 1)`,
      )
      .run(`/Lotus/Test/Modular/${index}`, name, index);
  });
  armory.close();
}

describeWithSqlite('warframe modular weapons sync', () => {
  const armoryPath = process.env.ARMORY_DB_PATH!;
  let codexTmp: ReturnType<typeof createTempDbDir>;
  let codexDb: Database.Database;
  let closeCodex: () => void;

  beforeEach(() => {
    seedArmoryModularCatalog(armoryPath);
    codexTmp = createTempDbDir('codex-modular-sync-');
    const warframe = createWarframeTestDb(codexTmp.dbPath);
    codexDb = warframe.db;
    closeCodex = warframe.closeDb;
    ensureWarframeCatalogMasterTable(codexDb);
    ensureWarframeCatalogActiveColumn(codexDb);
    ensureWarframeCatalogMaxLevelColumn(codexDb);
    ensureWarframeRowOrphanColumn(codexDb);
  });

  afterEach(() => {
    closeCodex();
    removeTempDbDir(codexTmp.tmpDir);
  });

  it('treats modular worksheet rows from codex_modular_weapons as matched, not mismatched', () => {
    const userId = 'user_modular_test';
    const sheetId = codexDb
      .prepare(`INSERT INTO worksheets (clerk_user_id, name, display_order) VALUES (?, 'Modular Weapons', 0)`)
      .run(userId).lastInsertRowid as number;
    codexDb.prepare(`INSERT INTO columns (worksheet_id, name, display_order) VALUES (?, 'Normal', 0)`).run(sheetId);
    codexDb.prepare(`INSERT INTO columns (worksheet_id, name, display_order) VALUES (?, 'Prime', 1)`).run(sheetId);

    const rowNames = ['Rattleguts', 'Catchmoon (Primary)', 'Mote Amp', 'Balla'];
    rowNames.forEach((itemName, index) => {
      codexDb
        .prepare(
          `INSERT INTO rows (worksheet_id, item_name, display_order, orphaned)
           VALUES (?, ?, ?, 1)`,
        )
        .run(sheetId, itemName, index);
    });

    const preview = runWarframeSync(codexDb, { execute: false, clerkUserIds: [userId] });
    const modularSheet = preview.users[0]?.worksheets.find((sheet) => sheet.worksheet === 'Modular Weapons');
    expect(modularSheet?.mismatched).toEqual([]);

    runWarframeSync(codexDb, {
      execute: true,
      clerkUserIds: [userId],
      initiatedByClerkUserId: 'admin_test',
    });

    const orphaned = codexDb
      .prepare(`SELECT orphaned FROM rows WHERE worksheet_id = ? ORDER BY id`)
      .all(sheetId) as Array<{ orphaned: number }>;
    expect(orphaned.every((row) => row.orphaned === 0)).toBe(true);
  });
});

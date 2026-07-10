import { createDbSingleton } from '@codex/core';
import type Database from 'better-sqlite3';

import { WOR_DB_PATH } from '../config.js';

export function ensureWorCatalogTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_heroes (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      faction TEXT NOT NULL,
      rarity TEXT NOT NULL,
      star_rating INTEGER NOT NULL,
      damage_type TEXT,
      is_lord INTEGER NOT NULL DEFAULT 0,
      source_flags TEXT,
      reference_tier TEXT,
      portrait_path TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS catalog_artifacts (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class TEXT,
      rarity TEXT NOT NULL,
      star_rating INTEGER NOT NULL,
      exclusive_hero_slug TEXT,
      is_universal INTEGER NOT NULL DEFAULT 1,
      reference_tier TEXT,
      portrait_path TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS catalog_demons (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      star_rating INTEGER NOT NULL,
      faction_group TEXT,
      max_level INTEGER NOT NULL DEFAULT 5,
      portrait_path TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS catalog_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_import_at TEXT,
      source_hashes_json TEXT,
      catalog_version INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO catalog_meta (id, catalog_version) VALUES (1, 0);
  `);
  ensureWorCatalogMigrations(db);
}

function ensureWorCatalogMigrations(db: Database.Database): void {
  const artifactCols = db.prepare(`PRAGMA table_info(catalog_artifacts)`).all() as {
    name: string;
  }[];
  if (!artifactCols.some((col) => col.name === 'class')) {
    db.exec(`ALTER TABLE catalog_artifacts ADD COLUMN class TEXT`);
  }
}

export function ensureWorAccountTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(clerk_user_id, account_name)
    );

    CREATE TABLE IF NOT EXISTS account_heroes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      catalog_hero_slug TEXT,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      faction TEXT NOT NULL,
      rarity TEXT NOT NULL,
      star_rating INTEGER NOT NULL DEFAULT 3,
      owned INTEGER NOT NULL DEFAULT 0,
      gauge_level INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES game_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS account_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      catalog_artifact_slug TEXT,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      star_rating INTEGER NOT NULL DEFAULT 3,
      owned INTEGER NOT NULL DEFAULT 0,
      gauge_level INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES game_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS account_demons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      catalog_demon_slug TEXT,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      star_rating INTEGER NOT NULL DEFAULT 3,
      owned INTEGER NOT NULL DEFAULT 0,
      gauge_level INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES game_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      actor_hash TEXT,
      steps_json TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS import_lease (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      run_id INTEGER,
      locked_at TEXT
    );

    INSERT OR IGNORE INTO import_lease (id) VALUES (1);

    CREATE INDEX IF NOT EXISTS idx_game_accounts_clerk_user ON game_accounts(clerk_user_id);
    CREATE INDEX IF NOT EXISTS idx_account_heroes_account ON account_heroes(account_id);
    CREATE INDEX IF NOT EXISTS idx_account_artifacts_account ON account_artifacts(account_id);
    CREATE INDEX IF NOT EXISTS idx_account_demons_account ON account_demons(account_id);
  `);
}

export function ensureWorCoreTables(db: Database.Database): void {
  ensureWorCatalogTables(db);
  ensureWorAccountTables(db);
}

function repairDuplicateActiveAccounts(db: Database.Database): boolean {
  const duplicates = db
    .prepare(
      `SELECT clerk_user_id FROM game_accounts
        WHERE is_active = 1
        GROUP BY clerk_user_id HAVING COUNT(*) > 1`,
    )
    .all() as { clerk_user_id: string }[];
  if (duplicates.length === 0) return false;

  const transaction = db.transaction(() => {
    for (const { clerk_user_id } of duplicates) {
      const keep = db
        .prepare(
          `SELECT id FROM game_accounts
            WHERE clerk_user_id = ? AND is_active = 1
            ORDER BY id ASC LIMIT 1`,
        )
        .get(clerk_user_id) as { id: number };
      db.prepare(
        `UPDATE game_accounts SET is_active = 0
          WHERE clerk_user_id = ? AND is_active = 1 AND id != ?`,
      ).run(clerk_user_id, keep.id);
    }
  });
  transaction();
  console.warn(
    `[wor schema] Repaired duplicate active accounts for ${duplicates.length} user(s) before creating idx_game_accounts_single_active`,
  );
  return true;
}

export function ensureSingleActiveAccountIndex(db: Database.Database): void {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='game_accounts'")
    .get();
  if (!row) return;

  repairDuplicateActiveAccounts(db);

  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_game_accounts_single_active
         ON game_accounts(clerk_user_id) WHERE is_active = 1`,
    );
  } catch (error) {
    throw new Error(
      `Failed to create idx_game_accounts_single_active: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function resetWorSchema(db: Database.Database, confirmReset: boolean): void {
  if (!confirmReset) return;
  db.pragma('foreign_keys = ON');
  db.exec(`
    DROP TABLE IF EXISTS account_demons;
    DROP TABLE IF EXISTS account_artifacts;
    DROP TABLE IF EXISTS account_heroes;
    DROP TABLE IF EXISTS game_accounts;
    DROP TABLE IF EXISTS import_runs;
    DROP TABLE IF EXISTS import_lease;
    DROP TABLE IF EXISTS catalog_meta;
    DROP TABLE IF EXISTS catalog_demons;
    DROP TABLE IF EXISTS catalog_artifacts;
    DROP TABLE IF EXISTS catalog_heroes;
  `);
  ensureWorCoreTables(db);
  ensureSingleActiveAccountIndex(db);
}

export function createSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  ensureWorCoreTables(db);
  ensureSingleActiveAccountIndex(db);
}

const { getDb, closeDb } = createDbSingleton(WOR_DB_PATH, {
  onOpen: (db: Database.Database) => {
    ensureWorCoreTables(db);
    ensureSingleActiveAccountIndex(db);
  },
});
export { getDb, closeDb };

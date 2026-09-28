import { log } from '@codex/core';
import type Database from 'better-sqlite3';

import { getCatalogDb } from './connection.js';

export const USER_TABLE_NAMES = [
  'build_favorites',
  'loadout_builds',
  'loadouts',
  'builds',
] as const;

const CATALOG_TABLE_DELETE_ORDER = [
  'mod_set_members',
  'mod_level_stats',
  'mods',
  'mod_sets',
  'abilities',
  'warframes',
  'weapons',
  'companions',
  'arcanes',
  'archon_shard_buffs',
  'archon_shard_types',
  'warframe_market_links',
  'import_lease',
  'import_runs',
] as const;

const ALLOWED_TABLE_NAMES = new Set<string>([...USER_TABLE_NAMES, ...CATALOG_TABLE_DELETE_ORDER]);

function isAllowedTableName(table: string): boolean {
  return ALLOWED_TABLE_NAMES.has(table);
}

function tableExists(db: Database.Database, table: string): boolean {
  if (!isAllowedTableName(table)) return false;
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  return row != null;
}

function deleteTableRows(db: Database.Database, table: string): number {
  if (!isAllowedTableName(table) || !tableExists(db, table)) return 0;
  const before = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
  db.prepare(`DELETE FROM ${table}`).run();
  return before.c;
}

export function resetCatalogData(db: Database.Database = getCatalogDb()): Record<string, number> {
  const cleared: Record<string, number> = {};

  for (const table of USER_TABLE_NAMES) {
    if (tableExists(db, table)) {
      const count = (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
      if (count > 0) {
        throw new Error(
          `[Database] Refusing catalog reset: user table "${table}" has ${count} row(s). ` +
            'Use WARFRAME_CATALOG_DB_PATH for catalog only; collection data lives in WARFRAME_DB_PATH.',
        );
      }
    }
  }

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (const table of CATALOG_TABLE_DELETE_ORDER) {
      const deleted = deleteTableRows(db, table);
      if (deleted > 0) {
        cleared[table] = deleted;
        log('info', `[Database] Catalog reset: cleared ${deleted} row(s) from ${table}`);
      }
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }

  return cleared;
}

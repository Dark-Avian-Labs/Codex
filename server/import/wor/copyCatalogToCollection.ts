import { log } from '@codex/core';
import type Database from 'better-sqlite3';

import { getCatalogCounts } from './catalogQueries.js';

const CATALOG_COPY_TABLES = [
  'catalog_heroes',
  'catalog_artifacts',
  'catalog_demons',
  'catalog_meta',
] as const;

function copyCatalogTables(
  source: Database.Database,
  dest: Database.Database,
): { heroes: number; artifacts: number; demons: number } {
  if (source === dest) {
    return getCatalogCounts(dest);
  }

  dest.transaction(() => {
    for (const table of CATALOG_COPY_TABLES) {
      const cols = source.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (cols.length === 0) continue;
      const colNames = cols.map((col) => col.name).join(', ');
      const rows = source.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      dest.prepare(`DELETE FROM ${table}`).run();
      if (rows.length === 0) continue;
      const placeholders = cols.map(() => '?').join(', ');
      const insert = dest.prepare(`INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`);
      for (const row of rows) {
        insert.run(...cols.map((col) => row[col.name]));
      }
    }
  })();

  return getCatalogCounts(dest);
}

export function copyWorCatalogToCollection(
  catalogDb: Database.Database,
  appDb: Database.Database,
): { heroes: number; artifacts: number; demons: number } {
  const counts = copyCatalogTables(catalogDb, appDb);
  log('info', 'Copied WoR catalog tables into collection DB', counts);
  return counts;
}

export function seedWorCatalogFromCollectionIfEmpty(
  catalogDb: Database.Database,
  appDb: Database.Database,
): boolean {
  if (catalogDb === appDb) return false;
  const catalogHeroes = (
    catalogDb.prepare('SELECT COUNT(*) as c FROM catalog_heroes').get() as { c: number }
  ).c;
  if (catalogHeroes > 0) return false;
  const appHeroes = (
    appDb.prepare('SELECT COUNT(*) as c FROM catalog_heroes').get() as { c: number }
  ).c;
  if (appHeroes === 0) return false;

  const counts = copyCatalogTables(appDb, catalogDb);
  log('info', 'Seeded WoR catalog DB from existing collection catalog tables', counts);
  return true;
}

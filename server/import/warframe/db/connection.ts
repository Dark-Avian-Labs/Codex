import Database from 'better-sqlite3';

import { WARFRAME_CATALOG_DB_PATH } from '../../../config.js';

let catalogDb: Database.Database | null = null;

function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

export function getCatalogDb(): Database.Database {
  if (!catalogDb) {
    catalogDb = openDatabase(WARFRAME_CATALOG_DB_PATH);
  }
  return catalogDb;
}

export function closeCatalogDb(): void {
  if (catalogDb) {
    catalogDb.close();
    catalogDb = null;
  }
}

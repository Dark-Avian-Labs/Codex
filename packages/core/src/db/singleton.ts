import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { DEFAULT_SQLITE_PRAGMAS } from './sqlitePragmas.js';

export interface DbSingletonOptions {
  pragmas?: string[];
  onOpen?: (db: Database.Database) => void;
}

export interface DbSingleton {
  getDb(): Database.Database;
  closeDb(): void;
}

export function createDbSingleton(dbPath: string, options?: DbSingletonOptions): DbSingleton {
  let instance: Database.Database | null = null;

  function getDb(): Database.Database {
    if (instance) return instance;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    const originalClose = db.close.bind(db);
    db.close = ((...args: Parameters<typeof originalClose>) => {
      const result = originalClose(...args);
      instance = null;
      return result;
    }) as typeof db.close;
    try {
      db.pragma('foreign_keys = ON');
      for (const p of DEFAULT_SQLITE_PRAGMAS) {
        db.pragma(p);
      }
      if (options?.pragmas) {
        for (const p of options.pragmas) {
          db.pragma(p);
        }
      }
      options?.onOpen?.(db);
    } catch (err) {
      db.close();
      throw err;
    }
    instance = db;
    return db;
  }

  function closeDb(): void {
    if (instance) {
      instance.close();
    }
  }

  return { getDb, closeDb };
}

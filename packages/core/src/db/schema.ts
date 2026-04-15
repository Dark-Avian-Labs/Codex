import Database from 'better-sqlite3';

import { CENTRAL_DB_PATH } from '../config.js';

let centralDb: Database.Database | null = null;

export function createCentralSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_game_access (
      user_id INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, game_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
  `);
}

export function getCentralDb(): Database.Database {
  if (centralDb) {
    return centralDb;
  }
  let opened: Database.Database | undefined;
  try {
    opened = new Database(CENTRAL_DB_PATH);
    opened.pragma('foreign_keys = ON');
    const result = opened.prepare('PRAGMA journal_mode = WAL;').get() as
      | { journal_mode?: string }
      | undefined;
    if (result?.journal_mode?.toLowerCase() !== 'wal') {
      throw new Error(`Unexpected journal_mode: ${result?.journal_mode ?? 'unknown'}`);
    }
    centralDb = opened;
  } catch (error) {
    console.error('Failed to open central DB or enable WAL mode:', error);
    if (opened) {
      const dbToClose = opened;
      opened = undefined;
      if (typeof dbToClose.close === 'function') {
        dbToClose.close();
      }
    }
    throw error;
  }
  return centralDb;
}

export function closeCentralDb(): void {
  if (centralDb === null) return;
  const db = centralDb;
  centralDb = null;
  try {
    db.close();
  } catch (err) {
    console.error('[closeCentralDb] Error closing central DB:', err);
    throw err;
  }
}

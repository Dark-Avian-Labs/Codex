import Database from 'better-sqlite3';

import { SESSION_DB_PATH } from '../config.js';

let sessionDb: Database.Database | null = null;

export function createSessionSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
  `);
}

export function getSessionDb(): Database.Database {
  if (sessionDb) {
    return sessionDb;
  }
  let opened: Database.Database | undefined;
  try {
    opened = new Database(SESSION_DB_PATH);
    opened.pragma('foreign_keys = ON');
    const result = opened.prepare('PRAGMA journal_mode = WAL;').get() as
      | { journal_mode?: string }
      | undefined;
    if (result?.journal_mode?.toLowerCase() !== 'wal') {
      throw new Error(`Unexpected journal_mode: ${result?.journal_mode ?? 'unknown'}`);
    }
    sessionDb = opened;
  } catch (error) {
    console.error('Failed to open session DB or enable WAL mode:', error);
    if (opened) {
      const dbToClose = opened;
      opened = undefined;
      if (typeof dbToClose.close === 'function') {
        dbToClose.close();
      }
    }
    throw error;
  }
  return sessionDb;
}

export function closeSessionDb(): void {
  if (sessionDb === null) return;
  const db = sessionDb;
  sessionDb = null;
  try {
    db.close();
  } catch (err) {
    console.error('[closeSessionDb] Error closing session DB:', err);
    throw err;
  }
}

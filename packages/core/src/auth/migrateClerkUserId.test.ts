import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { ensureClerkUserIdColumn, LEGACY_USER_ID_TO_CLERK } from './migrateClerkUserId.js';

function createLegacyWorksheetsDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE worksheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, name)
    );
    INSERT INTO worksheets (user_id, name, display_order) VALUES (4, 'Warframes', 0);
  `);
  return db;
}

describe('ensureClerkUserIdColumn', () => {
  it('migrates legacy worksheets to clerk_user_id-only schema', () => {
    const db = createLegacyWorksheetsDb();

    ensureClerkUserIdColumn(db, 'worksheets');

    expect(tableColumns(db, 'worksheets')).toEqual(['id', 'clerk_user_id', 'name', 'display_order']);
    const row = db.prepare('SELECT clerk_user_id, name FROM worksheets WHERE name = ?').get('Warframes') as {
      clerk_user_id: string;
      name: string;
    };
    expect(row.clerk_user_id).toBe(LEGACY_USER_ID_TO_CLERK[4]);

    const insert = db
      .prepare('INSERT INTO worksheets (clerk_user_id, name, display_order) VALUES (?, ?, ?)')
      .run('user_newExample', 'Primary', 1);
    expect(Number(insert.lastInsertRowid)).toBeGreaterThan(0);
    db.close();
  });

  it('completes a partial migration that already added clerk_user_id', () => {
    const db = createLegacyWorksheetsDb();
    db.exec('ALTER TABLE worksheets ADD COLUMN clerk_user_id TEXT');
    db.prepare('UPDATE worksheets SET clerk_user_id = ? WHERE user_id = ?').run(LEGACY_USER_ID_TO_CLERK[4], 4);

    ensureClerkUserIdColumn(db, 'worksheets');

    expect(tableColumns(db, 'worksheets')).toEqual(['id', 'clerk_user_id', 'name', 'display_order']);
    expect(() => {
      db.prepare('INSERT INTO worksheets (clerk_user_id, name, display_order) VALUES (?, ?, ?)').run(
        'user_newExample',
        'Secondary',
        2,
      );
    }).not.toThrow();
    db.close();
  });
});

function tableColumns(db: Database.Database, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]).map((col) => col.name);
}

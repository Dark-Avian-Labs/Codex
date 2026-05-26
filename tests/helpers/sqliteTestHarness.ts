import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';

import { createDbSingleton } from '../../packages/core/src/db/singleton.js';
import {
  createSchema,
  ensureWarframeAdvancedProgressTable,
} from '../../packages/games/warframe/src/db/schema.js';

export type WarframeTestDb = {
  db: Database.Database;
  closeDb: () => void;
  dbPath: string;
  tmpDir: string;
};

export type WarframeFixture = {
  worksheetId: number;
  columnId: number;
  rowId: number;
  clerkUserId: string;
};

export function createTempDbDir(prefix = 'codex-test-'): { tmpDir: string; dbPath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(tmpDir, 'test.db');
  return { tmpDir, dbPath };
}

export function createWarframeTestDb(dbPath: string): WarframeTestDb {
  const tmpDir = path.dirname(dbPath);
  const { getDb, closeDb } = createDbSingleton(dbPath, {
    onOpen: (db) => {
      createSchema(db, true);
      ensureWarframeAdvancedProgressTable(db);
    },
  });
  return { db: getDb(), closeDb, dbPath, tmpDir };
}

export function seedMinimalWarframeFixture(
  db: Database.Database,
  clerkUserId = 'user_test',
): WarframeFixture {
  const worksheet = db
    .prepare('INSERT INTO worksheets (clerk_user_id, name, display_order) VALUES (?, ?, ?)')
    .run(clerkUserId, 'Warframes', 0);
  const worksheetId = Number(worksheet.lastInsertRowid);
  const column = db
    .prepare('INSERT INTO columns (worksheet_id, name, display_order) VALUES (?, ?, ?)')
    .run(worksheetId, 'Obtained', 0);
  const columnId = Number(column.lastInsertRowid);
  const row = db
    .prepare('INSERT INTO rows (worksheet_id, item_name, display_order) VALUES (?, ?, ?)')
    .run(worksheetId, 'Excalibur', 0);
  const rowId = Number(row.lastInsertRowid);
  return { worksheetId, columnId, rowId, clerkUserId };
}

export function removeTempDbDir(tmpDir: string): void {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

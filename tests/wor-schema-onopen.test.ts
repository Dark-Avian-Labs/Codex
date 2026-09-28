import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { createCatalogSchema, createSchema } from '../packages/games/wor/src/db/schema.js';

describe('WoR schema bootstrap', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function openEmptyDb(): Database.Database {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-wor-schema-'));
    tmpDirs.push(tmpDir);
    return new Database(path.join(tmpDir, 'empty.db'));
  }

  it('createCatalogSchema creates required tables on an empty file', () => {
    const db = openEmptyDb();
    createCatalogSchema(db);
    for (const table of [
      'catalog_heroes',
      'catalog_artifacts',
      'catalog_demons',
      'catalog_meta',
      'import_runs',
      'import_lease',
    ]) {
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)).toBeTruthy();
    }
    db.close();
  });

  it('createSchema creates collection tables on an empty file', () => {
    const db = openEmptyDb();
    createSchema(db);
    for (const table of ['catalog_heroes', 'game_accounts', 'account_heroes', 'account_artifacts', 'account_demons']) {
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)).toBeTruthy();
    }
    db.close();
  });
});

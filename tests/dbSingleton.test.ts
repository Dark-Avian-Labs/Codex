import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDbSingleton } from '../packages/core/src/db/singleton.js';

let sqliteNativeAvailable = false;
try {
  const mod = await import('better-sqlite3');
  const Database = mod.default ?? mod;
  const probe = new Database(':memory:');
  probe.close();
  sqliteNativeAvailable = true;
} catch {
  sqliteNativeAvailable = false;
}

describe.skipIf(!sqliteNativeAvailable)('createDbSingleton', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-test-'));
    dbPath = path.join(tmpDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the same instance on repeated getDb() calls', () => {
    const { getDb, closeDb } = createDbSingleton(dbPath);
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
    closeDb();
  });

  it('enables foreign_keys by default', () => {
    const { getDb, closeDb } = createDbSingleton(dbPath);
    const db = getDb();
    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0]?.foreign_keys).toBe(1);
    closeDb();
  });

  it('applies custom pragmas', () => {
    const { getDb, closeDb } = createDbSingleton(dbPath, {
      pragmas: ['journal_mode = WAL'],
    });
    const db = getDb();
    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    expect(result[0]?.journal_mode).toBe('wal');
    closeDb();
  });

  it('calls onOpen callback once with the db instance', () => {
    const onOpen = vi.fn();
    const { getDb, closeDb } = createDbSingleton(dbPath, { onOpen });
    const db = getDb();
    getDb();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(db);
    expect(onOpen.mock.calls[0]![0]).toBe(db);
    closeDb();
  });

  it('resets singleton after closeDb()', () => {
    const { getDb, closeDb } = createDbSingleton(dbPath);
    const a = getDb();
    closeDb();
    const b = getDb();
    expect(a).not.toBe(b);
    closeDb();
  });

  it('resets singleton when db.close() is called directly', () => {
    const { getDb } = createDbSingleton(dbPath);
    const a = getDb();
    a.close();
    const b = getDb();
    expect(a).not.toBe(b);
    b.close();
  });
});

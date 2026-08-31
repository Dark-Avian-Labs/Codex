import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import {
  requireWorImportLease,
  tryAcquireWorImportLease,
  WorImportLeaseLostError,
} from '../server/import/wor/importLease.js';
import { applyWorCatalogMutation } from '../server/import/wor/startupPipeline.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, removeTempDbDir } from './helpers/sqliteTestHarness.js';

describeWithSqlite('WoR import lease writes', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    const paths = createTempDbDir('wor-import-lease-');
    tmpDir = paths.tmpDir;
    db = new Database(paths.dbPath);
    createWorSchema(db);
  });

  afterEach(() => {
    db.close();
    removeTempDbDir(tmpDir);
  });

  it('does not mutate catalog after the lease token is replaced', () => {
    const token = tryAcquireWorImportLease(db, null);
    expect(token).toBeTruthy();
    const watch = { lost: false };

    requireWorImportLease(db, token!, watch);
    applyWorCatalogMutation(db, {
      heroes: [{ slug: 'lian', name: 'Lian', class: 'marksman', faction: 'watchguard', rarity: 'legendary' }],
      artifacts: [],
      demons: [],
    });

    db.prepare('UPDATE import_lease SET lock_token = ? WHERE id = 1').run('stolen');
    expect(() => {
      requireWorImportLease(db, token!, watch);
      applyWorCatalogMutation(db, {
        heroes: [{ slug: 'hex', name: 'Hex', class: 'fighter', faction: 'chaos_dominion', rarity: 'legendary' }],
        artifacts: [],
        demons: [],
      });
    }).toThrow(WorImportLeaseLostError);

    const slugs = db.prepare('SELECT slug FROM catalog_heroes ORDER BY slug').all() as Array<{ slug: string }>;
    expect(slugs.map((row) => row.slug)).toEqual(['lian']);
  });
});

import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { createSchema as createWorSchema } from '../packages/games/wor/src/db/schema.js';
import { importFandomHeroStats } from '../server/import/wor/fandomHeroStats.js';
import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import { createTempDbDir, removeTempDbDir } from './helpers/sqliteTestHarness.js';

describeWithSqlite('importFandomHeroStats progress', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    const paths = createTempDbDir('wor-hero-stats-');
    tmpDir = paths.tmpDir;
    db = new Database(paths.dbPath);
    createWorSchema(db);
  });

  afterEach(() => {
    db.close();
    removeTempDbDir(tmpDir);
  });

  it('logs 1 / 10 / N cadence while applying cached stats', async () => {
    const insert = db.prepare(
      `INSERT INTO catalog_heroes (
        slug, name, class, faction, rarity, star_rating, is_lord, is_regular, is_ancient, is_limited, display_order, active
      ) VALUES (?, ?, 'mage', 'watchguard', 'legendary', 5, 0, 1, 0, 0, ?, 1)`,
    );
    for (let index = 1; index <= 21; index += 1) {
      insert.run(`hero-${index}`, `Hero ${index}`, index);
    }

    const lines: string[] = [];
    const summary = await importFandomHeroStats({
      db,
      live: false,
      onLog: (message) => lines.push(message),
    });

    expect(summary).toEqual({ updated: 0, skipped: 0, missing: 21, failed: 0 });
    expect(lines).toContain('Fetching 21 hero infoboxes (cache)…');
    expect(lines.filter((line) => line.startsWith('Hero stats '))).toEqual([
      'Hero stats 1/21 — Hero 1: 0 updated, 1 missing, 0 failed.',
      'Hero stats 10/21 — Hero 10: 0 updated, 10 missing, 0 failed.',
      'Hero stats 20/21 — Hero 20: 0 updated, 20 missing, 0 failed.',
      'Hero stats 21/21 — Hero 21: 0 updated, 21 missing, 0 failed.',
    ]);
  });
});

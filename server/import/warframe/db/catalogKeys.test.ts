import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { catalogArmoryKeyForArchonBuff } from './catalogKeys.js';

describe('catalogKeys', () => {
  it('builds canonical Common archon key from color and sort order', () => {
    expect(catalogArmoryKeyForArchonBuff('Crimson', 4)).toBe('/Armory/Archon/Crimson/Common/AbilityStrength');
  });
});

describe('backfillArchonBuffArmoryKeys', () => {
  let db: Database.Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('sets armory_key on buff rows', async () => {
    const { backfillArchonBuffArmoryKeys } = await import('./catalogKeys.js');
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE archon_shard_types (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE archon_shard_buffs (
        id INTEGER PRIMARY KEY,
        shard_type_id INTEGER,
        sort_order INTEGER,
        armory_key TEXT
      );
      INSERT INTO archon_shard_types (id, name) VALUES (1, 'Violet');
      INSERT INTO archon_shard_buffs (id, shard_type_id, sort_order) VALUES (1, 1, 4);
    `);
    const n = backfillArchonBuffArmoryKeys(db);
    expect(n).toBe(1);
    const row = db.prepare('SELECT armory_key FROM archon_shard_buffs WHERE id = 1').get() as {
      armory_key: string;
    };
    expect(row.armory_key).toBe('/Armory/Archon/Violet/Common/Equilibrium');
  });
});

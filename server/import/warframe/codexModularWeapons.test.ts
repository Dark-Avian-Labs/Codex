import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  codexDisplayNameForModularWeapon,
  isCodexModularTrackableWeapon,
  syncCodexModularWeaponsTable,
} from './codexModularWeapons.js';

function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_category TEXT,
      slot INTEGER
    );
    CREATE TABLE codex_modular_weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
  `);
  return db;
}

describe('codexModularWeapons', () => {
  it('tracks MR-granting modular components from current DE export paths', () => {
    expect(
      isCodexModularTrackableWeapon({
        name: 'Catchmoon',
        unique_name:
          '/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart',
      }),
    ).toBe(true);
    expect(
      isCodexModularTrackableWeapon({
        name: 'Balla',
        unique_name: '/Lotus/Weapons/Tenno/Melee/ModularMelee01/Tip/TipOne',
      }),
    ).toBe(true);
    expect(
      isCodexModularTrackableWeapon({
        name: 'Shrewd',
        unique_name: '/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleBPart',
      }),
    ).toBe(false);
    expect(
      isCodexModularTrackableWeapon({
        name: 'Mote Scaffold',
        unique_name: '/Lotus/Weapons/Sentients/OperatorAmplifiers/SentTrainingAmplifier/SentAmpTrainingChassis',
      }),
    ).toBe(false);
  });

  it('maps Mote Prism to the Codex display name Mote Amp', () => {
    expect(codexDisplayNameForModularWeapon('Mote Prism')).toBe('Mote Amp');
  });

  it('syncs deduped display names into codex_modular_weapons', () => {
    const db = createDb();
    db.prepare(`INSERT INTO weapons (unique_name, name, product_category, slot) VALUES (?, ?, 'Pistols', NULL)`).run(
      '/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelCPart',
      'Rattleguts',
    );
    db.prepare(`INSERT INTO weapons (unique_name, name, product_category, slot) VALUES (?, ?, 'Pistols', NULL)`).run(
      '/Lotus/Weapons/Sentients/OperatorAmplifiers/SentTrainingAmplifier/SentAmpTrainingBarrel',
      'Mote Prism',
    );

    const result = syncCodexModularWeaponsTable(db);
    expect(result.names).toEqual(['Mote Amp', 'Rattleguts']);

    const rows = db.prepare(`SELECT name, active FROM codex_modular_weapons ORDER BY display_order`).all() as Array<{
      name: string;
      active: number;
    }>;
    expect(rows).toEqual([
      { name: 'Mote Amp', active: 1 },
      { name: 'Rattleguts', active: 1 },
    ]);
  });
});

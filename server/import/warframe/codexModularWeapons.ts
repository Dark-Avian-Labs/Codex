import type Database from 'better-sqlite3';

export type CodexModularWeaponRow = {
  unique_name: string | null;
  name: string | null;
};

const EXCLUDED_PATH_MARKERS = [
  '/scaffold/',
  '/chassis/',
  '/grip/',
  '/brace/',
  '/handle/',
  '/handles/',
  '/link/',
  '/balance/',
  '/loader/',
  '/clip/',
  '/core/',
] as const;

const CODEX_DISPLAY_NAME_OVERRIDES = new Map<string, string>([['mote prism', 'Mote Amp']]);

export function codexDisplayNameForModularWeapon(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return CODEX_DISPLAY_NAME_OVERRIDES.get(trimmed.toLowerCase()) ?? trimmed;
}

export function isCodexModularTrackableWeapon(row: CodexModularWeaponRow): boolean {
  const name = row.name?.trim() ?? '';
  if (!name) return false;
  if (/\bscaffold\b/i.test(name)) return false;

  const uniqueName = row.unique_name?.toLowerCase() ?? '';
  if (!uniqueName) return false;

  for (const marker of EXCLUDED_PATH_MARKERS) {
    if (uniqueName.includes(marker)) {
      return false;
    }
  }

  if (uniqueName.includes('/solarisunited/') && uniqueName.includes('/barrel/')) {
    return true;
  }
  if (uniqueName.includes('/infkitgun/barrels/')) {
    return true;
  }
  if (uniqueName.includes('/operatoramplifiers/') && uniqueName.includes('/barrel/')) {
    return true;
  }
  if (uniqueName.includes('/senttrainingamplifier/') && uniqueName.includes('barrel')) {
    return true;
  }
  if (
    uniqueName.includes('/modularmelee') &&
    (uniqueName.includes('/tip/') || uniqueName.includes('/tips/'))
  ) {
    return true;
  }

  if (/\bprism\b/i.test(name)) {
    return true;
  }

  return false;
}

export function syncCodexModularWeaponsTable(db: Database.Database): {
  upserted: number;
  names: string[];
} {
  const weaponRows = db
    .prepare(
      `SELECT unique_name, name FROM weapons
       WHERE name IS NOT NULL AND TRIM(name) <> ''`,
    )
    .all() as CodexModularWeaponRow[];

  const byDisplayName = new Map<string, { unique_name: string; name: string }>();
  for (const row of weaponRows) {
    if (!isCodexModularTrackableWeapon(row)) continue;
    const uniqueName = row.unique_name?.trim() ?? '';
    const displayName = codexDisplayNameForModularWeapon(row.name?.trim() ?? '');
    if (!uniqueName || !displayName) continue;
    if (!byDisplayName.has(displayName)) {
      byDisplayName.set(displayName, { unique_name: uniqueName, name: displayName });
    }
  }

  const sorted = [...byDisplayName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  const upsert = db.prepare(
    `INSERT INTO codex_modular_weapons (unique_name, name, display_order)
     VALUES (?, ?, ?)
     ON CONFLICT(unique_name) DO UPDATE SET
       name = excluded.name,
       display_order = excluded.display_order`,
  );
  const activeUniqueNames: string[] = [];
  const tx = db.transaction(() => {
    let order = 0;
    for (const entry of sorted) {
      upsert.run(entry.unique_name, entry.name, order++);
      activeUniqueNames.push(entry.unique_name);
    }
    if (activeUniqueNames.length === 0) {
      db.prepare('UPDATE codex_modular_weapons SET active = 0').run();
    } else {
      const placeholders = activeUniqueNames.map(() => '?').join(', ');
      db.prepare(
        `UPDATE codex_modular_weapons SET active = 0 WHERE unique_name NOT IN (${placeholders})`,
      ).run(...activeUniqueNames);
    }
  });
  tx();

  return {
    upserted: sorted.length,
    names: sorted.map((entry) => entry.name),
  };
}

export function ensureCodexModularWeaponsPopulated(db: Database.Database): number {
  const table = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'codex_modular_weapons'`,
    )
    .get() as { name: string } | undefined;
  if (!table) return 0;

  const row = db
    .prepare('SELECT COUNT(*) as c FROM codex_modular_weapons WHERE active = 1')
    .get() as {
    c: number;
  };
  if (row.c > 0) return row.c;

  const weapons = db.prepare('SELECT COUNT(*) as c FROM weapons').get() as { c: number };
  if (weapons.c === 0) return 0;

  return syncCodexModularWeaponsTable(db).upserted;
}

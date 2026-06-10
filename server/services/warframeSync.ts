import { warframeQueries as q } from '@codex/game-warframe';
import {
  arcaneMaxRankFromLevelStats,
  isPrimeVariantName,
  normalizeDisplayName,
  normalizeNameForKey,
  resolveCanonicalKey as resolveCanonicalKeyWithAliases,
  resolveVariantColumns,
  stripPrimeSuffix,
  warframeMarketSellHrefUsesPrimeOnlyItemSlug,
  type VariantColumns,
} from '@codex/game-warframe';
import Database from 'better-sqlite3';

import { ARMORY_DB_PATH } from '../config.js';

const WORKSHEET_NAMES = [
  'Warframes',
  'Primary Weapons',
  'Secondary Weapons',
  'Melee Weapons',
  'Modular Weapons',
  'K-Drives',
  'Companions',
  'Companion Weapons',
  'Archwing Weapons',
  'Accessories',
  'Arcanes',
] as const;

type WorksheetName = (typeof WORKSHEET_NAMES)[number];

const DISCARDED_ROWS = new Set([
  'Drifter',
  'Operator',
  "Sevagoth's Shadow",
  'Stalker',
  'Suda Specter',
]);

const PRIME_ONLY_UNAVAILABLE = new Map<string, WorksheetName>([
  ['Gotva', 'Primary Weapons'],
  ['Vadarya', 'Primary Weapons'],
  ['Euphona', 'Secondary Weapons'],
  ['Sagek', 'Secondary Weapons'],
  ['Dakra', 'Melee Weapons'],
  ['Galariak', 'Melee Weapons'],
  ['Reaper', 'Melee Weapons'],
]);

const KEPT_SPECIAL_ROWS = new Map<
  string,
  {
    worksheet: WorksheetName;
    hasPrimeVariant: boolean;
  }
>([
  ['Lizzie', { worksheet: 'Primary Weapons', hasPrimeVariant: false }],
  ['Pangolin', { worksheet: 'Melee Weapons', hasPrimeVariant: true }],
  ['Vinquibus (Melee)', { worksheet: 'Melee Weapons', hasPrimeVariant: false }],
  ['Mote Amp', { worksheet: 'Modular Weapons', hasPrimeVariant: false }],
  ['Crescent Vulpaphyla', { worksheet: 'Companions', hasPrimeVariant: false }],
  ['Panzer Vulpaphyla', { worksheet: 'Companions', hasPrimeVariant: false }],
  ['Sly Vulpaphyla', { worksheet: 'Companions', hasPrimeVariant: false }],
  ['Vizier Predasite', { worksheet: 'Companions', hasPrimeVariant: false }],
  ['Medjay Predasite', { worksheet: 'Companions', hasPrimeVariant: false }],
  ['Pharaoh Predasite', { worksheet: 'Companions', hasPrimeVariant: false }],
  ['Arquebex', { worksheet: 'Archwing Weapons', hasPrimeVariant: false }],
  ['Ironbride', { worksheet: 'Archwing Weapons', hasPrimeVariant: false }],
]);

const MATCH_NAME_ALIASES = new Map<string, string>([
  ['pangolin', 'pangolin sword'],
  ['prime laser rifle', 'laser rifle'],
  ['venari prime claws', 'venari claws'],
  ['venani prime claws', 'venari claws'],
]);

const SPECIAL_PRIME_VARIANT_BASE_NAME = new Map<string, string>([
  ['prime laser rifle', 'Laser Rifle'],
  ['venari prime claws', 'Venari Claws'],
  ['venani prime claws', 'Venari Claws'],
]);

const K_DRIVE_NAME_WHITELIST = new Set([
  'bad baby',
  'feverspine',
  'flatbelly',
  'needlenose',
  'runway',
]);

type DesiredEntry = {
  displayName: string;
  hasBaseVariant: boolean;
  hasPrimeVariant: boolean;
};

export type WorksheetSyncResult = {
  worksheet: WorksheetName;
  added: string[];
  deleted: string[];
  markedUnavailable: string[];
  mismatched: number[];
};

export type UserSyncResult = {
  clerkUserId: string;
  worksheets: WorksheetSyncResult[];
};

export type WarframeSyncResult = {
  mode: 'preview' | 'execute';
  users: UserSyncResult[];
  summary: {
    added: number;
    deleted: number;
    markedUnavailable: number;
    mismatched: number;
  };
  cleanup: {
    deleted: number;
    requiresConfirmation: number;
    deletedRows: CleanupCandidate[];
    requiresConfirmationRows: CleanupCandidate[];
  };
  marketLinkSync: WarframeMarketLinkSyncSummary;
};

export type WarframeMarketLinkSyncSummary =
  | { ran: false }
  | {
      ran: true;
      rowsProcessed: number;
      rowsWithLink: number;
      failedWorksheets: Array<{ clerkUserId: string; worksheet: WorksheetName }>;
    };

type CleanupCandidate = {
  clerkUserId: string;
  worksheet: WorksheetName;
  rowId: number;
  itemName: string;
  canonicalKey: string;
};

function resolveCanonicalKey(value: string): string {
  return resolveCanonicalKeyWithAliases(value, MATCH_NAME_ALIASES);
}

type MarketHrefRefreshResult =
  | { ok: true; rowsProcessed: number; rowsWithHref: number }
  | { ok: false; error: string };

function getSpecialPrimeVariantBaseName(value: string): string | undefined {
  return SPECIAL_PRIME_VARIANT_BASE_NAME.get(normalizeNameForKey(value));
}

function stripKitgunPrimarySuffix(value: string): string {
  return value.replace(/\s*\(primary\)\s*$/i, '').trim();
}

function loadNames(db: Database.Database, sql: string, args: unknown[] = []): string[] {
  const rows = db.prepare(sql).all(...args) as { name: string | null }[];
  return rows.map((row) => row.name?.trim() ?? '').filter((name) => name.length > 0);
}

type WeaponSourceRow = {
  name: string | null;
  unique_name: string | null;
};

const CODEX_MODULAR_EXCLUDED_PATH_MARKERS = [
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

function codexDisplayNameForModularWeapon(name: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'mote prism') return 'Mote Amp';
  return trimmed;
}

function isCodexModularTrackableWeapon(row: WeaponSourceRow): boolean {
  const name = row.name?.trim() ?? '';
  if (!name) return false;
  if (/\bscaffold\b/i.test(name)) return false;

  const uniqueName = row.unique_name?.toLowerCase() ?? '';
  if (!uniqueName) return false;

  for (const marker of CODEX_MODULAR_EXCLUDED_PATH_MARKERS) {
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

  return /\bprism\b/i.test(name);
}

function armoryHasCodexModularWeaponsTable(armoryDb: Database.Database): boolean {
  const row = armoryDb
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'codex_modular_weapons'`,
    )
    .get() as { name: string } | undefined;
  return row !== undefined;
}

function loadModularWeaponNamesFromCatalogTable(armoryDb: Database.Database): Set<string> {
  const rows = armoryDb
    .prepare(
      `SELECT name FROM codex_modular_weapons
       WHERE active = 1 AND name IS NOT NULL AND TRIM(name) <> ''
       ORDER BY display_order`,
    )
    .all() as { name: string | null }[];
  return new Set(rows.map((row) => row.name?.trim() ?? '').filter((name) => name.length > 0));
}

function loadModularWeaponNamesFromWeaponsTable(armoryDb: Database.Database): Set<string> {
  const modularRows = armoryDb
    .prepare(
      `SELECT name, unique_name FROM weapons
       WHERE name IS NOT NULL AND TRIM(name) <> ''`,
    )
    .all() as WeaponSourceRow[];
  const names = new Set<string>();
  for (const row of modularRows) {
    if (!isCodexModularTrackableWeapon(row)) continue;
    const displayName = codexDisplayNameForModularWeapon(row.name?.trim() ?? '');
    if (displayName) {
      names.add(displayName);
    }
  }
  return names;
}

function loadModularWeaponNames(armoryDb: Database.Database): Set<string> {
  if (armoryHasCodexModularWeaponsTable(armoryDb)) {
    const names = loadModularWeaponNamesFromCatalogTable(armoryDb);
    if (names.size > 0) {
      return names;
    }
  }
  return loadModularWeaponNamesFromWeaponsTable(armoryDb);
}

function isCompanionModularMainComponent(row: WeaponSourceRow): boolean {
  const uniqueName = row.unique_name?.toLowerCase() ?? '';
  if (!uniqueName) return false;

  const isMoaHead = uniqueName.includes('/moapetparts/') && uniqueName.includes('/moapethead');
  if (isMoaHead) return true;

  const isHoundHead =
    uniqueName.includes('/zanukapetparts/') && uniqueName.includes('/zanukapetparthead');
  if (isHoundHead) return true;

  return false;
}

function loadCompanionNames(armoryDb: Database.Database): Set<string> {
  const companionNames = new Set(
    loadNames(armoryDb, "SELECT name FROM companions WHERE name IS NOT NULL AND TRIM(name) <> ''"),
  );
  const modularCompanionRows = armoryDb
    .prepare(
      "SELECT name, unique_name FROM weapons WHERE product_category = 'Pistols' AND slot IS NULL AND name IS NOT NULL AND unique_name IS NOT NULL AND (LOWER(unique_name) LIKE '%/moapetparts/%' OR LOWER(unique_name) LIKE '%/zanukapetparts/%')",
    )
    .all() as WeaponSourceRow[];
  for (const row of modularCompanionRows) {
    if (!isCompanionModularMainComponent(row)) continue;
    const name = row.name?.trim() ?? '';
    if (name) {
      companionNames.add(name);
    }
  }
  return companionNames;
}

const UNRELEASED_ARCANE_UNIQUE_NAME =
  '/Lotus/Upgrades/CosmeticEnhancers/Utility/SlowerBleedOutOnPredeath';

function loadArcaneCatalog(armoryDb: Database.Database): {
  names: Set<string>;
  maxLevelByCanonicalKey: Map<string, number>;
} {
  const rows = armoryDb
    .prepare(
      `SELECT name, level_stats FROM arcanes
       WHERE unique_name NOT LIKE '%Sub'
         AND unique_name != ?
         AND name IS NOT NULL AND TRIM(name) <> ''
       ORDER BY name`,
    )
    .all(UNRELEASED_ARCANE_UNIQUE_NAME) as Array<{
    name: string | null;
    level_stats: string | null;
  }>;
  const names = new Set<string>();
  const maxLevelByCanonicalKey = new Map<string, number>();
  for (const row of rows) {
    const displayName = normalizeDisplayName(row.name?.trim() ?? '');
    if (!displayName) continue;
    const key = resolveCanonicalKey(displayName);
    if (!key) continue;
    const maxLevel = arcaneMaxRankFromLevelStats(row.level_stats);
    names.add(displayName);
    const existing = maxLevelByCanonicalKey.get(key);
    if (existing === undefined || maxLevel > existing) {
      maxLevelByCanonicalKey.set(key, maxLevel);
    }
  }
  return { names, maxLevelByCanonicalKey };
}

function loadKDriveNames(armoryDb: Database.Database): Set<string> {
  const kDriveRows = armoryDb
    .prepare(
      "SELECT name, unique_name FROM weapons WHERE name IS NOT NULL AND TRIM(name) <> '' AND (LOWER(product_category) LIKE '%hoverboard%' OR LOWER(unique_name) LIKE '%/types/vehicles/hoverboard/%')",
    )
    .all() as WeaponSourceRow[];
  const names = new Set<string>();
  for (const row of kDriveRows) {
    const displayName = normalizeDisplayName(row.name?.trim() ?? '');
    if (!displayName) continue;
    if (!K_DRIVE_NAME_WHITELIST.has(normalizeNameForKey(displayName))) continue;
    names.add(displayName);
  }
  return names;
}

function ensureWorksheetExistsForSync(
  codexDb: Database.Database,
  clerkUserId: string,
  worksheet: WorksheetName,
  execute: boolean,
): { id: number; name: string; display_order: number } | undefined {
  const existing = q.getWorksheetByName(codexDb, clerkUserId, worksheet);
  if (existing) return existing;
  if (!execute) return undefined;

  const existingWorksheets = q.getWorksheets(codexDb, clerkUserId);
  const displayOrder =
    existingWorksheets.reduce(
      (maxOrder, sheet) => Math.max(maxOrder, sheet.display_order ?? Number.MIN_SAFE_INTEGER),
      -1,
    ) + 1;
  const worksheetId = q.createWorksheet(codexDb, clerkUserId, worksheet, displayOrder);
  q.addColumn(codexDb, worksheetId, clerkUserId, 'Normal', 0);
  if (worksheet !== 'Arcanes') {
    q.addColumn(codexDb, worksheetId, clerkUserId, 'Prime', 1);
  }
  if (worksheet === 'Warframes') {
    q.addColumn(codexDb, worksheetId, clerkUserId, 'Helminth', 2);
  }
  return q.getWorksheetByName(codexDb, clerkUserId, worksheet);
}

export function ensureWarframeWorksheetsForUser(
  codexDb: Database.Database,
  clerkUserId: string,
): void {
  for (const worksheet of WORKSHEET_NAMES) {
    ensureWorksheetExistsForSync(codexDb, clerkUserId, worksheet, true);
  }
}

type WorksheetSourceBundle = {
  sourceByWorksheet: Record<WorksheetName, Set<string>>;
  arcaneMaxLevelByCanonicalKey: Map<string, number>;
};

function loadWorksheetSource(armoryDb: Database.Database): WorksheetSourceBundle {
  const warframes = new Set(
    loadNames(armoryDb, "SELECT name FROM warframes WHERE product_category = 'Suits'"),
  );
  const accessories = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM warframes WHERE product_category IN ('SpaceSuits', 'MechSuits')",
    ),
  );
  const primary = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'LongGuns' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const secondary = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'Pistols' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const melee = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'Melee' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const archwing = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category IN ('SpaceGuns', 'SpaceMelee') AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const companionWeapons = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'SentinelWeapons' AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  const modular = loadModularWeaponNames(armoryDb);
  const kDrives = loadKDriveNames(armoryDb);
  const companions = loadCompanionNames(armoryDb);
  const arcanes = loadArcaneCatalog(armoryDb);

  return {
    sourceByWorksheet: {
      Warframes: warframes,
      Accessories: accessories,
      'Primary Weapons': primary,
      'Secondary Weapons': secondary,
      'Melee Weapons': melee,
      'K-Drives': kDrives,
      Companions: companions,
      'Companion Weapons': companionWeapons,
      'Archwing Weapons': archwing,
      'Modular Weapons': modular,
      Arcanes: arcanes.names,
    },
    arcaneMaxLevelByCanonicalKey: arcanes.maxLevelByCanonicalKey,
  };
}

function appendCurrentSpecialItemPlacements(
  sourceByWorksheet: Record<WorksheetName, Set<string>>,
  currentRowsByWorksheet: Map<WorksheetName, string[]>,
  armoryDb: Database.Database,
): void {
  const specialNames = new Set(
    loadNames(
      armoryDb,
      "SELECT name FROM weapons WHERE product_category = 'SpecialItems' AND name IS NOT NULL AND slot IS NOT NULL AND TRIM(slot) <> ''",
    ),
  );
  for (const worksheet of ['Primary Weapons', 'Secondary Weapons', 'Melee Weapons'] as const) {
    for (const rowName of currentRowsByWorksheet.get(worksheet) ?? []) {
      if (specialNames.has(rowName)) {
        sourceByWorksheet[worksheet].add(rowName);
      }
    }
  }
}

function cloneWorksheetSource(
  sourceByWorksheet: Record<WorksheetName, Set<string>>,
): Record<WorksheetName, Set<string>> {
  const cloned = {} as Record<WorksheetName, Set<string>>;
  for (const worksheet of WORKSHEET_NAMES) {
    cloned[worksheet] = new Set(sourceByWorksheet[worksheet]);
  }
  return cloned;
}

function createDesiredEntries(
  worksheet: WorksheetName,
  sourceNames: Set<string>,
): Map<string, DesiredEntry> {
  const desired = new Map<string, DesiredEntry>();
  for (const sourceName of sourceNames) {
    const displayName = normalizeDisplayName(sourceName);
    if (!displayName) continue;
    const key = resolveCanonicalKey(displayName);
    if (!key) continue;
    const specialPrimeBaseName = getSpecialPrimeVariantBaseName(displayName);
    const isPrime = isPrimeVariantName(displayName) || specialPrimeBaseName !== undefined;
    const canonicalDisplayName = isPrime
      ? (specialPrimeBaseName ?? stripPrimeSuffix(displayName))
      : displayName;
    const existing = desired.get(key);
    if (!existing) {
      desired.set(key, {
        displayName: canonicalDisplayName,
        hasBaseVariant: !isPrime,
        hasPrimeVariant: isPrime,
      });
      continue;
    }
    desired.set(key, {
      displayName: existing.hasBaseVariant
        ? existing.displayName
        : isPrime
          ? existing.displayName
          : displayName,
      hasBaseVariant: existing.hasBaseVariant || !isPrime,
      hasPrimeVariant: existing.hasPrimeVariant || isPrime,
    });
  }

  for (const [itemName, itemRule] of KEPT_SPECIAL_ROWS.entries()) {
    if (itemRule.worksheet !== worksheet) continue;
    const displayName = normalizeDisplayName(itemName);
    desired.set(resolveCanonicalKey(displayName), {
      displayName,
      hasBaseVariant: true,
      hasPrimeVariant: itemRule.hasPrimeVariant,
    });
  }

  for (const [itemName, itemWorksheet] of PRIME_ONLY_UNAVAILABLE.entries()) {
    if (itemWorksheet !== worksheet) continue;
    const displayName = normalizeDisplayName(itemName);
    desired.set(resolveCanonicalKey(displayName), {
      displayName: itemName,
      hasBaseVariant: false,
      hasPrimeVariant: true,
    });
  }

  return desired;
}

function reconcileVariantAvailability(params: {
  codexDb: Database.Database;
  clerkUserId: string;
  rowId: number;
  desiredEntry: DesiredEntry;
  variantColumns: VariantColumns;
  execute: boolean;
}): boolean {
  const { codexDb, clerkUserId, rowId, desiredEntry, variantColumns, execute } = params;
  const targetValuesByColumn = new Map<number, '' | 'Unavailable'>();
  if (!desiredEntry.hasBaseVariant) {
    for (const columnId of variantColumns.baseColumnIds) {
      targetValuesByColumn.set(columnId, 'Unavailable');
    }
  } else {
    for (const columnId of variantColumns.baseColumnIds) {
      targetValuesByColumn.set(columnId, '');
    }
  }
  if (!desiredEntry.hasPrimeVariant) {
    for (const columnId of variantColumns.primeColumnIds) {
      targetValuesByColumn.set(columnId, 'Unavailable');
    }
  } else {
    for (const columnId of variantColumns.primeColumnIds) {
      targetValuesByColumn.set(columnId, '');
    }
  }
  if (targetValuesByColumn.size === 0) return false;

  let hasChange = false;
  for (const [columnId, targetValue] of targetValuesByColumn.entries()) {
    const currentValue = q.getCellValue(codexDb, rowId, columnId, clerkUserId) ?? '';
    const nextValue =
      targetValue === 'Unavailable'
        ? 'Unavailable'
        : currentValue === 'Unavailable'
          ? ''
          : currentValue;
    if (currentValue === nextValue) {
      continue;
    }
    hasChange = true;
    if (execute) {
      q.adminUpdateCell(codexDb, rowId, columnId, nextValue, clerkUserId);
    }
  }

  if (!hasChange) {
    return false;
  }
  return true;
}

function rowHasUserProgress(
  rowValues: Record<number, string>,
  columns: Array<{ id: number; name: string }>,
): boolean {
  for (const column of columns) {
    const value = rowValues[column.id] ?? '';
    if (column.name === 'Helminth') {
      if (value === 'Yes') return true;
      continue;
    }
    if (value !== '' && value !== 'Unavailable') {
      return true;
    }
  }
  return false;
}

function cleanupDuplicateVariantRows(params: {
  codexDb: Database.Database;
  clerkUserId: string;
  sheetId: number;
  worksheet: WorksheetName;
  execute: boolean;
}): {
  deletedItemNames: string[];
  deletedRows: CleanupCandidate[];
  requiresConfirmationRows: CleanupCandidate[];
} {
  const { codexDb, clerkUserId, sheetId, worksheet, execute } = params;
  const worksheetData = q.getWorksheetData(codexDb, sheetId, clerkUserId);
  if (!worksheetData) {
    return {
      deletedItemNames: [],
      deletedRows: [],
      requiresConfirmationRows: [],
    };
  }

  const groups = new Map<
    string,
    Array<{
      id: number;
      name: string;
      hasProgress: boolean;
      isPrime: boolean;
    }>
  >();
  for (const row of worksheetData.rows) {
    const key = resolveCanonicalKey(row.name);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push({
      id: row.id,
      name: row.name,
      hasProgress: rowHasUserProgress(row.values, worksheetData.columns),
      isPrime: isPrimeVariantName(row.name),
    });
    groups.set(key, bucket);
  }

  const deletedRows: CleanupCandidate[] = [];
  const requiresConfirmationRows: CleanupCandidate[] = [];

  for (const [canonicalKey, bucket] of groups.entries()) {
    if (bucket.length <= 1) continue;
    bucket.sort((a, b) => {
      if (a.hasProgress !== b.hasProgress) {
        return a.hasProgress ? -1 : 1;
      }
      if (a.isPrime !== b.isPrime) {
        return a.isPrime ? 1 : -1;
      }
      return a.id - b.id;
    });
    const keep = bucket[0];
    for (const row of bucket) {
      if (row.id === keep?.id) continue;
      const candidate: CleanupCandidate = {
        clerkUserId,
        worksheet,
        rowId: row.id,
        itemName: row.name,
        canonicalKey,
      };
      if (row.hasProgress) {
        requiresConfirmationRows.push(candidate);
        continue;
      }
      if (execute) {
        q.deleteRow(codexDb, row.id, clerkUserId);
      }
      deletedRows.push(candidate);
    }
  }

  return {
    deletedItemNames: deletedRows.map((row) => row.itemName),
    deletedRows,
    requiresConfirmationRows,
  };
}

type RunSyncOptions = {
  execute: boolean;
  clerkUserIds?: string[];
  initiatedByClerkUserId?: string;
};

function catalogRowsHasActiveColumn(codexDb: Database.Database): boolean {
  const cols = codexDb.prepare(`PRAGMA table_info(catalog_rows)`).all() as { name: string }[];
  return cols.some((c) => c.name === 'active');
}

function catalogRowsHasMaxLevelColumn(codexDb: Database.Database): boolean {
  const cols = codexDb.prepare(`PRAGMA table_info(catalog_rows)`).all() as { name: string }[];
  return cols.some((c) => c.name === 'max_level');
}

function syncCatalogMasterFromSource(
  codexDb: Database.Database,
  sourceByWorksheet: Record<WorksheetName, Set<string>>,
  arcaneMaxLevelByCanonicalKey: Map<string, number>,
  execute: boolean,
): void {
  if (!execute) return;
  const hasActive = catalogRowsHasActiveColumn(codexDb);
  const hasMaxLevel = catalogRowsHasMaxLevelColumn(codexDb);
  const upsert = codexDb.prepare(
    hasActive
      ? `INSERT INTO catalog_rows (worksheet_name, canonical_key, item_name, display_order, active)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(worksheet_name, canonical_key) DO UPDATE SET
           item_name = excluded.item_name,
           display_order = excluded.display_order,
           active = 1`
      : `INSERT INTO catalog_rows (worksheet_name, canonical_key, item_name, display_order)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(worksheet_name, canonical_key) DO UPDATE SET
           item_name = excluded.item_name,
           display_order = excluded.display_order`,
  );
  const upsertArcane = hasMaxLevel
    ? codexDb.prepare(
        hasActive
          ? `INSERT INTO catalog_rows (worksheet_name, canonical_key, item_name, display_order, active, max_level)
             VALUES (?, ?, ?, ?, 1, ?)
             ON CONFLICT(worksheet_name, canonical_key) DO UPDATE SET
               item_name = excluded.item_name,
               display_order = excluded.display_order,
               active = 1,
               max_level = excluded.max_level`
          : `INSERT INTO catalog_rows (worksheet_name, canonical_key, item_name, display_order, max_level)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(worksheet_name, canonical_key) DO UPDATE SET
               item_name = excluded.item_name,
               display_order = excluded.display_order,
               max_level = excluded.max_level`,
      )
    : null;
  for (const worksheet of WORKSHEET_NAMES) {
    let index = 0;
    const canonicalKeys: string[] = [];
    for (const name of sourceByWorksheet[worksheet] ?? []) {
      const key = resolveCanonicalKey(name);
      canonicalKeys.push(key);
      if (worksheet === 'Arcanes' && upsertArcane) {
        const maxLevel = arcaneMaxLevelByCanonicalKey.get(key) ?? arcaneMaxRankFromLevelStats(null);
        upsertArcane.run(worksheet, key, name, index++, maxLevel);
      } else {
        upsert.run(worksheet, key, name, index++);
      }
    }
    if (hasActive) {
      if (canonicalKeys.length === 0) {
        codexDb
          .prepare('UPDATE catalog_rows SET active = 0 WHERE worksheet_name = ?')
          .run(worksheet);
      } else {
        const placeholders = canonicalKeys.map(() => '?').join(', ');
        codexDb
          .prepare(
            `UPDATE catalog_rows SET active = 0
             WHERE worksheet_name = ? AND canonical_key NOT IN (${placeholders})`,
          )
          .run(worksheet, ...canonicalKeys);
      }
    }
  }
}

type MarketHrefPair = {
  market_href: string | null;
  market_href_prime: string | null;
};

function marketLinkKey(canonicalKey: string, worksheet: WorksheetName): string {
  return `${canonicalKey}\0${worksheet}`;
}

function loadArmoryMarketLinkMap(armoryDb: Database.Database): Map<string, MarketHrefPair> {
  const rows = armoryDb
    .prepare(
      `SELECT canonical_key, worksheet_category, market_href, market_href_prime
       FROM warframe_market_links`,
    )
    .all() as Array<{
    canonical_key: string;
    worksheet_category: WorksheetName;
    market_href: string | null;
    market_href_prime: string | null;
  }>;

  const map = new Map<string, MarketHrefPair>();
  for (const row of rows) {
    map.set(marketLinkKey(row.canonical_key, row.worksheet_category), {
      market_href: row.market_href,
      market_href_prime: row.market_href_prime,
    });
  }
  return map;
}

function loadCatalogMarketLinkMap(
  codexDb: Database.Database,
  worksheet: WorksheetName,
): Map<string, MarketHrefPair> {
  const rows = codexDb
    .prepare(
      `SELECT canonical_key, market_href, market_href_prime
       FROM catalog_rows
       WHERE worksheet_name = ?`,
    )
    .all(worksheet) as Array<{
    canonical_key: string;
    market_href: string | null;
    market_href_prime: string | null;
  }>;

  const map = new Map<string, MarketHrefPair>();
  for (const row of rows) {
    map.set(row.canonical_key, {
      market_href: row.market_href,
      market_href_prime: row.market_href_prime,
    });
  }
  return map;
}

function refreshCatalogMasterMarketHrefs(
  codexDb: Database.Database,
  armoryMarketLinks: Map<string, MarketHrefPair>,
): { rowsProcessed: number; rowsWithHref: number } {
  const masterRows = codexDb
    .prepare(
      `SELECT id, worksheet_name, canonical_key FROM catalog_rows ORDER BY worksheet_name, display_order`,
    )
    .all() as Array<{ id: number; worksheet_name: WorksheetName; canonical_key: string }>;
  const stmt = codexDb.prepare(
    'UPDATE catalog_rows SET market_href = ?, market_href_prime = ? WHERE id = ?',
  );
  let rowsProcessed = 0;
  let rowsWithHref = 0;
  const tx = codexDb.transaction(() => {
    for (const row of masterRows) {
      const hit = armoryMarketLinks.get(marketLinkKey(row.canonical_key, row.worksheet_name));
      let href = hit?.market_href ?? null;
      let hrefPrime = hit?.market_href_prime ?? null;
      if (href && !hrefPrime && warframeMarketSellHrefUsesPrimeOnlyItemSlug(href)) {
        hrefPrime = href;
        href = null;
      }
      stmt.run(href, hrefPrime, row.id);
      rowsProcessed += 1;
      const hasAny =
        (typeof href === 'string' && href.trim().length > 0) ||
        (typeof hrefPrime === 'string' && hrefPrime.trim().length > 0);
      if (hasAny) rowsWithHref += 1;
    }
  });
  tx();
  return { rowsProcessed, rowsWithHref };
}

function refreshUserRowMarketHrefsFromCatalog(
  codexDb: Database.Database,
  clerkUserId: string,
  worksheetId: number,
  worksheet: WorksheetName,
  catalogMarketLinks: Map<string, MarketHrefPair>,
): MarketHrefRefreshResult {
  try {
    const rows = q.getWorksheetRows(codexDb, worksheetId, clerkUserId);
    const stmt = codexDb.prepare(
      'UPDATE rows SET market_href = ?, market_href_prime = ? WHERE id = ?',
    );
    let rowsProcessed = 0;
    let rowsWithHref = 0;
    const tx = codexDb.transaction(() => {
      for (const row of rows) {
        const effectiveName =
          worksheet === 'Modular Weapons' ? stripKitgunPrimarySuffix(row.item_name) : row.item_name;
        const key = resolveCanonicalKey(effectiveName);
        const hit = catalogMarketLinks.get(key);
        const href = hit?.market_href ?? null;
        const hrefPrime = hit?.market_href_prime ?? null;
        stmt.run(href, hrefPrime, row.id);
        rowsProcessed += 1;
        const hasAny =
          (typeof href === 'string' && href.trim().length > 0) ||
          (typeof hrefPrime === 'string' && hrefPrime.trim().length > 0);
        if (hasAny) rowsWithHref += 1;
      }
    });
    tx();
    return { ok: true, rowsProcessed, rowsWithHref };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.warn(
      `[Warframe sync] catalog market href refresh failed: clerkUserId=${clerkUserId}, worksheetId=${worksheetId}, worksheet=${worksheet}`,
      err.stack ?? err.message,
    );
    return { ok: false, error: err.message };
  }
}

export function provisionUserFromCatalogMaster(
  codexDb: Database.Database,
  clerkUserId: string,
): boolean {
  type CatalogRow = {
    worksheet_name: WorksheetName;
    canonical_key: string;
    item_name: string;
    display_order: number;
    market_href: string | null;
    market_href_prime: string | null;
  };

  const masterRows = codexDb
    .prepare(
      `SELECT worksheet_name, canonical_key, item_name, display_order, market_href, market_href_prime
       FROM catalog_rows ORDER BY worksheet_name, display_order`,
    )
    .all() as CatalogRow[];

  if (masterRows.length === 0) return false;

  const byWorksheet = new Map<WorksheetName, CatalogRow[]>();
  for (const row of masterRows) {
    if (!WORKSHEET_NAMES.includes(row.worksheet_name)) continue;
    const bucket = byWorksheet.get(row.worksheet_name) ?? [];
    bucket.push(row);
    byWorksheet.set(row.worksheet_name, bucket);
  }

  for (const worksheet of WORKSHEET_NAMES) {
    const sheet = ensureWorksheetExistsForSync(codexDb, clerkUserId, worksheet, true);
    if (!sheet) continue;

    const existingRows = q.getWorksheetRows(codexDb, sheet.id, clerkUserId);
    const existingKeys = new Set(
      existingRows.map((existing) => resolveCanonicalKey(existing.item_name)),
    );

    for (const masterRow of byWorksheet.get(worksheet) ?? []) {
      if (existingKeys.has(masterRow.canonical_key)) continue;
      q.addRowFromCatalogMaster(
        codexDb,
        sheet.id,
        clerkUserId,
        masterRow.item_name,
        masterRow.display_order,
        masterRow.market_href,
        masterRow.market_href_prime,
      );
      existingKeys.add(masterRow.canonical_key);
    }

    if (worksheet === 'Warframes') {
      q.ensureHelminthNonSubsumableCells(codexDb, sheet.id, clerkUserId);
    }
  }

  return true;
}

function markRowOrphaned(codexDb: Database.Database, rowId: number, execute: boolean): void {
  if (!execute) return;
  codexDb.prepare('UPDATE rows SET orphaned = 1 WHERE id = ?').run(rowId);
}

export function runWarframeSync(
  codexDb: Database.Database,
  options: RunSyncOptions,
): WarframeSyncResult {
  if (
    options.execute &&
    (typeof options.initiatedByClerkUserId !== 'string' ||
      options.initiatedByClerkUserId.trim() === '')
  ) {
    throw new Error('A valid initiating admin user id is required for execute mode.');
  }
  const mode = options.execute ? 'execute' : 'preview';
  const armoryDb = new Database(ARMORY_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const { sourceByWorksheet, arcaneMaxLevelByCanonicalKey } = loadWorksheetSource(armoryDb);
    syncCatalogMasterFromSource(
      codexDb,
      sourceByWorksheet,
      arcaneMaxLevelByCanonicalKey,
      options.execute,
    );
    const armoryMarketLinks = loadArmoryMarketLinkMap(armoryDb);
    if (options.execute) {
      refreshCatalogMasterMarketHrefs(codexDb, armoryMarketLinks);
    }
    const clerkUserIds = options.clerkUserIds ?? q.getWorksheetUserIds(codexDb);
    const users: UserSyncResult[] = [];
    const summary = {
      added: 0,
      deleted: 0,
      markedUnavailable: 0,
      mismatched: 0,
    };
    const cleanupDeletedRows: CleanupCandidate[] = [];
    const cleanupRequiresConfirmationRows: CleanupCandidate[] = [];
    const marketLinkFailed: Array<{ clerkUserId: string; worksheet: WorksheetName }> = [];
    let marketRowsProcessed = 0;
    let marketRowsWithHref = 0;

    const catalogMarketLinksByWorksheet = new Map<WorksheetName, Map<string, MarketHrefPair>>();
    if (options.execute) {
      for (const worksheet of WORKSHEET_NAMES) {
        catalogMarketLinksByWorksheet.set(worksheet, loadCatalogMarketLinkMap(codexDb, worksheet));
      }
    }

    for (const clerkUserId of clerkUserIds) {
      const sheetsByWorksheet = new Map<
        WorksheetName,
        { id: number; name: string; display_order: number }
      >();
      for (const worksheet of WORKSHEET_NAMES) {
        const sheet = ensureWorksheetExistsForSync(
          codexDb,
          clerkUserId,
          worksheet,
          options.execute,
        );
        if (sheet) sheetsByWorksheet.set(worksheet, sheet);
      }

      const sourceByWorksheetForUser = cloneWorksheetSource(sourceByWorksheet);
      const currentRowsByWorksheet = new Map<WorksheetName, string[]>();
      for (const worksheet of WORKSHEET_NAMES) {
        const sheet = sheetsByWorksheet.get(worksheet);
        if (!sheet) continue;
        const rows = q.getWorksheetRows(codexDb, sheet.id, clerkUserId);
        currentRowsByWorksheet.set(
          worksheet,
          rows.map((row) => row.item_name),
        );
      }
      appendCurrentSpecialItemPlacements(
        sourceByWorksheetForUser,
        currentRowsByWorksheet,
        armoryDb,
      );

      const worksheetResults: WorksheetSyncResult[] = [];
      for (const worksheet of WORKSHEET_NAMES) {
        const sheet = sheetsByWorksheet.get(worksheet);
        if (!sheet) continue;
        const catalogMarketLinks = options.execute
          ? catalogMarketLinksByWorksheet.get(worksheet)!
          : new Map<string, MarketHrefPair>();
        const desired = createDesiredEntries(worksheet, sourceByWorksheetForUser[worksheet]);
        let rows = q.getWorksheetRows(codexDb, sheet.id, clerkUserId);
        const columns = q.getWorksheetColumns(codexDb, sheet.id, clerkUserId);
        const variantColumns = resolveVariantColumns(columns);

        const existingByKey = new Map<string, typeof rows>();
        for (const row of rows) {
          const key = resolveCanonicalKey(row.item_name);
          const bucket = existingByKey.get(key) ?? [];
          bucket.push(row);
          existingByKey.set(key, bucket);
        }

        const toAdd: string[] = [];
        for (const [key, entry] of desired.entries()) {
          if (!existingByKey.has(key)) {
            toAdd.push(entry.displayName);
          }
        }

        const added: string[] = [];
        if (options.execute) {
          for (const name of toAdd) {
            q.addRowWithEmptyValues(codexDb, sheet.id, clerkUserId, name);
            added.push(name);
          }
          rows = q.getWorksheetRows(codexDb, sheet.id, clerkUserId);
        }

        const deleted: string[] = [];
        const markedUnavailable: string[] = [];
        const mismatched: number[] = [];

        for (const row of rows) {
          const normalizedItemName =
            worksheet === 'Modular Weapons'
              ? stripKitgunPrimarySuffix(row.item_name)
              : row.item_name;
          const didNormalizeKitgunName =
            normalizedItemName !== row.item_name &&
            resolveCanonicalKey(normalizedItemName) === resolveCanonicalKey(row.item_name);
          if (didNormalizeKitgunName && options.execute) {
            q.editRow(codexDb, row.id, clerkUserId, normalizedItemName, {});
          }
          const effectiveItemName = didNormalizeKitgunName ? normalizedItemName : row.item_name;

          if (DISCARDED_ROWS.has(effectiveItemName)) {
            if (options.execute) {
              q.deleteRow(codexDb, row.id, clerkUserId);
            }
            deleted.push(effectiveItemName);
            continue;
          }
          const key = resolveCanonicalKey(effectiveItemName);
          const desiredEntry = desired.get(key);
          if (!desiredEntry) {
            markRowOrphaned(codexDb, row.id, options.execute);
            mismatched.push(row.id);
            continue;
          }
          if (options.execute) {
            codexDb.prepare('UPDATE rows SET orphaned = 0 WHERE id = ?').run(row.id);
          }
          const didMarkUnavailable = reconcileVariantAvailability({
            codexDb,
            clerkUserId,
            rowId: row.id,
            desiredEntry,
            variantColumns,
            execute: options.execute,
          });
          if (didMarkUnavailable) {
            markedUnavailable.push(effectiveItemName);
          }
        }

        const cleanup = cleanupDuplicateVariantRows({
          codexDb,
          clerkUserId,
          sheetId: sheet.id,
          worksheet,
          execute: options.execute,
        });
        if (cleanup.deletedItemNames.length > 0) {
          deleted.push(...cleanup.deletedItemNames);
        }
        cleanupDeletedRows.push(...cleanup.deletedRows);
        cleanupRequiresConfirmationRows.push(...cleanup.requiresConfirmationRows);

        if (options.execute) {
          const mr = refreshUserRowMarketHrefsFromCatalog(
            codexDb,
            clerkUserId,
            sheet.id,
            worksheet,
            catalogMarketLinks,
          );
          if (mr.ok) {
            marketRowsProcessed += mr.rowsProcessed;
            marketRowsWithHref += mr.rowsWithHref;
          } else {
            marketLinkFailed.push({ clerkUserId, worksheet });
          }
        }

        if (worksheet === 'Warframes' && options.execute) {
          q.ensureHelminthNonSubsumableCells(codexDb, sheet.id, clerkUserId);
        }

        worksheetResults.push({
          worksheet,
          added: options.execute ? added : toAdd,
          deleted,
          markedUnavailable,
          mismatched,
        });

        summary.added += (options.execute ? added : toAdd).length;
        summary.deleted += deleted.length;
        summary.markedUnavailable += markedUnavailable.length;
        summary.mismatched += mismatched.length;
      }

      users.push({ clerkUserId, worksheets: worksheetResults });
    }

    return {
      mode,
      users,
      summary,
      cleanup: {
        deleted: cleanupDeletedRows.length,
        requiresConfirmation: cleanupRequiresConfirmationRows.length,
        deletedRows: cleanupDeletedRows,
        requiresConfirmationRows: cleanupRequiresConfirmationRows,
      },
      marketLinkSync: options.execute
        ? {
            ran: true,
            rowsProcessed: marketRowsProcessed,
            rowsWithLink: marketRowsWithHref,
            failedWorksheets: marketLinkFailed,
          }
        : { ran: false },
    };
  } finally {
    armoryDb.close();
  }
}

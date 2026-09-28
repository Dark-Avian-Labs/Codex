import type Database from 'better-sqlite3';

import {
  WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT,
  WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT,
} from '../../../shared/warframeImport/artifactSlotState.js';
import {
  artifactSlotsStorageLength,
  EQUIPMENT_SLOT_CONFIGS,
  equipmentExilusArtifactIndex,
  equipmentHasSpecialSlot,
  type EquipmentSlotConfig,
} from '../../../shared/warframeImport/equipmentSlotConfig.js';

export const JADE_WARFRAME_UNIQUE_NAME = '/Lotus/Powersuits/Choir/Choir';

const NECRAMECH_CATEGORIES = new Set(['Necramechs', 'MechSuits']);

const OVERFRAME_MELEE_LEGACY_LENGTH = 11;
const OVERFRAME_GUN_LEGACY_LENGTH = 10;

export function isNecramechProductCategory(productCategory: string | null | undefined): boolean {
  return productCategory != null && NECRAMECH_CATEGORIES.has(productCategory);
}

function parseArtifactSlots(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function padUniversal(slots: string[], length: number): string[] {
  const result = [...slots];
  while (result.length < length) result.push('AP_UNIVERSAL');
  return result;
}

export function convertWarframeArtifactSlotsFromOverframe(legacy: string[]): string[] {
  if (legacy.length <= WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT) {
    return padUniversal(legacy, WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT);
  }

  const general = legacy.slice(0, 8);
  const aura = legacy[8] ?? 'AP_UNIVERSAL';
  const exilus = legacy[9] ?? 'AP_UNIVERSAL';
  return padUniversal([...general, aura, exilus], WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT);
}

export function migrateJadeArtifactSlots(legacy: string[]): string[] {
  const general = legacy.slice(0, 8);
  while (general.length < 8) general.push('AP_UNIVERSAL');

  const aura = legacy[8] ?? 'AP_UNIVERSAL';
  const aura2 =
    legacy.find((ap, i) => i > 8 && ap !== 'AP_UNIVERSAL' && ap !== 'AP_DISABLED') ??
    legacy[10] ??
    legacy[9] ??
    'AP_ANY';
  const exilus =
    legacy[9] != null && legacy[9] !== aura2 ? legacy[9] : (legacy[11] ?? 'AP_UNIVERSAL');

  return [...general, aura, aura2, exilus];
}

export function migrateNecramechArtifactSlots(legacy: string[]): string[] {
  return padUniversal(legacy.slice(0, 12), 12);
}

export function weaponSlotConfig(
  productCategory: string | null,
  slot: number | null,
): EquipmentSlotConfig {
  const cat = productCategory ?? '';
  if (cat === 'Melee' || slot === 5) return EQUIPMENT_SLOT_CONFIGS.melee;
  if (cat === 'Pistols' || slot === 0) return EQUIPMENT_SLOT_CONFIGS.secondary;
  if (cat === 'SentinelWeapons') return EQUIPMENT_SLOT_CONFIGS.beast_claws;
  if (cat === 'SpaceGuns') return EQUIPMENT_SLOT_CONFIGS.archgun;
  if (cat === 'SpaceMelee') return EQUIPMENT_SLOT_CONFIGS.archmelee;
  return EQUIPMENT_SLOT_CONFIGS.primary;
}

export function convertEquipmentArtifactSlotsFromOverframe(
  legacy: string[],
  config: EquipmentSlotConfig,
): string[] {
  const targetLen = artifactSlotsStorageLength(config);
  if (legacy.length === targetLen) return [...legacy];
  if (legacy.length < targetLen) return padUniversal(legacy, targetLen);

  const g = config.generalSlots;
  const result = Array.from({ length: targetLen }, () => 'AP_UNIVERSAL');

  for (let i = 0; i < g; i++) {
    result[i] = legacy[i] ?? 'AP_UNIVERSAL';
  }

  let legacySpecial = g;
  if (config.hasAura || config.hasStance || config.hasPosture) {
    result[g] = legacy[legacySpecial] ?? 'AP_UNIVERSAL';
    legacySpecial += 1;
  }

  if (config.hasExilus) {
    const exilusIndex = equipmentExilusArtifactIndex(config);
    if (legacy.length === OVERFRAME_GUN_LEGACY_LENGTH && !equipmentHasSpecialSlot(config)) {
      result[exilusIndex] = legacy[8] ?? 'AP_UNIVERSAL';
    } else if (legacy.length >= OVERFRAME_MELEE_LEGACY_LENGTH && config.hasStance) {
      result[exilusIndex] = legacy[9] ?? legacy[10] ?? 'AP_UNIVERSAL';
    } else {
      result[exilusIndex] = legacy[legacySpecial] ?? legacy[g + 1] ?? 'AP_UNIVERSAL';
    }
  }

  return result;
}

export interface ArtifactSlotsMigrationSummary {
  dryRun: boolean;
  warframesConverted: number;
  warframesJadeUpdated: number;
  warframesNecramechUpdated: number;
  weaponsConverted: number;
  companionsConverted: number;
  warframesSkipped: number;
  weaponsSkipped: number;
}

export function migrateArtifactSlotsFromOverframe(
  db: Database.Database,
  options?: { dryRun?: boolean },
): ArtifactSlotsMigrationSummary {
  const dryRun = options?.dryRun ?? false;
  const summary: ArtifactSlotsMigrationSummary = {
    dryRun,
    warframesConverted: 0,
    warframesJadeUpdated: 0,
    warframesNecramechUpdated: 0,
    weaponsConverted: 0,
    companionsConverted: 0,
    warframesSkipped: 0,
    weaponsSkipped: 0,
  };

  const updateWarframe = db.prepare(
    'UPDATE warframes SET artifact_slots = ? WHERE unique_name = ?',
  );
  const updateWeapon = db.prepare('UPDATE weapons SET artifact_slots = ? WHERE unique_name = ?');
  const updateCompanion = db.prepare(
    'UPDATE companions SET artifact_slots = ? WHERE unique_name = ?',
  );

  const warframes = db
    .prepare(`SELECT unique_name, name, product_category, artifact_slots FROM warframes`)
    .all() as Array<{
    unique_name: string;
    name: string;
    product_category: string | null;
    artifact_slots: string | null;
  }>;

  const apply = (fn: () => void) => {
    if (!dryRun) fn();
  };

  for (const row of warframes) {
    const legacy = parseArtifactSlots(row.artifact_slots);
    if (legacy.length === 0) {
      summary.warframesSkipped += 1;
      continue;
    }

    let migrated: string[];
    if (row.unique_name === JADE_WARFRAME_UNIQUE_NAME || row.name === 'Jade') {
      migrated = migrateJadeArtifactSlots(legacy);
      if (migrated.length !== WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT) continue;
      summary.warframesJadeUpdated += 1;
    } else if (isNecramechProductCategory(row.product_category)) {
      migrated = migrateNecramechArtifactSlots(legacy);
      summary.warframesNecramechUpdated += 1;
    } else {
      migrated = convertWarframeArtifactSlotsFromOverframe(legacy);
      summary.warframesConverted += 1;
    }

    apply(() => updateWarframe.run(JSON.stringify(migrated), row.unique_name));
  }

  const weapons = db
    .prepare(
      `SELECT unique_name, product_category, slot, artifact_slots FROM weapons WHERE artifact_slots IS NOT NULL`,
    )
    .all() as Array<{
    unique_name: string;
    product_category: string | null;
    slot: number | null;
    artifact_slots: string;
  }>;

  for (const row of weapons) {
    const legacy = parseArtifactSlots(row.artifact_slots);
    if (legacy.length === 0) {
      summary.weaponsSkipped += 1;
      continue;
    }
    const config = weaponSlotConfig(row.product_category, row.slot);
    const migrated = convertEquipmentArtifactSlotsFromOverframe(legacy, config);
    summary.weaponsConverted += 1;
    apply(() => updateWeapon.run(JSON.stringify(migrated), row.unique_name));
  }

  const companions = db
    .prepare(`SELECT unique_name, artifact_slots FROM companions WHERE artifact_slots IS NOT NULL`)
    .all() as Array<{ unique_name: string; artifact_slots: string }>;

  for (const row of companions) {
    const legacy = parseArtifactSlots(row.artifact_slots);
    if (legacy.length === 0) continue;
    const migrated = convertEquipmentArtifactSlotsFromOverframe(
      legacy,
      EQUIPMENT_SLOT_CONFIGS.companion,
    );
    summary.companionsConverted += 1;
    apply(() => updateCompanion.run(JSON.stringify(migrated), row.unique_name));
  }

  return summary;
}

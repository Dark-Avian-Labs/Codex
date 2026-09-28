export type EquipmentSlotConfigKey =
  | 'warframe'
  | 'primary'
  | 'secondary'
  | 'melee'
  | 'archgun'
  | 'archmelee'
  | 'companion'
  | 'beast_claws'
  | 'archwing'
  | 'necramech'
  | 'kdrive'
  | 'tektolyst';

export interface EquipmentSlotConfig {
  generalSlots: number;
  hasAura: boolean;
  hasStance: boolean;
  hasExilus: boolean;
  hasPosture: boolean;
  hasSecondAura: boolean;
}

export const EQUIPMENT_SLOT_CONFIGS: Record<EquipmentSlotConfigKey, EquipmentSlotConfig> = {
  warframe: {
    generalSlots: 8,
    hasAura: true,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  primary: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  secondary: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  melee: {
    generalSlots: 8,
    hasAura: false,
    hasStance: true,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  archgun: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  archmelee: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  companion: {
    generalSlots: 10,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  beast_claws: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: true,
    hasSecondAura: false,
  },
  archwing: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  necramech: {
    generalSlots: 12,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  kdrive: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  tektolyst: {
    generalSlots: 5,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
};

export function equipmentHasSpecialSlot(config: EquipmentSlotConfig): boolean {
  return config.hasAura || config.hasStance || config.hasPosture;
}

export function equipmentExilusArtifactIndex(config: EquipmentSlotConfig): number {
  return config.generalSlots + (equipmentHasSpecialSlot(config) ? 1 : 0);
}

export function artifactSlotsStorageLength(
  config: EquipmentSlotConfig,
  options?: { hasSecondAura?: boolean },
): number {
  return (
    config.generalSlots +
    (equipmentHasSpecialSlot(config) ? 1 : 0) +
    (options?.hasSecondAura ? 1 : 0) +
    (config.hasExilus ? 1 : 0)
  );
}

export const MAX_ARTIFACT_SLOTS_STORAGE_LENGTH = Math.max(
  ...Object.values(EQUIPMENT_SLOT_CONFIGS).map((config) => artifactSlotsStorageLength(config)),
  artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.warframe, { hasSecondAura: true }), // 11
);

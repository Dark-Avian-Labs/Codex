import { describe, expect, it } from 'vitest';

import {
  artifactSlotsStorageLength,
  EQUIPMENT_SLOT_CONFIGS,
  equipmentExilusArtifactIndex,
  MAX_ARTIFACT_SLOTS_STORAGE_LENGTH,
} from './equipmentSlotConfig.js';

describe('artifactSlotsStorageLength', () => {
  it('uses 10 slots for warframes with aura and exilus', () => {
    expect(artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.warframe)).toBe(10);
  });

  it('uses 9 slots for primary/secondary (8 general + exilus)', () => {
    expect(artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.primary)).toBe(9);
    expect(artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.secondary)).toBe(9);
  });

  it('uses 12 slots for necramechs', () => {
    expect(artifactSlotsStorageLength(EQUIPMENT_SLOT_CONFIGS.necramech)).toBe(12);
  });

  it('exposes max length for server validation', () => {
    expect(MAX_ARTIFACT_SLOTS_STORAGE_LENGTH).toBe(12);
  });
});

describe('equipmentExilusArtifactIndex', () => {
  it('places gun exilus immediately after general slots', () => {
    expect(equipmentExilusArtifactIndex(EQUIPMENT_SLOT_CONFIGS.primary)).toBe(8);
    expect(equipmentExilusArtifactIndex(EQUIPMENT_SLOT_CONFIGS.secondary)).toBe(8);
  });

  it('places melee exilus after the stance slot', () => {
    expect(equipmentExilusArtifactIndex(EQUIPMENT_SLOT_CONFIGS.melee)).toBe(9);
  });
});

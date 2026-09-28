import { describe, expect, it } from 'vitest';

import { isUnreleasedArcane, resolveArcaneImportRarity, UNRELEASED_ARCANE_UNIQUE_NAMES } from './arcaneCatalog.js';

describe('arcaneCatalog', () => {
  it('defaults missing rarity to COMMON', () => {
    expect(resolveArcaneImportRarity(undefined)).toBe('COMMON');
    expect(resolveArcaneImportRarity(null)).toBe('COMMON');
    expect(resolveArcaneImportRarity('')).toBe('COMMON');
    expect(resolveArcaneImportRarity('  ')).toBe('COMMON');
  });

  it('preserves export rarity when present', () => {
    expect(resolveArcaneImportRarity('LEGENDARY')).toBe('LEGENDARY');
    expect(resolveArcaneImportRarity('Rare')).toBe('Rare');
  });

  it('flags Arcane Survival as unreleased', () => {
    expect(UNRELEASED_ARCANE_UNIQUE_NAMES).toHaveLength(1);
    expect(isUnreleasedArcane(UNRELEASED_ARCANE_UNIQUE_NAMES[0]!)).toBe(true);
    expect(isUnreleasedArcane('/Lotus/Upgrades/CosmeticEnhancers/Offensive/ArcaneEnergize')).toBe(false);
  });
});

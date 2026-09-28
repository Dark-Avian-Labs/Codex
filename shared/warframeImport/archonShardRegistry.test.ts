import { describe, expect, it } from 'vitest';

import {
  ARCHON_BUFF_SLUGS_BY_COLOR,
  ARCHON_COLORS,
  allArchonBuffCatalogKeys,
  archonSlugForSortOrder,
  archonSortOrderForSlug,
  archonVariantFromTauforged,
  buildArchonShardKey,
  parseArchonShardKey,
} from './archonShardRegistry.js';

describe('archonShardRegistry', () => {
  it('has expected buff counts per color (27 total)', () => {
    const counts = ARCHON_COLORS.map((c) => ARCHON_BUFF_SLUGS_BY_COLOR[c].length);
    expect(counts).toEqual([5, 5, 5, 4, 4, 4]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(27);
  });

  it('maps sort_order to slug and back', () => {
    expect(archonSlugForSortOrder('Crimson', 1)).toBe('MeleeCritDamage');
    expect(archonSortOrderForSlug('Crimson', 'MeleeCritDamage')).toBe(1);
    expect(archonSlugForSortOrder('Emerald', 4)).toBe('MaxCorrosionStacks');
    expect(archonSlugForSortOrder('Crimson', 0)).toBeUndefined();
    expect(archonSlugForSortOrder('Crimson', 99)).toBeUndefined();
  });

  it('builds and parses archon keys', () => {
    const key = buildArchonShardKey('Azure', 'Tauforged', 'Armor');
    expect(key).toBe('/Armory/Archon/Azure/Tauforged/Armor');
    expect(parseArchonShardKey(key)).toEqual({
      color: 'Azure',
      variant: 'Tauforged',
      buffSlug: 'Armor',
    });
    expect(parseArchonShardKey('/Armory/Archon/Fake/Common/Armor')).toBeNull();
    expect(parseArchonShardKey('/Armory/Archon/Azure/Common/NotASlug')).toBeNull();
  });

  it('maps tauforged boolean to variant', () => {
    expect(archonVariantFromTauforged(false)).toBe('Common');
    expect(archonVariantFromTauforged(true)).toBe('Tauforged');
  });

  it('allArchonBuffCatalogKeys returns 54 keys (27 buffs × 2 variants)', () => {
    const keys = allArchonBuffCatalogKeys();
    expect(keys).toHaveLength(54);
    expect(new Set(keys).size).toBe(54);
  });
});

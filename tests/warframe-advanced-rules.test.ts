import { arcaneMaxRankFromLevelStats, resolveAdvancedRowRelevance } from '@codex/game-warframe';
import { describe, expect, it } from 'vitest';

describe('arcaneMaxRankFromLevelStats', () => {
  it('returns length - 1 for valid level_stats JSON', () => {
    expect(arcaneMaxRankFromLevelStats(JSON.stringify([{}, {}, {}, {}]))).toBe(3);
  });

  it('defaults to 5 when level_stats is missing or invalid', () => {
    expect(arcaneMaxRankFromLevelStats(null)).toBe(5);
    expect(arcaneMaxRankFromLevelStats('')).toBe(5);
    expect(arcaneMaxRankFromLevelStats('not-json')).toBe(5);
    expect(arcaneMaxRankFromLevelStats('[]')).toBe(5);
  });
});

describe('resolveAdvancedRowRelevance for Arcanes', () => {
  it('uses catalog max level and disables other advanced columns', () => {
    const relevance = resolveAdvancedRowRelevance('Arcanes', 'Arcane Energize', {
      catalogMaxLevel: 3,
    });
    expect(relevance).toEqual({
      maxLevel: 3,
      valence: false,
      element: false,
      orokin: false,
      arcane: false,
      exilus: false,
      autoOrokin: false,
      autoArcane: false,
    });
  });

  it('defaults max level to 5 without catalog metadata', () => {
    expect(resolveAdvancedRowRelevance('Arcanes', 'Arcane Aegis').maxLevel).toBe(5);
  });
});

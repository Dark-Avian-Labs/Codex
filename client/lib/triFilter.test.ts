import { describe, expect, it } from 'vitest';

import {
  cycleTriFilter,
  cycleTriState,
  matchesAnyTriFilter,
  matchesBoolTri,
  matchesTriFilter,
  pruneTriFilter,
  triFilterState,
} from './triFilter.js';

describe('triFilter', () => {
  it('cycles off → include → exclude → off', () => {
    expect(cycleTriState('off')).toBe('include');
    expect(cycleTriState('include')).toBe('exclude');
    expect(cycleTriState('exclude')).toBe('off');
  });

  it('cycles one key without clearing other keys', () => {
    const withRanger = cycleTriFilter({}, 'ranger');
    expect(withRanger).toEqual({ ranger: 'include' });

    const excludeRanger = cycleTriFilter(withRanger, 'ranger');
    expect(excludeRanger).toEqual({ ranger: 'exclude' });

    const withLord = cycleTriFilter(excludeRanger, 'lord');
    expect(withLord).toEqual({ ranger: 'exclude', lord: 'include' });

    const clearedRanger = cycleTriFilter(withLord, 'ranger');
    expect(clearedRanger).toEqual({ lord: 'include' });
  });

  it('reads missing keys as off', () => {
    expect(triFilterState({}, 'ranger')).toBe('off');
    expect(triFilterState({ ranger: 'include' }, 'ranger')).toBe('include');
    expect(triFilterState({ ranger: 'exclude' }, 'ranger')).toBe('exclude');
  });

  it('include keeps only matching values; exclude drops them', () => {
    expect(matchesTriFilter('ranger', { ranger: 'include' })).toBe(true);
    expect(matchesTriFilter('knight', { ranger: 'include' })).toBe(false);
    expect(matchesTriFilter('ranger', { ranger: 'exclude' })).toBe(false);
    expect(matchesTriFilter('knight', { ranger: 'exclude' })).toBe(true);
  });

  it('combines include and exclude across values', () => {
    const filters = { lord: 'include' as const, ranger: 'exclude' as const };
    expect(matchesAnyTriFilter(['lord'], filters)).toBe(true);
    expect(matchesAnyTriFilter(['ranger'], filters)).toBe(false);
    expect(matchesAnyTriFilter(['lord', 'ranger'], filters)).toBe(false);
    expect(matchesAnyTriFilter(['mage'], filters)).toBe(false);
  });

  it('matches dual-faction include on either side and exclude on either side', () => {
    expect(matchesAnyTriFilter(['lightbearers', 'shadowes'], { lightbearers: 'include' })).toBe(true);
    expect(matchesAnyTriFilter(['grotesque', 'shadowes'], { lightbearers: 'include' })).toBe(false);
    expect(matchesAnyTriFilter(['lightbearers', 'shadowes'], { shadowes: 'exclude' })).toBe(false);
  });

  it('treats an empty map as off', () => {
    expect(matchesTriFilter('ranger', {})).toBe(true);
    expect(matchesAnyTriFilter(['lord', 'ranger'], {})).toBe(true);
  });

  it('stringifies numeric keys so rarity filters match', () => {
    expect(matchesTriFilter(6, { '6': 'include' })).toBe(true);
    expect(matchesTriFilter(5, { '6': 'include' })).toBe(false);
    expect(matchesTriFilter(6, { '6': 'exclude' })).toBe(false);
  });

  it('boolean tri-state keeps, drops, or ignores a flag', () => {
    expect(matchesBoolTri(true, 'off')).toBe(true);
    expect(matchesBoolTri(false, 'off')).toBe(true);
    expect(matchesBoolTri(true, 'include')).toBe(true);
    expect(matchesBoolTri(false, 'include')).toBe(false);
    expect(matchesBoolTri(true, 'exclude')).toBe(false);
    expect(matchesBoolTri(false, 'exclude')).toBe(true);
  });

  it('prunes keys that are not allowed on the current tab', () => {
    const map = { '5': 'include' as const, '6': 'exclude' as const };
    expect(pruneTriFilter(map, ['5'])).toEqual({ '5': 'include' });
    expect(pruneTriFilter(map, ['5', '6'])).toBe(map);
  });
});

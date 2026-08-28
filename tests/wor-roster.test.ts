import { describe, expect, it } from 'vitest';

import {
  compactRosterHero,
  filterOwnedRows,
  parseRosterInclude,
  parseRosterOwnedFilter,
} from '../server/routes/worRoster.js';

describe('parseRosterOwnedFilter', () => {
  it('defaults to owned', () => {
    expect(parseRosterOwnedFilter(undefined)).toBe('owned');
    expect(parseRosterOwnedFilter('1')).toBe('owned');
  });

  it('accepts unowned and all aliases', () => {
    expect(parseRosterOwnedFilter('0')).toBe('unowned');
    expect(parseRosterOwnedFilter('unowned')).toBe('unowned');
    expect(parseRosterOwnedFilter('all')).toBe('all');
  });
});

describe('parseRosterInclude', () => {
  it('defaults to all collections', () => {
    expect([...parseRosterInclude(undefined)].sort()).toEqual(['artifacts', 'demons', 'heroes']);
  });

  it('parses a subset and ignores junk', () => {
    expect([...parseRosterInclude('heroes,demons')].sort()).toEqual(['demons', 'heroes']);
    expect([...parseRosterInclude('nope')].sort()).toEqual(['artifacts', 'demons', 'heroes']);
  });
});

describe('roster compact helpers', () => {
  it('filters owned rows', () => {
    const rows = [
      { owned: 1, name: 'a' },
      { owned: 0, name: 'b' },
    ];
    expect(filterOwnedRows(rows, 'owned').map((row) => row.name)).toEqual(['a']);
    expect(filterOwnedRows(rows, 'unowned').map((row) => row.name)).toEqual(['b']);
    expect(filterOwnedRows(rows, 'all')).toHaveLength(2);
  });

  it('compacts heroes without portraits', () => {
    const compact = compactRosterHero({
      id: 9,
      catalog_hero_slug: 'lian',
      name: 'Lian',
      class: 'marksman',
      faction: 'watchguard',
      rarity: 'legendary',
      star_rating: 5,
      owned: 1,
      gauge_level: 3,
      is_lord: 0,
    });
    expect(compact).toEqual({
      id: 9,
      slug: 'lian',
      name: 'Lian',
      class: 'marksman',
      faction: 'watchguard',
      faction_secondary: null,
      rarity: 'legendary',
      star_rating: 5,
      is_lord: false,
      owned: true,
      awakening: 3,
      reference_tier: null,
    });
  });
});

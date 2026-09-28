import { describe, expect, it } from 'vitest';

import {
  getRank30Bonuses,
  scaleAvatarStatsToMaxRank,
  scaleWarframeStatsToMaxRank,
  standardWarframeRankBonusesAtRank,
  DEFAULT_WARFRAME_RANK_30_BONUSES,
  WARFRAME_MAX_RANK,
} from './equipmentRankStats.js';
import { WARFRAME_RANK_EXCEPTION_ENTRIES } from './warframeRankExceptions.generated.js';

describe('standardWarframeRankBonusesAtRank', () => {
  it('matches wiki totals at rank 30', () => {
    expect(standardWarframeRankBonusesAtRank(WARFRAME_MAX_RANK)).toEqual({
      health: 100,
      shield: 100,
      energy: 50,
      armor: 0,
    });
    expect(DEFAULT_WARFRAME_RANK_30_BONUSES).toEqual(standardWarframeRankBonusesAtRank(30));
  });

  it('accumulates bonuses at intermediate ranks', () => {
    expect(standardWarframeRankBonusesAtRank(1)).toEqual({
      health: 10,
      shield: 0,
      energy: 0,
      armor: 0,
    });
    expect(standardWarframeRankBonusesAtRank(3)).toEqual({
      health: 10,
      shield: 10,
      energy: 5,
      armor: 0,
    });
  });
});

describe('warframe rank exceptions registry', () => {
  it('includes all wiki exception rows with unique DE paths', () => {
    expect(WARFRAME_RANK_EXCEPTION_ENTRIES.length).toBe(30);
    const names = new Set(WARFRAME_RANK_EXCEPTION_ENTRIES.map((e) => e.uniqueName));
    expect(names.size).toBe(30);
  });
});

describe('equipmentRankStats', () => {
  it('applies default rank-30 bonuses for standard warframes', () => {
    expect(getRank30Bonuses('/Lotus/Powersuits/Excalibur/Excalibur')).toEqual({
      health: 100,
      shield: 100,
      energy: 50,
      armor: 0,
    });
  });

  it('applies Inaros Prime wiki exception bonuses', () => {
    expect(getRank30Bonuses('/Lotus/Powersuits/Sandman/InarosPrime')).toEqual({
      health: 200,
      shield: 0,
      energy: 50,
      armor: 0,
    });
  });

  it('applies Nidus armor exception', () => {
    expect(getRank30Bonuses('/Lotus/Powersuits/Infestation/Infestation')).toEqual({
      health: 100,
      shield: 0,
      energy: 50,
      armor: 100,
    });
  });

  it('scales Inaros Prime to rank-30 unmodded stats', () => {
    const scaled = scaleWarframeStatsToMaxRank({
      unique_name: '/Lotus/Powersuits/Sandman/InarosPrime',
      health: 2215,
      shield: 0,
      armor: 240,
      power: 140,
    });
    expect(scaled.health).toBe(2415);
    expect(scaled.power).toBe(190);
    expect(scaled.shield).toBe(0);
    expect(scaled.armor).toBe(240);
  });

  it('does not add shield bonus when base shields are zero', () => {
    const scaled = scaleWarframeStatsToMaxRank({
      unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
      health: 270,
      shield: 0,
      armor: 240,
      power: 100,
    });
    expect(scaled.shield).toBe(0);
  });

  it('adds shield bonus when base shields are non-zero', () => {
    const scaled = scaleWarframeStatsToMaxRank({
      unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
      health: 270,
      shield: 270,
      armor: 240,
      power: 100,
    });
    expect(scaled.shield).toBe(370);
    expect(scaled.health).toBe(370);
    expect(scaled.power).toBe(150);
  });

  it('applies necramech rank-30 stat bonuses (stats do not grow past rank 30)', () => {
    expect(getRank30Bonuses('/Lotus/Powersuits/EntratiMech/ThanoTech', 'MechSuits')).toEqual({
      health: 1000,
      shield: 200,
      energy: 50,
      armor: 0,
    });
  });

  it('scales Bonewidow to wiki rank-30 unmodded stats', () => {
    const scaled = scaleAvatarStatsToMaxRank({
      unique_name: '/Lotus/Powersuits/EntratiMech/ThanoTech',
      product_category: 'MechSuits',
      health: 1880,
      shield: 430,
      armor: 480,
      power: 175,
    });
    expect(scaled.health).toBe(2880);
    expect(scaled.shield).toBe(630);
    expect(scaled.power).toBe(225);
    expect(scaled.armor).toBe(480);
  });

  it('scales Voidrig to wiki rank-30 unmodded stats', () => {
    const scaled = scaleAvatarStatsToMaxRank({
      unique_name: '/Lotus/Powersuits/EntratiMech/NechroTech',
      product_category: 'MechSuits',
      health: 1400,
      shield: 850,
      armor: 385,
      power: 175,
    });
    expect(scaled.health).toBe(2400);
    expect(scaled.shield).toBe(1050);
    expect(scaled.power).toBe(225);
    expect(scaled.armor).toBe(385);
  });
});

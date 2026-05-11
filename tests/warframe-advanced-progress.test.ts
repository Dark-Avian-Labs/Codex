import { describe, expect, it } from 'vitest';

import { resolveAdvancedProgressState } from '../packages/games/warframe/src/db/queries.js';

function baseRow(overrides: Partial<Record<string, number | null>> = {}) {
  return {
    row_id: 1,
    level: 15,
    level_prime: 10,
    valence_percent: null as number | null,
    valence_percent_prime: null as number | null,
    has_element: 1,
    has_element_prime: 0,
    has_orokin: 1,
    has_orokin_prime: 1,
    has_arcane: 0,
    has_arcane_prime: 0,
    has_exilus: 1,
    has_exilus_prime: 0,
    ...overrides,
  };
}

describe('Warframe advanced progress', () => {
  it('automatically completes Arcane for normal and prime Warframes', () => {
    const state = resolveAdvancedProgressState('Warframes', 'Excalibur', true, null, {
      has_arcane: false,
      has_arcane_prime: false,
    });

    expect(state.normal.has_arcane).toBe(true);
    expect(state.prime.has_arcane).toBe(true);
  });

  it('sets prime Orokin when primeAutoElementOrokin applies (prime Warframe variant)', () => {
    const state = resolveAdvancedProgressState('Warframes', 'Excalibur', true, null, {});
    expect(state.prime.has_orokin).toBe(true);
  });

  it('does not force arcane via autoArcane on non-Warframe worksheets when patch turns it off', () => {
    const autoWarframe = resolveAdvancedProgressState('Warframes', 'Excalibur', true, null, {
      has_arcane: false,
    });
    expect(autoWarframe.normal.has_arcane).toBe(true);

    const manualWeapon = resolveAdvancedProgressState('Primary Weapons', 'Boltor', false, null, {
      has_arcane: false,
    });
    expect(manualWeapon.normal.has_arcane).toBe(false);
  });

  it('clears arcane when not relevant for the worksheet (Companions)', () => {
    const state = resolveAdvancedProgressState('Companions', 'Helios', false, null, { has_arcane: true });
    expect(state.normal.has_arcane).toBe(false);
  });

  it('leaves unrelated advanced fields unchanged when only element is patched (non-Warframe)', () => {
    const current = baseRow();
    const next = resolveAdvancedProgressState('Primary Weapons', 'Boltor', false, current, { has_element: false });

    expect(next.normal.level).toBe(15);
    expect(next.prime.level).toBe(10);
    expect(next.normal.valence_percent).toBe(null);
    expect(next.normal.has_orokin).toBe(true);
    expect(next.normal.has_arcane).toBe(false);
    expect(next.normal.has_exilus).toBe(true);
  });

  it('normalizes valence inputs at or above the complete threshold to 60', () => {
    const state = resolveAdvancedProgressState('Primary Weapons', 'Kuva Bramma', false, null, { valence_percent: 58 });
    expect(state.normal.valence_percent).toBe(60);
  });
});

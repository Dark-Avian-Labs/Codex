import { describe, expect, it } from 'vitest';

import {
  AP_DISABLED,
  hasMeaningfulArtifactSlotOverrides,
  isArtifactSlotVisible,
  isWarframeSecondAuraSlotActive,
  normalizeWarframeArtifactSlotsForLoad,
  warframeExilusArtifactIndex,
  warframeSecondAuraApFromStorage,
  warframeUsesExtendedArtifactLayout,
} from './artifactSlotState.js';

describe('hasMeaningfulArtifactSlotOverrides', () => {
  it('returns false for empty or all-universal placeholder arrays', () => {
    expect(hasMeaningfulArtifactSlotOverrides([])).toBe(false);
    expect(hasMeaningfulArtifactSlotOverrides(Array(10).fill('AP_UNIVERSAL'))).toBe(false);
  });

  it('returns true when a real polarity or disabled slot is present', () => {
    expect(hasMeaningfulArtifactSlotOverrides(['AP_DEFENSE', ...Array(9).fill('AP_UNIVERSAL')])).toBe(true);
    expect(hasMeaningfulArtifactSlotOverrides([AP_DISABLED, 'AP_UNIVERSAL'])).toBe(true);
  });
});

describe('artifactSlotState', () => {
  it('hides AP_DISABLED slots when artifact data is present', () => {
    const slots = ['AP_UNIVERSAL', AP_DISABLED];
    expect(isArtifactSlotVisible(slots, 0, true)).toBe(true);
    expect(isArtifactSlotVisible(slots, 1, true)).toBe(false);
  });

  it('uses index 10 for exilus on true 11-slot warframe layouts', () => {
    const slots = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_DEFENSE', 'AP_UNIVERSAL'];
    expect(warframeExilusArtifactIndex(slots)).toBe(10);
  });

  it('treats compact 10-slot layouts as no second aura', () => {
    const compact = Array.from({ length: 10 }, () => 'AP_UNIVERSAL');
    expect(warframeUsesExtendedArtifactLayout(compact)).toBe(false);
    expect(warframeSecondAuraApFromStorage(compact)).toBe(AP_DISABLED);
    expect(isWarframeSecondAuraSlotActive(compact)).toBe(false);
    expect(warframeExilusArtifactIndex(compact)).toBe(9);
  });

  it('loads real 11-slot second aura from index 9', () => {
    const extended = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_DEFENSE', 'AP_UNIVERSAL'];
    expect(warframeUsesExtendedArtifactLayout(extended)).toBe(true);
    expect(warframeSecondAuraApFromStorage(extended)).toBe('AP_DEFENSE');
    expect(isWarframeSecondAuraSlotActive(extended)).toBe(true);
  });

  it('keeps Jade-like 11-slot rows when exilus at index 10 has a real polarity', () => {
    const jadeLike = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_UNIVERSAL', 'AP_ANY'];
    expect(normalizeWarframeArtifactSlotsForLoad(jadeLike)).toHaveLength(11);
    expect(isWarframeSecondAuraSlotActive(jadeLike)).toBe(true);
  });

  it('folds mistaken 11-slot padded rows into compact 10-slot layout', () => {
    const ashMistaken = [...Array.from({ length: 8 }, () => 'AP_UNIVERSAL'), 'AP_ANY', 'AP_UNIVERSAL', 'AP_UNIVERSAL'];
    const normalized = normalizeWarframeArtifactSlotsForLoad(ashMistaken);
    expect(normalized).toHaveLength(10);
    expect(normalized[9]).toBe('AP_UNIVERSAL');
    expect(warframeUsesExtendedArtifactLayout(ashMistaken)).toBe(false);
    expect(isWarframeSecondAuraSlotActive(ashMistaken)).toBe(false);
  });
});

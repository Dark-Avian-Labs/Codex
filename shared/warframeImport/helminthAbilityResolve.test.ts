import { describe, expect, it } from 'vitest';

import {
  canonicalHelminthReplacementUniqueName,
  dedupeHelminthAbilityRows,
  resolveHelminthReplacementAbility,
} from './helminthAbilityResolve.js';

describe('resolveHelminthReplacementAbility', () => {
  const helminthPool = [
    {
      unique_name: '/Lotus/Powersuits/BrokenFrame/Abilities/BrokenRotAbility',
      name: "Xata's Whisper",
    },
    {
      unique_name: '/Lotus/Powersuits/PowersuitAbilities/BrokenRotAbility',
      name: "Xata's Whisper",
    },
  ];

  it('resolves legacy PowersuitAbilities path to canonical /Abilities/ row', () => {
    const resolved = resolveHelminthReplacementAbility(
      '/Lotus/Powersuits/PowersuitAbilities/BrokenRotAbility',
      helminthPool,
    );
    expect(resolved?.unique_name).toBe('/Lotus/Powersuits/BrokenFrame/Abilities/BrokenRotAbility');
  });

  it('dedupes helminth list the same way', () => {
    const deduped = dedupeHelminthAbilityRows(helminthPool);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.unique_name).toBe('/Lotus/Powersuits/BrokenFrame/Abilities/BrokenRotAbility');
  });

  it('canonicalizes stored path for saves', () => {
    expect(
      canonicalHelminthReplacementUniqueName('/Lotus/Powersuits/PowersuitAbilities/BrokenRotAbility', helminthPool),
    ).toBe('/Lotus/Powersuits/BrokenFrame/Abilities/BrokenRotAbility');
  });
});

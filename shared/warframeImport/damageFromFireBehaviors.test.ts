import { describe, expect, it } from 'vitest';

import { damagePerShotFromAttackData, damagePerShotFromFireBehaviors } from './damageFromFireBehaviors.js';

describe('damageFromFireBehaviors', () => {
  it('parses Panzer Claws slash + toxin breakdown', () => {
    const damage = damagePerShotFromAttackData({
      Amount: 90,
      DT_SLASH: 45,
      DT_POISON: 45,
      UseNewFormat: 1,
      Type: 'DT_SLASH',
    });

    expect(damage?.[2]).toBe(45);
    expect(damage?.[6]).toBe(45);
  });

  it('parses legacy physical fractions for Adarza Claws', () => {
    const damage = damagePerShotFromAttackData({
      Amount: 90,
      DT_PUNCTURE: 0.5,
      DT_SLASH: 0.5,
      UseNewFormat: 0,
      Type: 'DT_PHYSICAL',
    });

    expect(damage?.[1]).toBe(45);
    expect(damage?.[2]).toBe(45);
  });

  it('parses combined secondary damage from fire_behaviors JSON', () => {
    const fireBehaviors = JSON.stringify([
      {
        'impact:WeaponImpactBehavior': {
          AttackData: {
            Amount: 80,
            DT_IMPACT: 40,
            DT_MAGNETIC: 40,
            UseNewFormat: 1,
            Type: 'DT_SLASH',
          },
        },
      },
    ]);

    const damage = damagePerShotFromFireBehaviors(fireBehaviors);
    expect(damage?.[0]).toBe(40);
    expect(damage?.[10]).toBe(40);
  });
});

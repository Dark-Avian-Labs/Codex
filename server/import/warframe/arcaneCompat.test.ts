import { describe, expect, it } from 'vitest';

import { classifyArcaneCompatTags, isOperatorOnlyArcane } from './arcaneCompat.js';

describe('classifyArcaneCompatTags', () => {
  it('tags Longbow Sharpshoot as primary (not generic warframe-only)', () => {
    const tags = classifyArcaneCompatTags(
      '/Lotus/Upgrades/EternalOnes/TheFragmented/TestLongbowSharpshoot',
      'Longbow Sharpshoot',
    );
    expect(tags).toContain('primary');
    expect(tags).not.toContain('warframe');
  });

  it('still tags ordinary Primary prefixed arcanes', () => {
    const tags = classifyArcaneCompatTags('/Lotus/Test', 'Primary Deadhead');
    expect(tags).toContain('primary');
  });

  it('tags Magus operator suit arcanes by path or name', () => {
    const tags = classifyArcaneCompatTags(
      '/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/ArmourOnOperatorMode',
      'Magus Husk',
    );
    expect(tags).toContain('operator');
    expect(tags).not.toContain('warframe');
  });

  it('tags Virtuos amp arcanes', () => {
    const tags = classifyArcaneCompatTags(
      '/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/AttackSpeedOnKill',
      'Virtuos Tempo',
    );
    expect(tags).toContain('amp');
    expect(tags).not.toContain('warframe');
  });

  it('never tags operator-only export arcanes as warframe', () => {
    const operatorOnly = [
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/ArmourOnOperatorMode', 'Magus Husk'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/DamageReductionOnVoidMode', 'Magus Firewall'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HealthOnOperatorMode', 'Magus Vigor'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HeatResistOnBlast', 'Magus Accelerant'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/HoverboardSpeedOnTransferenceIn', 'Magus Drive'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/PullOnTransferenceIn', 'Magus Anomaly'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorArmour/RobotStunOnBlast', 'Magus Overload'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/AttackSpeedOnKill', 'Virtuos Tempo'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/OperatorAmmoRegenOnKill', 'Virtuos Null'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/VoidToElectricDamage', 'Virtuos Surge'],
      ['/Lotus/Upgrades/CosmeticEnhancers/OperatorAmps/VoidToPunctureDamage', 'Virtuos Spike'],
    ] as const;
    for (const [uniqueName, name] of operatorOnly) {
      expect(isOperatorOnlyArcane(uniqueName, name)).toBe(true);
      expect(classifyArcaneCompatTags(uniqueName, name)).not.toContain('warframe');
    }
  });
});

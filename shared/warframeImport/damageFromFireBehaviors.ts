export const DAMAGE_PER_SHOT_LENGTH = 20;

const ATTACK_DATA_DT_TO_INDEX: Record<string, number> = {
  DT_IMPACT: 0,
  DT_PUNCTURE: 1,
  DT_SLASH: 2,
  DT_FIRE: 3,
  DT_FREEZE: 4,
  DT_ELECTRICITY: 5,
  DT_POISON: 6,
  DT_EXPLOSION: 7,
  DT_RADIATION: 8,
  DT_GAS: 9,
  DT_MAGNETIC: 10,
  DT_VIRAL: 11,
  DT_CORROSIVE: 12,
};

const TYPE_ONLY_DT_TO_INDEX: Record<string, number> = {
  DT_IMPACT: 0,
  DT_PUNCTURE: 1,
  DT_SLASH: 2,
  DT_FIRE: 3,
  DT_FREEZE: 4,
  DT_ELECTRICITY: 5,
  DT_POISON: 6,
};

function emptyDamageArray(): number[] {
  return Array.from({ length: DAMAGE_PER_SHOT_LENGTH }, () => 0);
}

function getAttackDataFromBehaviors(behaviors: unknown): Record<string, unknown> | null {
  if (!Array.isArray(behaviors) || behaviors.length === 0) return null;
  const first = behaviors[0];
  if (!first || typeof first !== 'object') return null;

  const impact = (first as Record<string, unknown>)['impact:WeaponImpactBehavior'];
  if (!impact || typeof impact !== 'object') return null;

  const attackData = (impact as Record<string, unknown>).AttackData;
  if (!attackData || typeof attackData !== 'object') return null;

  return attackData as Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function applyLegacyPhysicalFractions(
  damage: number[],
  amount: number,
  attackData: Record<string, unknown>,
): boolean {
  let applied = false;

  for (const [dtKey, index] of Object.entries(ATTACK_DATA_DT_TO_INDEX)) {
    if (index > 2) continue;
    const fraction = toNumber(attackData[dtKey]);
    if (fraction == null || fraction <= 0) continue;
    damage[index] += amount * fraction;
    applied = true;
  }

  return applied;
}

export function damagePerShotFromAttackData(attackData: Record<string, unknown>): number[] | null {
  const amount = toNumber(attackData.Amount);
  if (amount == null || amount <= 0) return null;

  const useNewFormat = attackData.UseNewFormat === 1 || attackData.UseNewFormat === true;
  const damage = emptyDamageArray();

  if (useNewFormat) {
    let hasTypedDamage = false;
    for (const [dtKey, index] of Object.entries(ATTACK_DATA_DT_TO_INDEX)) {
      const value = toNumber(attackData[dtKey]);
      if (value == null || value <= 0) continue;
      damage[index] += value;
      hasTypedDamage = true;
    }

    if (!hasTypedDamage) {
      const type = typeof attackData.Type === 'string' ? attackData.Type : '';
      const typeIndex = TYPE_ONLY_DT_TO_INDEX[type];
      if (typeIndex != null) {
        damage[typeIndex] = amount;
      }
    }

    return damage.some((value) => value > 0) ? damage : null;
  }

  if (applyLegacyPhysicalFractions(damage, amount, attackData)) {
    return damage;
  }

  const type = typeof attackData.Type === 'string' ? attackData.Type : '';
  const typeIndex = TYPE_ONLY_DT_TO_INDEX[type];
  if (typeIndex != null) {
    damage[typeIndex] = amount;
    return damage;
  }

  return null;
}

export function damagePerShotFromFireBehaviors(
  fireBehaviors: string | null | undefined,
): number[] | null {
  if (!fireBehaviors?.trim()) return null;

  try {
    const behaviors: unknown = JSON.parse(fireBehaviors);
    const attackData = getAttackDataFromBehaviors(behaviors);
    if (!attackData) return null;
    return damagePerShotFromAttackData(attackData);
  } catch {
    return null;
  }
}

export function serializeDamagePerShot(damage: number[]): string {
  return JSON.stringify(damage);
}

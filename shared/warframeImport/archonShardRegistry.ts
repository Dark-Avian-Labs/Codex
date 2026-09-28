export const ARCHON_COLORS = ['Crimson', 'Amber', 'Azure', 'Emerald', 'Topaz', 'Violet'] as const;

export type ArchonColor = (typeof ARCHON_COLORS)[number];
export type ArchonVariant = 'Common' | 'Tauforged';

export const ARCHON_BUFF_SLUGS_BY_COLOR: Record<ArchonColor, readonly string[]> = {
  Crimson: [
    'MeleeCritDamage',
    'PrimaryStatusChance',
    'SecondaryStatusChance',
    'AbilityStrength',
    'AbilityDuration',
  ],
  Amber: [
    'MaximumEnergy',
    'HealthOrbEffectiveness',
    'EnergyOrbEffectiveness',
    'CastingSpeed',
    'ParkourVelocity',
  ],
  Azure: ['MaxHealth', 'MaxShield', 'MaxEnergy', 'Armor', 'HealthRegen'],
  Emerald: ['ToxinDamage', 'HealthPerToxin', 'AbilityDamageOnCorrosion', 'MaxCorrosionStacks'],
  Topaz: [
    'HealthPerBlast',
    'ShieldPerBlast',
    'SecondaryCritChanceOnHeat',
    'AbilityDamageOnRadiation',
  ],
  Violet: [
    'AbilityDamageOnElectricity',
    'PrimaryElectricityDamage',
    'MeleeCritDamageEnergy',
    'Equilibrium',
  ],
};

const ARMORY_ARCHON_PREFIX = '/Armory/Archon/';

export function archonSlugForSortOrder(color: ArchonColor, sortOrder: number): string | undefined {
  if (!Number.isInteger(sortOrder) || sortOrder < 1) return undefined;
  return ARCHON_BUFF_SLUGS_BY_COLOR[color][sortOrder - 1];
}

export function archonSortOrderForSlug(color: ArchonColor, buffSlug: string): number | undefined {
  const index = ARCHON_BUFF_SLUGS_BY_COLOR[color].indexOf(buffSlug);
  return index >= 0 ? index + 1 : undefined;
}

export function buildArchonShardKey(
  color: ArchonColor,
  variant: ArchonVariant,
  buffSlug: string,
): string {
  return `${ARMORY_ARCHON_PREFIX}${color}/${variant}/${buffSlug}`;
}

export interface ParsedArchonShardKey {
  color: ArchonColor;
  variant: ArchonVariant;
  buffSlug: string;
}

export function parseArchonShardKey(key: string): ParsedArchonShardKey | null {
  if (!key.startsWith(ARMORY_ARCHON_PREFIX)) return null;
  const rest = key.slice(ARMORY_ARCHON_PREFIX.length);
  const parts = rest.split('/');
  if (parts.length !== 3) return null;
  const [color, variant, buffSlug] = parts;
  if (!ARCHON_COLORS.includes(color as ArchonColor)) return null;
  if (variant !== 'Common' && variant !== 'Tauforged') return null;
  if (!buffSlug) return null;
  const slugs = ARCHON_BUFF_SLUGS_BY_COLOR[color as ArchonColor];
  if (!slugs.includes(buffSlug)) return null;
  return { color: color as ArchonColor, variant, buffSlug };
}

export function archonVariantFromTauforged(tauforged: boolean): ArchonVariant {
  return tauforged ? 'Tauforged' : 'Common';
}

export function applyArchonSlugToBonuses(
  buffSlug: string,
  value: number,
  valueFormat: string,
  bonuses: {
    abilityStrengthPct?: number;
    abilityDurationPct?: number;
    abilityEfficiencyPct?: number;
    abilityRangePct?: number;
    sprintSpeedPct?: number;
    sprintSpeedFlat?: number;
    armorPct?: number;
    armorFlat?: number;
    shieldPct?: number;
    shieldFlat?: number;
    energyPct?: number;
    energyFlat?: number;
    healthPct?: number;
    healthFlat?: number;
  },
): void {
  const pct = valueFormat === '%' ? value / 100 : 0;
  const flat = valueFormat === '%' ? 0 : value;

  switch (buffSlug) {
    case 'AbilityStrength':
      bonuses.abilityStrengthPct = (bonuses.abilityStrengthPct ?? 0) + pct;
      break;
    case 'AbilityDuration':
      bonuses.abilityDurationPct = (bonuses.abilityDurationPct ?? 0) + pct;
      break;
    case 'MaximumEnergy':
    case 'MaxEnergy':
      bonuses.energyPct = (bonuses.energyPct ?? 0) + pct;
      bonuses.energyFlat = (bonuses.energyFlat ?? 0) + flat;
      break;
    case 'CastingSpeed':
      bonuses.abilityEfficiencyPct = (bonuses.abilityEfficiencyPct ?? 0) + pct;
      break;
    case 'ParkourVelocity':
      bonuses.sprintSpeedPct = (bonuses.sprintSpeedPct ?? 0) + pct;
      bonuses.sprintSpeedFlat = (bonuses.sprintSpeedFlat ?? 0) + flat;
      break;
    case 'MaxHealth':
      bonuses.healthPct = (bonuses.healthPct ?? 0) + pct;
      bonuses.healthFlat = (bonuses.healthFlat ?? 0) + flat;
      break;
    case 'MaxShield':
      bonuses.shieldPct = (bonuses.shieldPct ?? 0) + pct;
      bonuses.shieldFlat = (bonuses.shieldFlat ?? 0) + flat;
      break;
    case 'Armor':
      bonuses.armorPct = (bonuses.armorPct ?? 0) + pct;
      bonuses.armorFlat = (bonuses.armorFlat ?? 0) + flat;
      break;
    case 'HealthRegen':
      bonuses.healthFlat = (bonuses.healthFlat ?? 0) + flat;
      break;
    default:
      break;
  }
}

export function allArchonBuffCatalogKeys(): string[] {
  const keys: string[] = [];
  for (const color of ARCHON_COLORS) {
    for (const buffSlug of ARCHON_BUFF_SLUGS_BY_COLOR[color]) {
      keys.push(buildArchonShardKey(color, 'Common', buffSlug));
      keys.push(buildArchonShardKey(color, 'Tauforged', buffSlug));
    }
  }
  return keys;
}

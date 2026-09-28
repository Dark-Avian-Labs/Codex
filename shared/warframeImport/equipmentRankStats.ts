import { WARFRAME_RANK_EXCEPTIONS_BY_UNIQUE_NAME } from './warframeRankExceptions.generated.js';

export const WARFRAME_MAX_RANK = 30;
export const COMPANION_MAX_RANK = 30;
export const NECRAMECH_STAT_MAX_RANK = 30;
export const NECRAMECH_ITEM_MAX_RANK = 40;

export interface RankStatBonuses {
  health: number;
  shield: number;
  energy: number;
  armor: number;
}

export interface RankScaleableStats {
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
}

export interface RankScaleableEntity extends RankScaleableStats {
  unique_name: string;
  product_category?: string | null;
}

export const NECRAMECH_RANK_30_BONUSES: RankStatBonuses = {
  health: 1000,
  shield: 200,
  energy: 50,
  armor: 0,
};

export function standardWarframeRankBonusesAtRank(rank: number): RankStatBonuses {
  const clamped = Math.max(0, Math.min(rank, WARFRAME_MAX_RANK));
  let health = 0;
  let shield = 0;
  let energy = 0;

  for (let r = 1; r <= clamped; r++) {
    if ((r - 1) % 3 === 0) health += 10;
    if (r >= 2 && (r - 2) % 3 === 0) shield += 10;
    if (r >= 3 && (r - 3) % 3 === 0) energy += 5;
  }

  return { health, shield, energy, armor: 0 };
}

export const DEFAULT_WARFRAME_RANK_30_BONUSES: RankStatBonuses =
  standardWarframeRankBonusesAtRank(WARFRAME_MAX_RANK);

export function isNecramechEntity(uniqueName: string, productCategory?: string | null): boolean {
  if (productCategory === 'MechSuits') return true;
  return uniqueName.includes('/EntratiMech/');
}

export function getRank30Bonuses(
  uniqueName: string,
  productCategory?: string | null,
): RankStatBonuses {
  if (isNecramechEntity(uniqueName, productCategory)) {
    return NECRAMECH_RANK_30_BONUSES;
  }
  return WARFRAME_RANK_EXCEPTIONS_BY_UNIQUE_NAME[uniqueName] ?? DEFAULT_WARFRAME_RANK_30_BONUSES;
}

export function getAvatarRankBonuses(
  uniqueName: string,
  productCategory?: string | null,
): RankStatBonuses {
  return getRank30Bonuses(uniqueName, productCategory);
}

export function scaleAvatarStatsToMaxRank(entity: RankScaleableEntity): {
  health: number;
  shield: number;
  armor: number;
  power: number;
} {
  const bonuses = getAvatarRankBonuses(entity.unique_name, entity.product_category);
  const baseShield = entity.shield ?? 0;

  return {
    health: (entity.health ?? 0) + bonuses.health,
    shield: baseShield + (baseShield > 0 ? bonuses.shield : 0),
    armor: (entity.armor ?? 0) + bonuses.armor,
    power: (entity.power ?? 0) + bonuses.energy,
  };
}

export function scaleWarframeStatsToMaxRank(warframe: RankScaleableEntity) {
  return scaleAvatarStatsToMaxRank(warframe);
}

export function scaleCompanionStatsToMaxRank(companion: RankScaleableEntity) {
  return scaleAvatarStatsToMaxRank(companion);
}

import path from 'path';

export const WOR_DB_PATH =
  process.env.WOR_DB_PATH?.trim() || path.join(process.env.DATA_DIR ?? './data', 'wor.db');

export const WOR_IMAGES_DIR =
  process.env.WOR_IMAGES_DIR?.trim() || path.join(process.env.DATA_DIR ?? './data', 'wor-images');

export {
  ARTIFACT_GAUGE_EMPTY,
  ARTIFACT_GAUGE_FILLED,
  ARTIFACT_PROMOTION_MAX,
  CLASS_DISPLAY_NAMES,
  FACTION_DISPLAY_NAMES,
  FACTIONS,
  GAUGE_COLORS,
  HERO_AWAKENING_LABELS,
  HERO_AWAKENING_MAX,
  HERO_CLASSES,
  RARITY_STAR_COUNTS,
  rarityToStarRating,
} from './constants.js';
export type { FactionKey, HeroClassKey } from './constants.js';

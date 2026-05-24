import path from 'path';

export const EPIC7_DB_PATH =
  process.env.EPIC7_DB_PATH?.trim() || path.join(process.env.DATA_DIR ?? './data', 'epic7.db');

export {
  ARTIFACT_CLASSES,
  ARTIFACT_GAUGE_EMPTY,
  ARTIFACT_GAUGE_FILLED,
  ARTIFACT_GAUGE_MAX,
  CLASS_DISPLAY_NAMES,
  ELEMENT_DISPLAY_NAMES,
  ELEMENTS,
  GAUGE_COLORS,
  HERO_CLASSES,
  HERO_RATINGS,
  RATING_COLORS,
  STAR_RATINGS,
} from './constants.js';
export type { ClassKey, ElementKey, HeroClassKey } from './constants.js';

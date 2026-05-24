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
export { EPIC7_DB_PATH } from './config.js';
export { closeDb as closeEpic7Db, getDb as getEpic7Db } from './db/schema.js';
export * as epic7Queries from './db/queries.js';
export {
  addAccountSchema as epic7AddAccountSchema,
  addArtifactSchema as epic7AddArtifactSchema,
  addHeroSchema as epic7AddHeroSchema,
  adminAddBaseArtifactSchema as epic7AdminAddBaseArtifactSchema,
  adminAddBaseHeroSchema as epic7AdminAddBaseHeroSchema,
  adminDeleteBaseArtifactSchema as epic7AdminDeleteBaseArtifactSchema,
  adminDeleteBaseHeroSchema as epic7AdminDeleteBaseHeroSchema,
  deleteAccountSchema as epic7DeleteAccountSchema,
  deleteArtifactSchema as epic7DeleteArtifactSchema,
  deleteHeroSchema as epic7DeleteHeroSchema,
  switchAccountSchema as epic7SwitchAccountSchema,
  updateAccountSchema as epic7UpdateAccountSchema,
  updateArtifactDetailsSchema as epic7UpdateArtifactDetailsSchema,
  updateArtifactSchema as epic7UpdateArtifactSchema,
  updateHeroDetailsSchema as epic7UpdateHeroDetailsSchema,
  updateHeroSchema as epic7UpdateHeroSchema,
} from './routes/validation.js';

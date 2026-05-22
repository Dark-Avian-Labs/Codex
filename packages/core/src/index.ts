export { log, type LogLevel } from './logger.js';
export {
  APP_NAME,
  CODEX_APP_ID,
  resolveEnvFilePath,
  SESSION_DB_PATH,
  CENTRAL_DB_PATH,
  COOKIE_DOMAIN,
  BASE_HOST,
  GAME_HOSTS,
} from './config.js';
export {
  createSessionSchema,
  createCentralSchema,
  getSessionDb,
  getCentralDb,
  closeSessionDb,
  closeCentralDb,
} from './db/schema.js';
export { isAppAdmin, metadataFromSessionClaims, APP_ADMIN_ROLE } from './auth/clerk.js';
export type { AppMetadata } from './auth/clerk.js';
export { isEncryptedEnvValue, normalizeClerkEnv } from './auth/clerkEnv.js';
export { ensureClerkUserIdColumn, LEGACY_USER_ID_TO_CLERK } from './auth/migrateClerkUserId.js';
export type { AuthSession } from './auth.js';
export {
  clerkMiddleware,
  getAuth,
  getClerkAuthState,
  requireAuth,
  requireAdmin,
  requireCodexAdmin,
  requireGameAccess,
  requireAuthApi,
  redirectIfAuthenticated,
} from './middleware/auth.js';
export type { ClerkAuthState } from './middleware/auth.js';
export { getAppPublicBaseUrl } from './middleware/appPublicBaseUrl.js';
export type { GameModule, GameMountOptions, GameTheme } from './types/game.js';
export { createDbSingleton } from './db/singleton.js';
export type { DbSingleton, DbSingletonOptions } from './db/singleton.js';

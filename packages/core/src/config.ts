import fs from 'fs';
import path from 'path';

import { config as loadEnv } from '@dotenvx/dotenvx';

const projectRoot = process.cwd();
export function resolveEnvFilePath(rootPath: string): string | null {
  const normalizedNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

  if (normalizedNodeEnv === 'test') {
    const testPath = path.join(rootPath, '.env.test');
    return fs.existsSync(testPath) ? testPath : null;
  }

  const envFileByMode: Record<string, string> = {
    production: '.env.production',
    development: '.env.development',
  };
  const prioritizedFiles = [
    envFileByMode[normalizedNodeEnv],
    '.env.production',
    '.env.development',
  ].filter((value, index, values): value is string => {
    return typeof value === 'string' && values.indexOf(value) === index;
  });

  for (const fileName of prioritizedFiles) {
    if (!fileName) continue;
    const candidatePath = path.join(rootPath, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

const skipDotenvx = process.env.USE_DOTENVX === 'false';
const envPath = skipDotenvx ? null : resolveEnvFilePath(projectRoot);
if (envPath) {
  try {
    loadEnv({ path: envPath });
  } catch (error) {
    console.error(`[Core Config] Failed to load environment via loadEnv from "${envPath}".`, error);
    throw error;
  }
} else {
  if (skipDotenvx) {
    console.debug('[Core Config] Skipping dotenvx (USE_DOTENVX=false).');
  } else {
    console.debug(
      `[Core Config] No env file resolved for project root "${projectRoot}" (NODE_ENV="${process.env.NODE_ENV ?? ''}").`,
    );
  }
}

export const APP_NAME = 'Codex';
export const CODEX_APP_ID = process.env.APP_ID?.trim().toLowerCase() || 'codex';

const _sessionDbPath = process.env.SESSION_DB_PATH?.trim() || process.env.CENTRAL_DB_PATH?.trim();
if (!_sessionDbPath) {
  throw new Error(
    'SESSION_DB_PATH must be set to an absolute SQLite path for express-session storage.',
  );
}
if (!path.isAbsolute(_sessionDbPath)) {
  throw new Error('SESSION_DB_PATH must be absolute; relative paths are not supported.');
}
export const SESSION_DB_PATH = _sessionDbPath;

export const CENTRAL_DB_PATH = SESSION_DB_PATH;

const _COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
if (!_COOKIE_DOMAIN) {
  throw new Error('COOKIE_DOMAIN must be set.');
}
export const COOKIE_DOMAIN: string = _COOKIE_DOMAIN;

const _BASE_HOST = process.env.BASE_HOST;
if (!_BASE_HOST) {
  throw new Error('BASE_HOST must be set.');
}
export const BASE_HOST: string = _BASE_HOST;

export const AUTH_SERVICE_URL = '';

export const GAME_HOSTS: Record<string, string> = (() => {
  const raw = process.env.GAME_HOSTS;
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim();
    if (trimmed.split('=').length !== 2) {
      if (trimmed) {
        console.warn(
          '[config] GAME_HOSTS: entry must have exactly one "=" (host=gameId), got:',
          trimmed,
        );
      }
      continue;
    }
    const parts = trimmed.split('=', 2).map((s) => s.trim());
    const [host, gameId] = parts;
    if (host && gameId) {
      out[host] = gameId;
    } else if (trimmed) {
      console.warn(
        '[config] GAME_HOSTS: skipping malformed entry (expected host=gameId):',
        trimmed,
      );
    }
  }
  return out;
})();

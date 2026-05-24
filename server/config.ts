import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  getAppPublicBaseUrl,
  normalizeClerkEnv,
  requireAbsoluteSqlitePath,
  resolveEnvFilePath,
} from '@codex/core';
import { config as loadEnv } from '@dotenvx/dotenvx';

const projectRoot = process.cwd();
const envKeysPath = path.join(projectRoot, '.env.keys');
if (fs.existsSync(envKeysPath)) {
  try {
    loadEnv({ path: envKeysPath });
  } catch (error) {
    console.error(`[Config] Failed to load environment keys from "${envKeysPath}".`, error);
    throw error;
  }
}

const envPath = resolveEnvFilePath(projectRoot);
if (envPath) {
  try {
    loadEnv({ path: envPath });
  } catch (error) {
    console.error(`[Config] Failed to load environment via loadEnv from "${envPath}".`, error);
    throw error;
  }
} else {
  console.debug(
    `[Config] No env file resolved (envPath is null); skipping loadEnv for cwd "${projectRoot}".`,
  );
}

normalizeClerkEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function readPackageVersion(projectRoot: string): string {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    const v = pkg.version?.trim();
    return v && v.length > 0 ? v : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION = readPackageVersion(PROJECT_ROOT);

export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
process.env.DATA_DIR = DATA_DIR;

function resolveGameDbEnvPath(
  envKey: 'WARFRAME_DB_PATH' | 'EPIC7_DB_PATH',
  defaultFilename: string,
): string {
  const raw = process.env[envKey]?.trim();
  const resolved = raw
    ? path.isAbsolute(raw)
      ? raw
      : path.resolve(PROJECT_ROOT, raw)
    : path.join(DATA_DIR, defaultFilename);
  const validated = requireAbsoluteSqlitePath(envKey, resolved);
  process.env[envKey] = validated;
  return validated;
}

export const WARFRAME_DB_PATH = resolveGameDbEnvPath('WARFRAME_DB_PATH', 'warframe.db');
export const EPIC7_DB_PATH = resolveGameDbEnvPath('EPIC7_DB_PATH', 'epic7.db');

function resolveSessionDbPath(): string {
  const session = process.env.SESSION_DB_PATH?.trim();
  if (session) return requireAbsoluteSqlitePath('SESSION_DB_PATH', session);
  return path.join(DATA_DIR, 'session.db');
}

export const SESSION_DB_PATH = resolveSessionDbPath();
process.env.SESSION_DB_PATH = SESSION_DB_PATH;

export const ARMORY_DB_PATH = requireAbsoluteSqlitePath(
  'ARMORY_DB_PATH',
  process.env.ARMORY_DB_PATH,
);

const _port = parseInt(process.env.PORT || '3001', 10);
export const PORT = Number.isFinite(_port) && _port > 0 ? _port : 3001;
export const HOST = process.env.HOST || '0.0.0.0';
export const APP_NAME = process.env.APP_NAME?.trim() || 'Codex';
export const APP_ID = process.env.APP_ID?.trim() || 'codex';
export const NODE_ENV = process.env.NODE_ENV || 'production';

const DEV_SESSION_SECRET = 'codex-dev-only-session-secret-32ch';
const rawSessionSecret =
  process.env.SESSION_SECRET?.trim() || (NODE_ENV === 'production' ? '' : DEV_SESSION_SECRET);
if (NODE_ENV === 'production' && rawSessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters in production.');
}
export const SESSION_SECRET = rawSessionSecret;

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

export const TRUST_PROXY = parseBooleanEnv(process.env.TRUST_PROXY) ?? false;
export const SECURE_COOKIES =
  parseBooleanEnv(process.env.SECURE_COOKIES) ?? NODE_ENV === 'production';
const ALLOWED_PROTOCOLS = ['http', 'https'] as const;
type AllowedProtocol = (typeof ALLOWED_PROTOCOLS)[number];

function validateBaseProtocol(value: string | undefined): AllowedProtocol {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'https';
  if (ALLOWED_PROTOCOLS.includes(normalized as AllowedProtocol)) {
    return normalized as AllowedProtocol;
  }

  console.warn(`Invalid BASE_PROTOCOL "${value}" provided; falling back to "https".`);
  return 'https';
}

export const BASE_PROTOCOL = validateBaseProtocol(process.env.BASE_PROTOCOL);

export const BASE_DOMAIN = process.env.BASE_DOMAIN?.trim().toLowerCase() || '';
if (!BASE_DOMAIN) {
  throw new Error('BASE_DOMAIN must be set.');
}
const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
function isValidDomain(domain: string): boolean {
  const domainLabels = domain.split('.');
  return (
    domain.length <= 253 &&
    domainLabels.length >= 2 &&
    domainLabels.every(
      (label) => label.length >= 1 && label.length <= 63 && DOMAIN_LABEL_REGEX.test(label),
    ) &&
    domainLabels[domainLabels.length - 1].length >= 2
  );
}

const hasValidBaseDomain = isValidDomain(BASE_DOMAIN);
if (!hasValidBaseDomain) {
  throw new Error('BASE_DOMAIN must be a valid domain.');
}

export const APP_SUBDOMAIN = process.env.APP_SUBDOMAIN?.trim().toLowerCase() || APP_ID;
if (!DOMAIN_LABEL_REGEX.test(APP_SUBDOMAIN)) {
  throw new Error('APP_SUBDOMAIN is invalid.');
}

export const APP_PUBLIC_BASE_URL = getAppPublicBaseUrl();
const configuredCookieDomain = process.env.COOKIE_DOMAIN?.trim().toLowerCase() || '';
let resolvedCookieDomain = `.${BASE_DOMAIN}`;

if (configuredCookieDomain) {
  const cookieDomainWithoutDot = configuredCookieDomain.replace(/^\./, '');
  if (!isValidDomain(cookieDomainWithoutDot)) {
    console.warn(
      `Invalid COOKIE_DOMAIN "${configuredCookieDomain}" provided; falling back to ".${BASE_DOMAIN}".`,
    );
  } else {
    resolvedCookieDomain = `.${cookieDomainWithoutDot}`;
  }
}

export const COOKIE_DOMAIN = resolvedCookieDomain;

export const LEGAL_PAGE_URL =
  process.env.VITE_LEGAL_PAGE_URL?.trim() ||
  process.env.LEGAL_PAGE_URL?.trim() ||
  'https://darkavianlabs.com/legal/';

export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME?.trim() || 'darkavianlabs.codex.sid';

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(SESSION_DB_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(ARMORY_DB_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(WARFRAME_DB_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(EPIC7_DB_PATH), { recursive: true });
}

ensureDataDirs();

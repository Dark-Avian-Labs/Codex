export type DalAppNavEntry = {
  id: string;
  name: string;
  icon: string;
  href: string;
};

export type DalAppNavDocument = {
  version: 1;
  updatedAt: string;
  apps: DalAppNavEntry[];
};

export const DEFAULT_DAL_APP_NAV_URL = '/api/dal-app-nav';
export const DAL_APP_NAV_UPSTREAM_URL = 'https://darkavianlabs.com/dal-app-nav.json';

const CACHE_KEY = 'dal.app-nav.cache.v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachePayload = {
  fetchedAt: number;
  document: DalAppNavDocument;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseDalAppNavDocument(raw: unknown): DalAppNavDocument | null {
  if (raw === null || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (!isNonEmptyString(record.updatedAt)) return null;
  if (!Array.isArray(record.apps)) return null;

  const apps: DalAppNavEntry[] = [];
  for (const item of record.apps) {
    if (item === null || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    if (!isNonEmptyString(entry.id)) return null;
    if (!isNonEmptyString(entry.name)) return null;
    if (!isNonEmptyString(entry.icon)) return null;
    if (!isNonEmptyString(entry.href) || !isHttpUrl(entry.href.trim())) return null;
    apps.push({
      id: entry.id.trim(),
      name: entry.name.trim(),
      icon: entry.icon.trim(),
      href: entry.href.trim(),
    });
  }

  return {
    version: 1,
    updatedAt: record.updatedAt.trim(),
    apps,
  };
}

export function normalizeAppId(id: string): string {
  return id.trim().toLowerCase().replace(/-/g, '');
}

export function appIdsMatch(a: string, b: string): boolean {
  return normalizeAppId(a) === normalizeAppId(b);
}

function readCache(): CachePayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.fetchedAt !== 'number') return null;
    const document = parseDalAppNavDocument(record.document);
    if (!document) return null;
    return { fetchedAt: record.fetchedAt, document };
  } catch {
    return null;
  }
}

function writeCache(document: DalAppNavDocument): void {
  try {
    const payload: CachePayload = { fetchedAt: Date.now(), document };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function getDalAppNavUrl(): string {
  const fromEnv =
    typeof import.meta.env.VITE_DAL_APP_NAV_URL === 'string'
      ? import.meta.env.VITE_DAL_APP_NAV_URL.trim()
      : '';
  return fromEnv.length > 0 ? fromEnv : DEFAULT_DAL_APP_NAV_URL;
}

/**
 * Load the shared app catalog. Fail closed: null when fetch fails and no cache.
 * Stale cache may still be returned when a refresh fails.
 */
export async function loadDalAppNav(): Promise<DalAppNavDocument | null> {
  const cached = readCache();
  const cacheFresh = cached !== null && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (cacheFresh) {
    void refreshDalAppNav().catch(() => {
      // background refresh; keep serving cache
    });
    return cached.document;
  }

  try {
    return await refreshDalAppNav();
  } catch {
    return cached?.document ?? null;
  }
}

async function refreshDalAppNav(): Promise<DalAppNavDocument> {
  const response = await fetch(getDalAppNavUrl(), {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`dal-app-nav HTTP ${response.status}`);
  }
  const json: unknown = await response.json();
  const document = parseDalAppNavDocument(json);
  if (!document) {
    throw new Error('dal-app-nav invalid document');
  }
  writeCache(document);
  return document;
}

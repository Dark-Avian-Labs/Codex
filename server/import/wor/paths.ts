import fs from 'node:fs';
import path from 'node:path';

import { DATA_DIR, PROJECT_ROOT } from '../../config.js';

export const WOR_IMPORT_DIR = path.join(DATA_DIR, 'wor-import');
export const WOR_IMPORT_CACHE_DIR = path.join(WOR_IMPORT_DIR, 'cache');
export const WOR_IMPORT_HASHES_PATH = path.join(WOR_IMPORT_DIR, '.processed-source-hashes.json');
export const WOR_IMPORT_FIXTURE_CACHE_DIR = path.join(
  PROJECT_ROOT,
  'scripts',
  'data',
  'wor-import-cache',
);
export const WOR_OVERRIDES_PATH = path.join(PROJECT_ROOT, 'scripts', 'data', 'wor-overrides.json');

export const FASTIDIOUS_BASE_URL = 'https://fastidious.gg';
export const WOR_FANDOM_API_URL = 'https://watcher-of-realms.fandom.com/api.php';

export function ensureWorImportDirs(): void {
  fs.mkdirSync(WOR_IMPORT_CACHE_DIR, { recursive: true });
  fs.mkdirSync(path.join(WOR_IMPORT_CACHE_DIR, 'demon-details'), { recursive: true });
}

export function isWorImportLiveEnabled(): boolean {
  if (process.env.WOR_IMPORT_LIVE === '1') return true;
  if (process.env.WOR_IMPORT_OFFLINE === '1') return false;
  return process.env.NODE_ENV !== 'test';
}

export function resolveWorImportCacheDir(): string {
  if (isWorImportLiveEnabled()) return WOR_IMPORT_CACHE_DIR;
  if (fs.existsSync(path.join(WOR_IMPORT_FIXTURE_CACHE_DIR, 'heroes.json'))) {
    return WOR_IMPORT_FIXTURE_CACHE_DIR;
  }
  return WOR_IMPORT_CACHE_DIR;
}

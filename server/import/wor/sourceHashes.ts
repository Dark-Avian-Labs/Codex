import { createHash } from 'node:crypto';
import fs from 'node:fs';

import { WOR_IMPORT_HASHES_PATH, WOR_OVERRIDES_PATH } from './paths.js';

export type WorSourceHashes = {
  fastidious_heroes?: string;
  fastidious_artifacts?: string;
  fastidious_demons?: string;
  overrides?: string;
};

export function hashFileContents(filePath: string): string {
  const raw = fs.readFileSync(filePath);
  return createHash('sha256').update(raw).digest('hex');
}

export function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function readProcessedSourceHashes(): WorSourceHashes | null {
  if (!fs.existsSync(WOR_IMPORT_HASHES_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(WOR_IMPORT_HASHES_PATH, 'utf8')) as WorSourceHashes;
  } catch {
    return null;
  }
}

export function writeProcessedSourceHashes(hashes: WorSourceHashes): void {
  fs.mkdirSync(WOR_IMPORT_HASHES_PATH.replace(/[^/\\]+$/, ''), { recursive: true });
  fs.writeFileSync(WOR_IMPORT_HASHES_PATH, `${JSON.stringify(hashes, null, 2)}\n`, 'utf8');
}

export function computeCurrentSourceHashes(cacheDir: string): WorSourceHashes {
  const hashes: WorSourceHashes = {};
  for (const key of ['heroes', 'artifacts', 'demons'] as const) {
    const filePath = `${cacheDir}/${key}.json`;
    if (fs.existsSync(filePath)) {
      hashes[`fastidious_${key}`] = hashFileContents(filePath);
    }
  }
  if (fs.existsSync(WOR_OVERRIDES_PATH)) {
    hashes.overrides = hashFileContents(WOR_OVERRIDES_PATH);
  }
  return hashes;
}

export function fastidiousSourcesChanged(
  current: WorSourceHashes,
  previous: WorSourceHashes | null,
): boolean {
  if (!previous) return true;
  for (const key of ['fastidious_heroes', 'fastidious_artifacts', 'fastidious_demons'] as const) {
    if (current[key] !== previous[key]) return true;
  }
  return false;
}

export function overridesChanged(
  current: WorSourceHashes,
  previous: WorSourceHashes | null,
): boolean {
  if (!previous) return true;
  return current.overrides !== previous.overrides;
}

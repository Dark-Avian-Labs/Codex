import fs from 'fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'path';

import { DATA_DIR, PROJECT_ROOT } from '../../config.js';

const SOURCE_PATH = path.join(PROJECT_ROOT, 'scripts/data/warframe-rank-exceptions.json');
const OUT_PATH = path.join(
  PROJECT_ROOT,
  'shared/warframeImport/warframeRankExceptions.generated.ts',
);
const COMPILED_OUT_PATH = path.join(
  PROJECT_ROOT,
  'dist/shared/warframeImport/warframeRankExceptions.generated.js',
);
const GENERATOR_SCRIPT = path.join(PROJECT_ROOT, 'scripts/generate-warframe-rank-exceptions.mjs');
const PROCESSED_SOURCE_HASH_FILE = path.join(
  DATA_DIR,
  '.processed-warframe-rank-exceptions-source.hash',
);

export interface WarframeRankExceptionBonuses {
  health: number;
  shield: number;
  energy: number;
  armor: number;
}

export interface WarframeRankExceptionRow {
  uniqueName: string;
  name: string;
  bonuses: WarframeRankExceptionBonuses;
}

function readSourceRows(): WarframeRankExceptionRow[] {
  const raw = fs.readFileSync(SOURCE_PATH, 'utf8');
  const rows = JSON.parse(raw) as unknown;
  if (!Array.isArray(rows)) {
    throw new Error('warframe-rank-exceptions.json must be an array');
  }

  const byUniqueName: Record<string, WarframeRankExceptionBonuses> = {};
  for (const row of rows) {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof (row as WarframeRankExceptionRow).uniqueName !== 'string' ||
      !(row as WarframeRankExceptionRow).bonuses
    ) {
      throw new Error(`Invalid row: ${JSON.stringify(row)}`);
    }
    const typed = row as WarframeRankExceptionRow;
    if (byUniqueName[typed.uniqueName]) {
      throw new Error(`Duplicate uniqueName: ${typed.uniqueName}`);
    }
    byUniqueName[typed.uniqueName] = typed.bonuses;
  }

  return rows as WarframeRankExceptionRow[];
}

export function hashWarframeRankExceptionsSource(): string {
  const raw = fs.readFileSync(SOURCE_PATH, 'utf8');
  return createHash('sha256').update(raw).digest('hex');
}

function readProcessedSourceHash(): string | null {
  try {
    if (!fs.existsSync(PROCESSED_SOURCE_HASH_FILE)) return null;
    const hash = fs.readFileSync(PROCESSED_SOURCE_HASH_FILE, 'utf8').trim();
    return hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

function writeProcessedSourceHash(hash: string): void {
  fs.mkdirSync(path.dirname(PROCESSED_SOURCE_HASH_FILE), { recursive: true });
  fs.writeFileSync(PROCESSED_SOURCE_HASH_FILE, hash, 'utf8');
}

export function isWarframeRankExceptionsSourceAvailable(): boolean {
  return fs.existsSync(SOURCE_PATH);
}

export function isWarframeRankExceptionsRegistryAvailable(): boolean {
  return fs.existsSync(OUT_PATH) || fs.existsSync(COMPILED_OUT_PATH);
}

export function warframeRankExceptionsSourceChanged(): boolean {
  if (!isWarframeRankExceptionsSourceAvailable()) {
    return false;
  }
  if (!fs.existsSync(OUT_PATH)) return true;
  const currentHash = hashWarframeRankExceptionsSource();
  const previousHash = readProcessedSourceHash();
  return previousHash === null || previousHash !== currentHash;
}

export function generateWarframeRankExceptions(): { entryCount: number } {
  if (!isWarframeRankExceptionsSourceAvailable()) {
    throw new Error(
      `Cannot regenerate warframe rank exceptions: source JSON not found at ${SOURCE_PATH}`,
    );
  }
  if (!fs.existsSync(GENERATOR_SCRIPT)) {
    throw new Error(`Cannot regenerate warframe rank exceptions: missing ${GENERATOR_SCRIPT}`);
  }

  execFileSync(process.execPath, [GENERATOR_SCRIPT], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  writeProcessedSourceHash(hashWarframeRankExceptionsSource());

  return { entryCount: readSourceRows().length };
}

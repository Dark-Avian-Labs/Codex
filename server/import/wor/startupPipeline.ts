import fs from 'node:fs';
import path from 'node:path';

import { log } from '@codex/core';
import { getWorDb, worQueries } from '@codex/game-wor';
import type Database from 'better-sqlite3';

import { PROJECT_ROOT, WOR_IMAGES_DIR } from '../../config.js';
import {
  bumpCatalogVersion,
  getCatalogCounts,
  upsertCatalogArtifacts,
  upsertCatalogDemons,
  upsertCatalogHeroes,
  type CatalogBundle,
} from './catalogQueries.js';

export type WorImportLogLine = {
  ts: string;
  level: 'info' | 'error';
  message: string;
};

export type WorImportSummary = {
  heroes: number;
  artifacts: number;
  demons: number;
};

export type WorStartupPipelineOptions = {
  fixturePath?: string;
  overridesPath?: string;
  forceImport?: boolean;
  onLog?: (line: WorImportLogLine) => void;
};

const DEFAULT_FIXTURE = path.join(PROJECT_ROOT, 'scripts', 'data', 'wor-catalog-fixture.json');
const DEFAULT_OVERRIDES = path.join(PROJECT_ROOT, 'scripts', 'data', 'wor-overrides.json');

function nowIso(): string {
  return new Date().toISOString();
}

function emit(
  onLog: WorStartupPipelineOptions['onLog'],
  level: WorImportLogLine['level'],
  message: string,
): void {
  const line = { ts: nowIso(), level, message };
  onLog?.(line);
  if (level === 'error') {
    log('error', `[wor-import] ${message}`);
  } else {
    log('info', `[wor-import] ${message}`);
  }
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function applyOverrides(bundle: CatalogBundle, overridesPath: string): CatalogBundle {
  if (!fs.existsSync(overridesPath)) return bundle;
  const overrides = readJsonFile<{
    heroes?: Record<string, Partial<CatalogBundle['heroes'][number]>>;
    artifacts?: Record<string, Partial<CatalogBundle['artifacts'][number]>>;
    demons?: Record<string, Partial<CatalogBundle['demons'][number]>>;
  }>(overridesPath);

  const heroes = bundle.heroes.map((hero) => ({
    ...hero,
    ...(overrides.heroes?.[hero.slug] ?? {}),
  }));
  const artifacts = bundle.artifacts.map((artifact) => ({
    ...artifact,
    ...(overrides.artifacts?.[artifact.slug] ?? {}),
  }));
  const demons = bundle.demons.map((demon) => ({
    ...demon,
    ...(overrides.demons?.[demon.slug] ?? {}),
  }));
  return { heroes, artifacts, demons };
}

async function loadCatalogBundle(options: WorStartupPipelineOptions): Promise<CatalogBundle> {
  const fixturePath = options.fixturePath ?? DEFAULT_FIXTURE;
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Catalog fixture not found: ${fixturePath}`);
  }
  const bundle = readJsonFile<CatalogBundle>(fixturePath);
  const overridesPath = options.overridesPath ?? DEFAULT_OVERRIDES;
  return applyOverrides(bundle, overridesPath);
}

export async function runWorStartupPipeline(
  options: WorStartupPipelineOptions = {},
): Promise<WorImportSummary> {
  const onLog = options.onLog;
  const db = getWorDb() as Database.Database;

  emit(onLog, 'info', 'Loading catalog fixture…');
  const bundle = await loadCatalogBundle(options);
  emit(
    onLog,
    'info',
    `Loaded ${bundle.heroes.length} heroes, ${bundle.artifacts.length} artifacts, ${bundle.demons.length} demons from fixture.`,
  );

  fs.mkdirSync(WOR_IMAGES_DIR, { recursive: true });

  const heroCount = upsertCatalogHeroes(db, bundle.heroes);
  emit(onLog, 'info', `Upserted ${heroCount} catalog heroes.`);
  const artifactCount = upsertCatalogArtifacts(db, bundle.artifacts);
  emit(onLog, 'info', `Upserted ${artifactCount} catalog artifacts.`);
  const demonCount = upsertCatalogDemons(db, bundle.demons);
  emit(onLog, 'info', `Upserted ${demonCount} catalog demons.`);

  bumpCatalogVersion(db);
  worQueries.syncNewCatalogEntriesToAllAccounts(db);
  emit(onLog, 'info', 'Synced new catalog entries to all game accounts.');

  const counts = getCatalogCounts(db);
  emit(
    onLog,
    'info',
    `Catalog ready: ${counts.heroes} heroes, ${counts.artifacts} artifacts, ${counts.demons} demons.`,
  );

  return counts;
}

export function catalogNeedsImport(db: Database.Database): boolean {
  return !worQueries.catalogHasEntries(db);
}

import fs from 'node:fs';
import path from 'node:path';

import { log } from '@codex/core';
import { ensureWorCoreTables, getWorDb, worQueries } from '@codex/game-wor';
import type Database from 'better-sqlite3';

import { WOR_IMAGES_DIR, PROJECT_ROOT } from '../../config.js';
import {
  bumpCatalogVersion,
  getCatalogCounts,
  upsertCatalogArtifacts,
  upsertCatalogDemons,
  upsertCatalogHeroes,
  type CatalogBundle,
} from './catalogQueries.js';
import {
  downloadCatalogPortraits,
  downloadClassAndFactionIcons,
  type WorImageDownloadSummary,
} from './fandomImages.js';
import { fetchFastidiousCatalog, type FastidiousImageRef } from './fastidiousCatalog.js';
import { applyWorOverrides } from './overrides.js';
import {
  ensureWorImportDirs,
  isWorImportLiveEnabled,
  resolveWorImportCacheDir,
  WOR_IMPORT_FIXTURE_CACHE_DIR,
} from './paths.js';
import {
  shouldRunWorStep,
  worImagesOnlyMissing,
  type WorPipelineStepOptions,
} from './pipelineStepControl.js';
import {
  computeCurrentSourceHashes,
  fastidiousSourcesChanged,
  overridesChanged,
  readProcessedSourceHashes,
  writeProcessedSourceHashes,
} from './sourceHashes.js';
import { listMissingStarAssets, validateWorCatalogBundle } from './validateCatalog.js';
import type { WorPipelineStepKey } from './worPipelineSteps.js';
import { WOR_PIPELINE_STEP_LABELS } from './worPipelineSteps.js';

export type WorImportLogLine = {
  ts: string;
  level: 'info' | 'error';
  message: string;
};

export type WorImportSummary = {
  heroes: number;
  artifacts: number;
  demons: number;
  imageSummary?: WorImageDownloadSummary;
  missingStarAssets?: string[];
  validationWarnings?: string[];
  missingPortraits?: string[];
};

export type WorStartupPipelineOptions = WorPipelineStepOptions & {
  fixturePath?: string;
  overridesPath?: string;
  onLog?: (line: WorImportLogLine) => void;
};

const DEFAULT_FIXTURE = path.join(PROJECT_ROOT, 'scripts', 'data', 'wor-catalog-fixture.json');

const CATALOG_MUTATION_STEPS: WorPipelineStepKey[] = [
  'fastidiousCatalog',
  'manualOverrides',
  'fandomImages',
  'seedValidation',
];

function catalogPipelineRequested(options: WorStartupPipelineOptions): boolean {
  if (!options.forceSteps?.length) return true;
  return options.forceSteps.some((step) => CATALOG_MUTATION_STEPS.includes(step));
}

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

function stepTag(step: WorPipelineStepKey): string {
  return WOR_PIPELINE_STEP_LABELS[step];
}

function readFixtureBundle(fixturePath: string): CatalogBundle {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw) as CatalogBundle;
}

function loadExistingPortraitPaths(db: Database.Database): {
  heroes: Record<string, string | null>;
  artifacts: Record<string, string | null>;
  demons: Record<string, string | null>;
} {
  const heroes = Object.fromEntries(
    (
      db.prepare('SELECT slug, portrait_path FROM catalog_heroes').all() as {
        slug: string;
        portrait_path: string | null;
      }[]
    ).map((row) => [row.slug, row.portrait_path]),
  );
  const artifacts = Object.fromEntries(
    (
      db.prepare('SELECT slug, portrait_path FROM catalog_artifacts').all() as {
        slug: string;
        portrait_path: string | null;
      }[]
    ).map((row) => [row.slug, row.portrait_path]),
  );
  const demons = Object.fromEntries(
    (
      db.prepare('SELECT slug, portrait_path FROM catalog_demons').all() as {
        slug: string;
        portrait_path: string | null;
      }[]
    ).map((row) => [row.slug, row.portrait_path]),
  );
  return { heroes, artifacts, demons };
}

function updateSourceHashesInDb(
  db: Database.Database,
  hashes: Record<string, string | undefined>,
): void {
  db.prepare(`UPDATE catalog_meta SET source_hashes_json = ? WHERE id = 1`).run(
    JSON.stringify(hashes),
  );
}

export async function runWorStartupPipeline(
  options: WorStartupPipelineOptions = {},
): Promise<WorImportSummary> {
  const onLog = options.onLog;
  const db = getWorDb() as Database.Database;
  ensureWorImportDirs();
  fs.mkdirSync(WOR_IMAGES_DIR, { recursive: true });

  let bundle: CatalogBundle | null = null;
  let imageRefs: FastidiousImageRef | null = null;
  let classIcons: Awaited<ReturnType<typeof fetchFastidiousCatalog>>['classIcons'] = {};
  let factionIcons: Awaited<ReturnType<typeof fetchFastidiousCatalog>>['factionIcons'] = {};
  let imageSummary: WorImageDownloadSummary | undefined;
  const validationWarnings: string[] = [];
  const cacheDir = resolveWorImportCacheDir();
  const live = isWorImportLiveEnabled();
  const previousHashes = readProcessedSourceHashes();
  const currentHashes = computeCurrentSourceHashes(cacheDir);

  // schema
  if (shouldRunWorStep('schema', true, options)) {
    emit(onLog, 'info', `[${stepTag('schema')}] Ensuring WoR catalog tables…`);
    ensureWorCoreTables(db);
  }

  // fastidiousCatalog
  const catalogWouldRun =
    live ||
    fs.existsSync(path.join(cacheDir, 'heroes.json')) ||
    fs.existsSync(path.join(WOR_IMPORT_FIXTURE_CACHE_DIR, 'heroes.json'));
  const useFixtureOnly =
    !catalogWouldRun && options.fixturePath
      ? true
      : !catalogWouldRun && fs.existsSync(DEFAULT_FIXTURE);

  if (shouldRunWorStep('fastidiousCatalog', catalogWouldRun || useFixtureOnly, options)) {
    if (useFixtureOnly && !catalogWouldRun) {
      const fixturePath = options.fixturePath ?? DEFAULT_FIXTURE;
      emit(
        onLog,
        'info',
        `[${stepTag('fastidiousCatalog')}] Loading dev fixture from ${fixturePath}…`,
      );
      bundle = readFixtureBundle(fixturePath);
      imageRefs = {
        heroes: {},
        artifacts: {},
        demons: {},
        storageUrl: 'https://fastidious.gg/storage/',
        storageVersion: '1',
      };
    } else if (
      shouldRunWorStep(
        'fastidiousCatalog',
        fastidiousSourcesChanged(currentHashes, previousHashes),
        options,
      )
    ) {
      emit(onLog, 'info', `[${stepTag('fastidiousCatalog')}] Fetching Fastidious metadata…`);
      const result = await fetchFastidiousCatalog({
        live,
        onLog: (message) => emit(onLog, 'info', `[${stepTag('fastidiousCatalog')}] ${message}`),
      });
      bundle = result.bundle;
      imageRefs = result.imageRefs;
      classIcons = result.classIcons;
      factionIcons = result.factionIcons;
      writeProcessedSourceHashes({ ...currentHashes });
      updateSourceHashesInDb(db, currentHashes);
    } else {
      emit(onLog, 'info', `[${stepTag('fastidiousCatalog')}] Skipped — source cache unchanged.`);
      const result = await fetchFastidiousCatalog({
        live: false,
        onLog: (message) => emit(onLog, 'info', `[${stepTag('fastidiousCatalog')}] ${message}`),
      });
      bundle = result.bundle;
      imageRefs = result.imageRefs;
      classIcons = result.classIcons;
      factionIcons = result.factionIcons;
    }
  } else {
    emit(onLog, 'info', `[${stepTag('fastidiousCatalog')}] Skipped.`);
  }

  if (!bundle && catalogPipelineRequested(options) && (catalogWouldRun || useFixtureOnly)) {
    emit(
      onLog,
      'info',
      `[${stepTag('fastidiousCatalog')}] Reusing cached catalog for downstream steps…`,
    );
    const result = await fetchFastidiousCatalog({
      live: false,
      onLog: (message) => emit(onLog, 'info', `[${stepTag('fastidiousCatalog')}] ${message}`),
    });
    bundle = result.bundle;
    imageRefs = result.imageRefs;
    classIcons = result.classIcons;
    factionIcons = result.factionIcons;
  }

  if (!bundle && catalogPipelineRequested(options)) {
    throw new Error('Catalog bundle unavailable after fastidiousCatalog step.');
  }

  // manualOverrides
  if (
    shouldRunWorStep('manualOverrides', overridesChanged(currentHashes, previousHashes), options)
  ) {
    emit(onLog, 'info', `[${stepTag('manualOverrides')}] Applying overrides…`);
  } else {
    emit(onLog, 'info', `[${stepTag('manualOverrides')}] Skipped — overrides unchanged.`);
  }
  if (bundle) {
    bundle = applyWorOverrides(bundle);
  }

  // fandomImages
  const imagesWouldRun =
    live || Boolean(process.env.WIKI_USER_AGENT?.trim()) || Object.keys(classIcons).length > 0;
  if (bundle && imageRefs && shouldRunWorStep('fandomImages', imagesWouldRun, options)) {
    emit(onLog, 'info', `[${stepTag('fandomImages')}] Downloading class and faction icons…`);
    const iconSummary = await downloadClassAndFactionIcons({
      classIcons,
      factionIcons,
      forceDownload: options.forceImages,
      onLog: (message) => emit(onLog, 'info', `[${stepTag('fandomImages')}] ${message}`),
    });

    if (!process.env.WIKI_USER_AGENT?.trim()) {
      emit(
        onLog,
        'info',
        `[${stepTag('fandomImages')}] WIKI_USER_AGENT not set — using Fastidious card images for portraits.`,
      );
    }
    const portraitResult = await downloadCatalogPortraits({
      bundle,
      imageRefs,
      existingPortraitPaths: loadExistingPortraitPaths(db),
      onlyMissing: worImagesOnlyMissing(options),
      forceDownload: options.forceImages,
      onLog: (message) => emit(onLog, 'info', `[${stepTag('fandomImages')}] ${message}`),
    });
    bundle = portraitResult.bundle;
    imageSummary = {
      ...iconSummary,
      portraitsDownloaded:
        iconSummary.portraitsDownloaded + portraitResult.summary.portraitsDownloaded,
      portraitsSkipped: iconSummary.portraitsSkipped + portraitResult.summary.portraitsSkipped,
      portraitsFailed: iconSummary.portraitsFailed + portraitResult.summary.portraitsFailed,
      missingPortraits: portraitResult.summary.missingPortraits,
      failedPortraitDetails: portraitResult.summary.failedPortraitDetails,
    };
  } else {
    emit(onLog, 'info', `[${stepTag('fandomImages')}] Skipped.`);
  }

  // seedValidation
  if (bundle && shouldRunWorStep('seedValidation', true, options)) {
    emit(onLog, 'info', `[${stepTag('seedValidation')}] Validating catalog bundle…`);
    const validation = validateWorCatalogBundle(bundle);
    for (const issue of validation.issues) {
      const message = `[${stepTag('seedValidation')}] ${issue.message}`;
      if (issue.level === 'error') emit(onLog, 'error', message);
      else {
        emit(onLog, 'info', message);
        validationWarnings.push(issue.message);
      }
    }
    if (!validation.ok) {
      throw new Error('Catalog validation failed.');
    }
  }

  if (bundle) {
    const heroCount = upsertCatalogHeroes(db, bundle.heroes);
    emit(onLog, 'info', `Upserted ${heroCount} catalog heroes.`);
    const artifactCount = upsertCatalogArtifacts(db, bundle.artifacts);
    emit(onLog, 'info', `Upserted ${artifactCount} catalog artifacts.`);
    const demonCount = upsertCatalogDemons(db, bundle.demons);
    emit(onLog, 'info', `Upserted ${demonCount} catalog demons.`);

    bumpCatalogVersion(db);
  } else {
    emit(onLog, 'info', 'Skipping catalog upsert — no catalog bundle loaded.');
  }

  if (shouldRunWorStep('sync_accounts', true, options)) {
    worQueries.syncNewCatalogEntriesToAllAccounts(db);
    emit(
      onLog,
      'info',
      `[${stepTag('sync_accounts')}] Synced new catalog entries to all game accounts.`,
    );
  }

  const counts = getCatalogCounts(db);
  emit(
    onLog,
    'info',
    `Catalog ready: ${counts.heroes} heroes, ${counts.artifacts} artifacts, ${counts.demons} demons.`,
  );

  const missingStarAssets = listMissingStarAssets(
    path.join(PROJECT_ROOT, 'packages', 'games', 'wor', 'assets'),
  );
  if (missingStarAssets.length > 0) {
    emit(onLog, 'info', `Missing UI star assets in package: ${missingStarAssets.join(', ')}`);
  }

  if (imageSummary?.missingPortraits.length) {
    emit(
      onLog,
      'info',
      `${imageSummary.missingPortraits.length} entities still lack portraits (see import summary).`,
    );
  }

  return {
    ...counts,
    imageSummary,
    missingStarAssets,
    validationWarnings,
    missingPortraits: imageSummary?.missingPortraits,
  };
}

export function catalogNeedsImport(db: Database.Database): boolean {
  return !worQueries.catalogHasEntries(db);
}

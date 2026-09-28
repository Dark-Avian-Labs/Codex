import fs from 'fs';
import path from 'path';

import { log as writeLog } from '@codex/core';

import type { PipelineStepKey } from '../../../shared/warframeImport/pipelineSteps.js';
import { EXPORTS_DIR, PROJECT_ROOT, REQUIRED_EXPORTS } from '../../config.js';
import { getCatalogDb } from './db/connection.js';
import { processExports, backfillModDescriptions } from './db/queries.js';
import { resetCatalogData } from './db/resetCatalogData.js';
import { createAppSchema } from './db/schema.js';
import { syncHelminthFlagsFromWiki } from './helminthWiki.js';
import { ensureOverframeFetchReady } from './http/fetchOverframe.js';
import { downloadImages } from './images.js';
import {
  ImportAlreadyRunningError,
  isImportLeaseHeld,
  noteImportLeaseHeartbeat,
  releaseImportLease,
  touchLiveImportLease,
  tryAcquireImportLease,
  type ImportLeaseWatch,
} from './importRuns.js';
import { runImportPipeline, listExportFiles } from './pipeline.js';
import { isStepForced, shouldRunStep, usesOnlyMissingMode } from './pipelineStepControl.js';
import {
  printStartupPipelineSummary,
  type StartupPipelineSummary,
  type SummaryOutcome,
} from './pipelineSummary.js';
import {
  countModsMissingAtragraphImages,
  syncAtragraphModsFromWiki,
} from './scraping/atragraphModsWiki.js';
import { mergeScrapedData } from './scraping/dataMerger.js';
import {
  countMissingExaltedStanceSeeds,
  syncExaltedStanceModsFromOverframe,
  syncExaltedStanceWikiImagesOnly,
} from './scraping/exaltedStanceMods.js';
import { beastClawsNeedSync, syncBeastClawsFromWiki } from './scraping/hiddenCompanionWeapons.js';
import { syncIncarnonFromWiki } from './scraping/incarnonWiki.js';
import { countItemsMissingOverframeData, scrapeIndex } from './scraping/indexScraper.js';
import { scrapeItems } from './scraping/itemScraper.js';
import {
  countWeaponsMissingFireBehaviors,
  syncWeaponFireBehaviorsFromWiki,
} from './scraping/weaponFireBehaviorsWiki.js';
import { hasArchonShardDataInDb, runWikiScrape } from './scraping/wikiScraper.js';
import { populateWarframeMarketLinksTable } from './warframeMarket/populateWarframeMarketLinks.js';
import {
  generateWarframeRankExceptions,
  isWarframeRankExceptionsSourceAvailable,
  warframeRankExceptionsSourceChanged,
} from './warframeRankExceptions.js';

const TAG = '[DataPipeline]';
const EXPORT_HASH_STATE_FILE = path.join(EXPORTS_DIR, '.processed-export-hashes.json');

async function prepareOverframeFetch(): Promise<void> {
  await ensureOverframeFetchReady();
}

function getCurrentExportHashes(): Record<string, string> {
  const files = listExportFiles();
  const required = files.filter((f) =>
    REQUIRED_EXPORTS.some((prefix) => f.category.startsWith(prefix)),
  );
  const map: Record<string, string> = {};
  for (const file of required) {
    map[file.category] = file.hash || '';
  }
  return map;
}

function readProcessedExportHashes(): Record<string, string> | null {
  try {
    if (!fs.existsSync(EXPORT_HASH_STATE_FILE)) return null;
    const raw = fs.readFileSync(EXPORT_HASH_STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

function writeProcessedExportHashes(hashes: Record<string, string>): void {
  fs.writeFileSync(EXPORT_HASH_STATE_FILE, JSON.stringify(hashes, null, 2), 'utf-8');
}

function hashesChanged(
  current: Record<string, string>,
  previous: Record<string, string> | null,
): boolean {
  if (!previous) return true;
  const currentKeys = Object.keys(current).sort();
  const previousKeys = Object.keys(previous).sort();
  if (currentKeys.length !== previousKeys.length) return true;
  for (let i = 0; i < currentKeys.length; i++) {
    if (currentKeys[i] !== previousKeys[i]) return true;
    const key = currentKeys[i];
    if ((previous[key] || '') !== (current[key] || '')) return true;
  }
  return false;
}

function hasExportFiles(): boolean {
  try {
    const files = listExportFiles();
    return files.length > 0;
  } catch {
    return false;
  }
}

function missingRequiredExports(): string[] {
  let categories: string[] = [];
  try {
    categories = listExportFiles().map((file) => file.category);
  } catch {
    return [...REQUIRED_EXPORTS];
  }
  return REQUIRED_EXPORTS.filter(
    (prefix) => !categories.some((category) => category.startsWith(prefix)),
  );
}

function exportHashChanged(
  category: string,
  current: Record<string, string>,
  previous: Record<string, string> | null,
): boolean {
  if (!previous) return true;
  return (previous[category] || '') !== (current[category] || '');
}

function upgradesExportChanged(
  current: Record<string, string>,
  previous: Record<string, string> | null,
): boolean {
  const upgradesKey = Object.keys(current).find((key) => key.startsWith('ExportUpgrades'));
  if (!upgradesKey) return false;
  return exportHashChanged(upgradesKey, current, previous);
}

function hasIncarnonDataInDb(): boolean {
  try {
    const db = getCatalogDb();
    const row = db
      .prepare(
        'SELECT COUNT(*) as c FROM weapons WHERE has_incarnon = 1 AND incarnon_data IS NOT NULL',
      )
      .get() as { c: number };
    return row.c > 0;
  } catch {
    return false;
  }
}

function hasDbData(): boolean {
  try {
    const db = getCatalogDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM warframes').get() as { c: number }).c;
    return count > 0;
  } catch {
    return false;
  }
}

function emptySummary(start: number): StartupPipelineSummary {
  return {
    durationMs: Date.now() - start,
    schema: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    officialExports: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    sqliteFromExports: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    warframeRankExceptions: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    exaltedStanceMods: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    atragraphMods: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    images: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    hiddenCompanionWeapons: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    overframe: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    wiki: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    helminthWiki: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    incarnonWiki: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    warframeMarketLinks: { outcome: 'skipped', detail: 'Pipeline did not reach this step.' },
    blockingIssues: [],
  };
}

export interface StartupPipelineOptions {
  cliReport?: boolean;
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: PipelineStepKey[];
  reporter?: (line: string, level: 'info' | 'error') => void;
  importRunId?: number;
  skipLease?: boolean;
  heldLockToken?: string;
}

export async function runStartupPipeline(
  options: StartupPipelineOptions = {},
): Promise<StartupPipelineSummary> {
  const manageLease = options.skipLease !== true;
  let lockToken: string | null = null;
  if (manageLease) {
    if (isImportLeaseHeld()) {
      throw new ImportAlreadyRunningError();
    }
    lockToken = tryAcquireImportLease(options.importRunId ?? null);
    if (!lockToken) {
      throw new ImportAlreadyRunningError();
    }
  } else {
    lockToken = options.heldLockToken ?? null;
  }

  const leaseWatch: ImportLeaseWatch = { lost: false };
  try {
    const heartbeat = lockToken
      ? setInterval(
          () => {
            noteImportLeaseHeartbeat(lockToken, leaseWatch);
          },
          5 * 60 * 1000,
        )
      : null;
    heartbeat?.unref();
    try {
      return await runStartupPipelineInner(options, lockToken, leaseWatch);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  } finally {
    if (manageLease && lockToken) {
      releaseImportLease(lockToken);
    }
  }
}

async function runStartupPipelineInner(
  options: StartupPipelineOptions = {},
  lockToken: string | null = null,
  leaseWatch: ImportLeaseWatch = { lost: false },
): Promise<StartupPipelineSummary> {
  const startTime = Date.now();
  const cli = options.cliReport === true;
  const forceImport = options.forceImport === true;
  const forceImages = options.forceImages === true;

  const emit = (level: 'info' | 'error', msg: string): void => {
    touchLiveImportLease(lockToken, leaseWatch);
    const line = `${TAG} ${msg}`;
    options.reporter?.(line, level);
    writeLog(level, msg, { source: 'startupPipeline' });
  };
  const log = (msg: string) => emit('info', msg);
  const err = (msg: string, e?: unknown) => {
    const detail = e !== undefined ? (e instanceof Error ? e.message : String(e)) : '';
    emit('error', detail ? `${msg} ${detail}` : msg);
  };

  const summary = emptySummary(startTime);

  if (forceImport || forceImages || (options.forceSteps?.length ?? 0) > 0) {
    const flags = [
      forceImport && 'forceImport',
      forceImages && 'forceImages',
      options.forceSteps?.length ? `forceSteps=${options.forceSteps.join(',')}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    log(`Starting pipeline with force flags: ${flags}`);
  }

  log('[Schema] Ensuring SQLite schema...');
  try {
    createAppSchema();
    summary.schema = { outcome: 'ok', detail: 'App tables and indexes are ready.' };
  } catch (e) {
    summary.schema = {
      outcome: 'failed',
      detail: 'Schema creation failed.',
      error: e instanceof Error ? e.message : String(e),
    };
    err('[Schema] Failed —', e);
    summary.durationMs = Date.now() - startTime;
    summary.blockingIssues.push('Schema creation failed; pipeline stopped.');
    if (cli) printStartupPipelineSummary(summary);
    return summary;
  }

  log('[Exports] Downloading manifest and export files...');
  try {
    const importResult = await runImportPipeline((status) => {
      if (status.error) {
        err(`[Exports] ${status.message}`);
        return;
      }
      if (!status.message.includes('Skipping')) {
        log(`[Exports] ${status.message}`);
      }
    });
    const failCount = importResult.stats.failed.length;
    summary.officialExports = {
      outcome: failCount > 0 ? 'partial' : 'ok',
      detail:
        `Updated ${importResult.stats.downloaded.length}, ` +
        `unchanged ${importResult.stats.skippedUnchanged.length}` +
        (failCount > 0 ? `, ${failCount} failed` : '') +
        '.',
      stats: importResult.stats,
    };
    for (const failure of importResult.stats.failed) {
      err(`[Exports] Failed ${failure.category}: ${failure.error}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.officialExports = { outcome: 'failed', detail: 'Export download failed.', error: msg };
    err('[Exports] Download failed —', e);
    if (!hasExportFiles()) {
      err('[Exports] No export files on disk, cannot continue.');
      summary.blockingIssues.push('No export JSON files on disk after manifest/download step.');
      summary.durationMs = Date.now() - startTime;
      if (cli) printStartupPipelineSummary(summary);
      return summary;
    }
  }

  if (forceImport) {
    const missingExports = missingRequiredExports();
    if (missingExports.length > 0) {
      err(
        `[Database] Force import aborted — required export(s) missing on disk: ${missingExports.join(', ')}.`,
      );
      summary.blockingIssues.push(
        `Force import aborted before catalog reset: missing required export(s) ${missingExports.join(', ')}.`,
      );
      summary.durationMs = Date.now() - startTime;
      if (cli) printStartupPipelineSummary(summary);
      return summary;
    }

    log('[Database] Force import — all required exports on disk, resetting catalog tables...');
    try {
      const cleared = resetCatalogData();
      const total = Object.values(cleared).reduce((sum, n) => sum + n, 0);
      log(`[Database] Catalog reset complete (${total} row(s) cleared).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.blockingIssues.push(`Catalog reset failed: ${msg}`);
      err('[Database] Catalog reset failed —', e);
      summary.durationMs = Date.now() - startTime;
      if (cli) printStartupPipelineSummary(summary);
      return summary;
    }
  }

  let dataChanged = false;
  let currentExportHashes: Record<string, string> = {};
  let previousExportHashes: Record<string, string> | null = null;
  try {
    currentExportHashes = getCurrentExportHashes();
    previousExportHashes = readProcessedExportHashes();
    const hashChanged = hashesChanged(currentExportHashes, previousExportHashes);
    const rebuildSqlite = forceImport || hashChanged;
    dataChanged = rebuildSqlite;

    if (shouldRunStep('sqliteFromExports', rebuildSqlite, options)) {
      const reason = forceImport
        ? 'Force import requested — rebuilding all game tables.'
        : previousExportHashes === null
          ? 'First run — importing export JSON into database.'
          : 'Export hashes changed — rebuilding game tables.';
      log(`[Database] ${reason}`);
      const counts = processExports({ skipPreserve: forceImport });
      const backfillCount = backfillModDescriptions();
      writeProcessedExportHashes(currentExportHashes);
      log(
        `[Database] Loaded ${counts.warframes} warframes, ${counts.weapons} weapons, ${counts.companions} companions, ` +
          `${counts.mods} mods, ${counts.modSets} mod sets, ${counts.arcanes} arcanes, ${counts.abilities} abilities.`,
      );
      log(`[Database] Mod description backfill: ${backfillCount} row(s).`);
      summary.sqliteFromExports = {
        outcome: 'ok',
        detail: reason,
        rows: counts,
        modDescriptionsBackfilled: backfillCount,
      };
    } else {
      log('[Database] Skipped — export hashes unchanged since last run.');
      summary.sqliteFromExports = {
        outcome: 'skipped',
        detail: 'Export hashes unchanged since last successful build.',
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.sqliteFromExports = {
      outcome: 'failed',
      detail: 'Export processing threw an error.',
      error: msg,
    };
    err('[Database] Processing failed —', e);
    if (!hasDbData()) {
      err('[Database] No data in warframes table, cannot continue.');
      summary.blockingIssues.push('Export DB step failed and warframes table is empty.');
    }
    summary.durationMs = Date.now() - startTime;
    if (cli) printStartupPipelineSummary(summary);
    return summary;
  }

  const rankExceptionsSourceAvailable = isWarframeRankExceptionsSourceAvailable();
  const rankExceptionsSourceChanged =
    rankExceptionsSourceAvailable && warframeRankExceptionsSourceChanged();
  if (shouldRunStep('warframeRankExceptions', rankExceptionsSourceChanged, options)) {
    const reason = isStepForced('warframeRankExceptions', options)
      ? 'Force step requested — regenerating rank exception registry.'
      : !fs.existsSync(
            path.join(PROJECT_ROOT, 'shared/warframeImport/warframeRankExceptions.generated.ts'),
          )
        ? 'Generated registry missing — building from source JSON.'
        : 'Source JSON changed — regenerating rank exception registry.';
    log(`[Rank Exceptions] ${reason}`);
    try {
      const result = generateWarframeRankExceptions();
      log(`[Rank Exceptions] Done — ${result.entryCount} warframe exceptions written.`);
      summary.warframeRankExceptions = {
        outcome: 'ok',
        detail: reason,
        entryCount: result.entryCount,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.warframeRankExceptions = {
        outcome: 'failed',
        detail: 'Could not regenerate warframe rank exception registry.',
        error: msg,
      };
      err('[Rank Exceptions] Failed —', e);
    }
  } else if (!rankExceptionsSourceAvailable) {
    log(
      '[Rank Exceptions] Skipped — source JSON is not in the deployment bundle; using compiled registry.',
    );
    summary.warframeRankExceptions = {
      outcome: 'skipped',
      detail:
        'scripts/data/warframe-rank-exceptions.json is unavailable on this host; using compiled warframe rank exceptions.',
    };
  } else {
    log('[Rank Exceptions] Skipped — source JSON unchanged since last generation.');
    summary.warframeRankExceptions = {
      outcome: 'skipped',
      detail: 'scripts/data/warframe-rank-exceptions.json unchanged since last generation.',
    };
  }

  let warframeMarketLinkRowCount = 0;
  try {
    const db = getCatalogDb();
    warframeMarketLinkRowCount = (
      db.prepare('SELECT COUNT(*) as c FROM warframe_market_links').get() as { c: number }
    ).c;
  } catch {
    warframeMarketLinkRowCount = 0;
  }

  const shouldRefreshWarframeMarket = shouldRunStep(
    'warframeMarketLinks',
    hasDbData() && (dataChanged || warframeMarketLinkRowCount === 0),
    options,
  );

  if (shouldRefreshWarframeMarket) {
    log('[Warframe Market] Building trade link index from api.warframe.market...');
    try {
      const db = getCatalogDb();
      const wmResult = await populateWarframeMarketLinksTable(db);
      log(
        `[Warframe Market] Done — ${wmResult.rowsUpserted} rows upserted, ${wmResult.slugCount} catalog slugs.`,
      );
      summary.warframeMarketLinks = {
        outcome: 'ok',
        detail: `Upserted ${wmResult.rowsUpserted} worksheet rows using ${wmResult.slugCount} market slugs.`,
        rowsUpserted: wmResult.rowsUpserted,
        slugCount: wmResult.slugCount,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.warframeMarketLinks = {
        outcome: 'failed',
        detail: 'Could not refresh Warframe Market link index.',
        error: msg,
      };
      err('[Warframe Market] Failed —', e);
    }
  } else {
    const detail = !hasDbData()
      ? 'Skipped — no game data in SQLite yet.'
      : 'Skipped — link index already populated and export hashes unchanged.';
    log(`[Warframe Market] ${detail}`);
    summary.warframeMarketLinks = {
      outcome: 'skipped',
      detail,
    };
  }

  const weaponsExportChanged = exportHashChanged(
    'ExportWeapons',
    currentExportHashes,
    previousExportHashes,
  );
  const onlyMissingStances = usesOnlyMissingMode('exaltedStanceMods', options);
  const stancesNeedBackfill = countMissingExaltedStanceSeeds() > 0;
  const shouldSyncStancesFromOverframe = shouldRunStep(
    'exaltedStanceMods',
    isStepForced('exaltedStanceMods', options) && (weaponsExportChanged || stancesNeedBackfill),
    options,
  );
  const shouldRefreshStanceWikiImages = shouldRunStep(
    'exaltedStanceMods',
    weaponsExportChanged && !stancesNeedBackfill,
    options,
  );

  if (shouldSyncStancesFromOverframe) {
    await prepareOverframeFetch();
    log('[Exalted Stances] Syncing exalted stance mods from Overframe...');
    try {
      const result = await syncExaltedStanceModsFromOverframe((msg) => {
        log(`[Exalted Stances] ${msg}`);
      }, onlyMissingStances);
      log(
        `[Exalted Stances] Done — ${result.found} found, ${result.insertedOrUpdated} updated, ` +
          `${result.wikiImagesApplied} wiki images.`,
      );
      summary.exaltedStanceMods = {
        outcome: 'ok',
        detail: `Fetched ${result.found} stances, updated ${result.insertedOrUpdated} rows.`,
        found: result.found,
        insertedOrUpdated: result.insertedOrUpdated,
        wikiImagesApplied: result.wikiImagesApplied,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.exaltedStanceMods = { outcome: 'failed', detail: 'Sync failed.', error: msg };
      err('[Exalted Stances] Sync failed —', e);
    }
  } else if (shouldRefreshStanceWikiImages) {
    log(
      '[Exalted Stances] ExportWeapons changed — refreshing Warframe Wiki infobox images for exalted stances...',
    );
    try {
      const result = await syncExaltedStanceWikiImagesOnly((msg) => {
        log(`[Exalted Stances] ${msg}`);
      });
      log(
        `[Exalted Stances] Wiki images done — ${result.applied} applied, ${result.attempted} attempted.`,
      );
      summary.exaltedStanceMods = {
        outcome: 'ok',
        detail:
          'ExportWeapons changed; refreshed stance card art from wiki where infobox images are available.',
        found: 0,
        insertedOrUpdated: 0,
        wikiImagesApplied: result.applied,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.exaltedStanceMods = {
        outcome: 'failed',
        detail: 'Wiki-only exalted stance image refresh failed.',
        error: msg,
      };
      err('[Exalted Stances] Wiki-only image refresh failed —', e);
    }
  } else {
    log('[Exalted Stances] Skipped — ExportWeapons unchanged and stance rows are present.');
    summary.exaltedStanceMods = {
      outcome: 'skipped',
      detail: 'ExportWeapons hash unchanged; no exalted stance sync needed.',
    };
  }

  const upgradesChanged = upgradesExportChanged(currentExportHashes, previousExportHashes);
  const atragraphNeedBackfill = countModsMissingAtragraphImages() > 0;
  const onlyMissingAtragraph = usesOnlyMissingMode('atragraphMods', options) && !upgradesChanged;
  const shouldSyncAtragraphMods = shouldRunStep(
    'atragraphMods',
    upgradesChanged || atragraphNeedBackfill,
    options,
  );

  if (shouldSyncAtragraphMods) {
    const reason = upgradesChanged
      ? 'ExportUpgrades changed — syncing Atragraph mod art from wiki.'
      : 'Atragraph image paths missing — backfilling from wiki.';
    log(`[Atragraph Mods] ${reason}`);
    try {
      const result = await syncAtragraphModsFromWiki({
        onlyMissing: onlyMissingAtragraph,
        onProgress: (msg) => log(msg),
      });
      log(
        `[Atragraph Mods] Done — ${result.setsFound} set(s), ${result.modsUpdated} mod row(s) updated, ` +
          `${result.imagesDownloaded} image(s) downloaded.`,
      );
      summary.atragraphMods = {
        outcome: 'ok',
        detail: reason,
        setsFound: result.setsFound,
        modsUpdated: result.modsUpdated,
        imagesDownloaded: result.imagesDownloaded,
        attempted: result.attempted,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.atragraphMods = {
        outcome: 'failed',
        detail: 'Atragraph wiki sync failed.',
        error: msg,
      };
      err('[Atragraph Mods] Sync failed —', e);
    }
  } else {
    log('[Atragraph Mods] Skipped — ExportUpgrades unchanged and atragraph paths are present.');
    summary.atragraphMods = {
      outcome: 'skipped',
      detail: 'ExportUpgrades hash unchanged; no Atragraph wiki sync needed.',
    };
  }

  log(
    forceImages
      ? '[Images] Force re-downloading all images...'
      : '[Images] Downloading new and changed images...',
  );
  try {
    const imgResult = await downloadImages((done, total, current) => {
      const step = cli ? 200 : 500;
      if (done === 1 || done % step === 0 || done === total) {
        log(`[Images] ${done}/${total} — ${current}`);
      }
    }, forceImages);
    if (imgResult.downloaded > 0) {
      log(
        `[Images] Done — ${imgResult.downloaded} downloaded, ${imgResult.skipped} skipped` +
          (imgResult.failed > 0 ? `, ${imgResult.failed} failed` : '') +
          '.',
      );
    } else {
      log(`[Images] Done — all ${imgResult.skipped} images up to date.`);
    }
    for (const imageError of imgResult.errors) {
      err(`[Images] Failed ${imageError}`);
    }
    const imgOutcome: SummaryOutcome =
      imgResult.failed > 0 ? (imgResult.downloaded > 0 ? 'partial' : 'failed') : 'ok';
    summary.images = {
      outcome: imgOutcome,
      detail:
        imgResult.downloaded > 0
          ? `Downloaded ${imgResult.downloaded}, skipped ${imgResult.skipped}, failed ${imgResult.failed}.`
          : `All ${imgResult.skipped} images up to date.`,
      total: imgResult.total,
      downloaded: imgResult.downloaded,
      skipped: imgResult.skipped,
      failed: imgResult.failed,
      sampleErrors: imgResult.errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.images = { outcome: 'failed', detail: 'Image download failed.', error: msg };
    err('[Images] Download failed —', e);
  }

  const onlyMissingCompanions = usesOnlyMissingMode('hiddenCompanionWeapons', options);
  if (
    shouldRunStep(
      'hiddenCompanionWeapons',
      dataChanged || beastClawsNeedSync(onlyMissingCompanions),
      options,
    )
  ) {
    log('[Companion Weapons] Syncing beast claws from wiki...');
    try {
      const result = await syncBeastClawsFromWiki((msg) => {
        log(`[Companion Weapons] ${msg}`);
      }, onlyMissingCompanions);
      log(`[Companion Weapons] Done — ${result.found} found, ${result.insertedOrUpdated} updated.`);
      summary.hiddenCompanionWeapons = {
        outcome: 'ok',
        detail: `Fetched ${result.found} weapons from wiki, updated ${result.insertedOrUpdated} rows.`,
        found: result.found,
        insertedOrUpdated: result.insertedOrUpdated,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.hiddenCompanionWeapons = { outcome: 'failed', detail: 'Sync failed.', error: msg };
      err('[Companion Weapons] Sync failed —', e);
    }
  } else {
    log('[Companion Weapons] Skipped — beast claw wiki data is up to date.');
    summary.hiddenCompanionWeapons = {
      outcome: 'skipped',
      detail: 'Beast claw wiki stats are already synced.',
    };
  }

  const onlyMissingOverframe = usesOnlyMissingMode('overframe', options);
  const missingOverframeItems = countItemsMissingOverframeData();
  if (shouldRunStep('overframe', false, options)) {
    await prepareOverframeFetch();
    log('[Overframe] Indexing and scraping build data...');
    try {
      const indexResult = await scrapeIndex(
        undefined,
        (msg) => log(`[Overframe] ${msg}`),
        onlyMissingOverframe,
      );

      summary.overframe.totalIndexed = indexResult.totalFound;
      summary.overframe.matchedNeedingWork = indexResult.entries.length;

      if (indexResult.entries.length > 0) {
        log(`[Overframe] Scraping ${indexResult.entries.length} detail pages...`);
        const scrapedItems = await scrapeItems(indexResult.entries, 1500, (p) => {
          const step = cli ? 25 : 50;
          if (p.current === 1 || p.current % step === 0 || p.current === p.total) {
            log(`[Overframe] ${p.current}/${p.total} — ${p.currentItem}`);
          }
        });
        summary.overframe.pagesScraped = scrapedItems.length;

        let mergeLogN = 0;
        const mergeResult = mergeScrapedData(scrapedItems, (msg) => {
          mergeLogN += 1;
          if (mergeLogN <= 3 || mergeLogN % 40 === 0) log(`[Overframe] Merge: ${msg}`);
        });
        log(
          `[Overframe] Done — merged ${mergeResult.warframesUpdated} warframes, ${mergeResult.weaponsUpdated} weapons, ${mergeResult.companionsUpdated} companions.`,
        );
        summary.overframe.outcome = 'ok';
        summary.overframe.detail = `Scraped ${scrapedItems.length} pages, merged results into DB.`;
        summary.overframe.merge = mergeResult;
      } else {
        log('[Overframe] Skipped — all matched items already have build data.');
        summary.overframe.outcome = 'skipped';
        summary.overframe.detail = 'All matched items already have build data; no scraping needed.';
        summary.overframe.pagesScraped = 0;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.overframe.outcome = 'failed';
      summary.overframe.detail = 'Overframe scrape failed.';
      summary.overframe.error = msg;
      err('[Overframe] Scrape failed —', e);
    }
  } else {
    log(
      '[Overframe] Skipped — automatic Overframe scrape disabled (force this step in Admin if needed).',
    );
    summary.overframe.outcome = 'skipped';
    summary.overframe.detail =
      missingOverframeItems > 0
        ? `${missingOverframeItems} items still missing artifact slots; use Admin slot editor or force Overframe step.`
        : 'Automatic Overframe scrape disabled; no requests made.';
    summary.overframe.pagesScraped = 0;
  }

  let helminthWikiHtml: string | null = null;
  const shouldRunWiki = shouldRunStep('wiki', dataChanged || !hasArchonShardDataInDb(), options);
  if (shouldRunWiki) {
    log('[Wiki] Scraping warframe wiki for ability stats, shards, riven dispositions...');
    try {
      const wikiResult = await runWikiScrape(
        (p) => {
          if (p.log.length > 0) {
            const last = p.log[p.log.length - 1];
            if (
              last.includes('Merged') ||
              last.includes('complete') ||
              last.includes('Merging') ||
              last.includes('Found') ||
              last.includes('Scraped') ||
              last.includes('Fetching') ||
              last.toLowerCase().includes('failed')
            ) {
              log(`[Wiki] ${last}`);
            }
          }
        },
        usesOnlyMissingMode('wiki', options),
      );
      helminthWikiHtml = wikiResult.helminthWikiHtml;
      const wikiMerge = wikiResult.merge;
      log(
        `[Wiki] Done — ${wikiMerge.abilitiesUpdated} abilities, ${wikiMerge.passivesUpdated} passives, ` +
          `${wikiMerge.augmentsUpdated} augments, ${wikiMerge.shardTypes} shard types, ` +
          `${wikiMerge.shardBuffs} shard buffs, ${wikiMerge.weaponsProjectileSpeedsUpdated} projectile speeds.`,
      );
      summary.wiki = {
        outcome: 'ok',
        detail: `Updated ${wikiMerge.abilitiesUpdated} abilities, ${wikiMerge.passivesUpdated} passives, ${wikiMerge.augmentsUpdated} augments.`,
        merge: wikiMerge,
      };

      const missingFireBehaviors = countWeaponsMissingFireBehaviors();
      if (missingFireBehaviors === 0) {
        log('[Wiki] Fire behaviors — skipped (all weapons already have data).');
      } else {
        log(
          `[Wiki] Syncing weapon fire behaviors from wiki infoboxes (${missingFireBehaviors} missing)...`,
        );
        try {
          const fireResult = await syncWeaponFireBehaviorsFromWiki(
            (msg) => log(`[Wiki] ${msg}`),
            true,
          );
          log(`[Wiki] Fire behaviors — ${fireResult.updated} weapon(s) updated.`);
        } catch (fireErr) {
          err('[Wiki] Weapon fire behavior sync failed —', fireErr);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.wiki = { outcome: 'failed', detail: 'Wiki scrape failed.', error: msg };
      err('[Wiki] Scrape failed —', e);
    }
  } else {
    log('[Wiki] Skipped — export hashes unchanged and archon shard data already present.');
    summary.wiki = {
      outcome: 'skipped',
      detail: 'Export hashes unchanged; wiki enrichment not needed.',
    };
  }

  if (shouldRunStep('helminthWiki', dataChanged || !hasArchonShardDataInDb(), options)) {
    log('[Helminth] Syncing helminth-infusable ability flags from wiki...');
    try {
      const db = getCatalogDb();
      const helminthResult = await syncHelminthFlagsFromWiki(db, {
        html: helminthWikiHtml,
        onProgress: (msg) => log(`[Helminth] ${msg}`),
      });
      if (!helminthResult.fetchOk) {
        summary.helminthWiki = {
          outcome: 'failed',
          detail: 'Wiki fetch failed.',
          wikiNamesFound: helminthResult.wikiNamesFound,
          abilitiesFlagged: helminthResult.abilitiesFlagged,
          fetchOk: false,
          error: helminthResult.error ?? 'Unknown fetch error.',
        };
        err(
          `[Helminth] Fetch failed — ${helminthResult.error ?? 'unknown'} (names parsed: ${helminthResult.wikiNamesFound})`,
        );
      } else if (helminthResult.wikiNamesFound === 0) {
        summary.helminthWiki = {
          outcome: 'partial',
          detail: 'No ability names parsed from wiki page (HTML layout may have changed).',
          wikiNamesFound: 0,
          abilitiesFlagged: 0,
          fetchOk: true,
        };
        log('[Helminth] No ability names parsed from wiki page.');
      } else {
        log(
          `[Helminth] Done — ${helminthResult.wikiNamesFound} wiki tokens, ${helminthResult.abilitiesFlagged} abilities flagged.`,
        );
        summary.helminthWiki = {
          outcome: helminthResult.abilitiesFlagged > 0 ? 'ok' : 'partial',
          detail:
            helminthResult.abilitiesFlagged > 0
              ? `Matched ${helminthResult.abilitiesFlagged} abilities from ${helminthResult.wikiNamesFound} wiki tokens.`
              : `Found ${helminthResult.wikiNamesFound} wiki tokens but none matched DB ability names.`,
          wikiNamesFound: helminthResult.wikiNamesFound,
          abilitiesFlagged: helminthResult.abilitiesFlagged,
          fetchOk: true,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.helminthWiki = {
        outcome: 'failed',
        detail: 'Helminth sync failed.',
        error: msg,
        fetchOk: false,
      };
      err('[Helminth] Sync failed —', e);
    }
  } else {
    log('[Helminth] Skipped — export hashes unchanged since last run.');
    summary.helminthWiki = {
      outcome: 'skipped',
      detail: 'Export hashes unchanged; skipped helminth sync.',
    };
  }

  const shouldSyncIncarnon = shouldRunStep(
    'incarnonWiki',
    forceImport || !hasIncarnonDataInDb() || weaponsExportChanged,
    options,
  );

  if (!shouldSyncIncarnon) {
    log('[Incarnon] Skipped — incarnon data already loaded and ExportWeapons unchanged.');
    summary.incarnonWiki = {
      outcome: 'skipped',
      detail: 'Incarnon data already present and weapon export hash unchanged since last run.',
    };
  } else {
    log('[Incarnon] Syncing incarnon evolution data from wiki...');
    try {
      const db = getCatalogDb();
      const incarnonResult = await syncIncarnonFromWiki(db, (msg) => log(`[Incarnon] ${msg}`));

      if (!incarnonResult.fetchOk && incarnonResult.pagesScraped === 0) {
        summary.incarnonWiki = {
          outcome: 'failed',
          detail: 'Incarnon wiki sync failed.',
          pagesScraped: incarnonResult.pagesScraped,
          pagesFailed: incarnonResult.pagesFailed,
          weaponsTagged: incarnonResult.weaponsTagged,
          imagesDownloaded: incarnonResult.imagesDownloaded,
          imagesSkipped: incarnonResult.imagesSkipped,
          fetchOk: false,
          error: incarnonResult.errors.join('; ') || 'Unknown error.',
        };
        for (const incarnonError of incarnonResult.errors) {
          err(`[Incarnon] Failed ${incarnonError}`);
        }
        err('[Incarnon] Sync failed — no pages scraped.');
      } else {
        log(
          `[Incarnon] Done — ${incarnonResult.pagesScraped} pages, ${incarnonResult.weaponsTagged} weapons, ` +
            `${incarnonResult.imagesDownloaded} images downloaded, ${incarnonResult.imagesSkipped} cached.`,
        );
        summary.incarnonWiki = {
          outcome: incarnonResult.pagesFailed > 0 ? 'partial' : 'ok',
          detail:
            incarnonResult.pagesFailed > 0
              ? `Tagged ${incarnonResult.weaponsTagged} weapons with ${incarnonResult.pagesFailed} page failures.`
              : `Tagged ${incarnonResult.weaponsTagged} weapons from ${incarnonResult.pagesScraped} wiki pages.`,
          pagesScraped: incarnonResult.pagesScraped,
          pagesFailed: incarnonResult.pagesFailed,
          weaponsTagged: incarnonResult.weaponsTagged,
          imagesDownloaded: incarnonResult.imagesDownloaded,
          imagesSkipped: incarnonResult.imagesSkipped,
          fetchOk: incarnonResult.fetchOk,
          error: incarnonResult.errors.length > 0 ? incarnonResult.errors.join('; ') : undefined,
        };
        for (const incarnonError of incarnonResult.errors) {
          err(`[Incarnon] Failed ${incarnonError}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.incarnonWiki = {
        outcome: 'failed',
        detail: 'Incarnon sync failed.',
        error: msg,
        fetchOk: false,
      };
      err('[Incarnon] Sync failed —', e);
    }
  }

  summary.durationMs = Date.now() - startTime;
  log(`Pipeline complete in ${(summary.durationMs / 1000).toFixed(1)}s.`);

  try {
    const { copyCatalogToCollection } = await import('./copyCatalogToCollection.js');
    const copyResult = copyCatalogToCollection();
    log(
      `Copied catalog into collection DB (${copyResult.worksheets} worksheets, ${copyResult.totalNames} names).`,
    );
  } catch (e) {
    err('Catalog → collection copy failed —', e);
  }

  if (cli) printStartupPipelineSummary(summary);
  return summary;
}

/** True when the Warframe catalog DB is empty or not yet schema'd. */
export function catalogNeedsImport(): boolean {
  try {
    const db = getCatalogDb();
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'warframes' LIMIT 1`)
      .get() as { name: string } | undefined;
    if (!row) return true;
    const count = db.prepare(`SELECT COUNT(*) AS c FROM warframes`).get() as { c: number };
    return count.c === 0;
  } catch {
    return true;
  }
}

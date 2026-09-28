import fs from 'fs';
import path from 'path';

import type Database from 'better-sqlite3';

import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  isAbortError,
} from '../http/fetchWithTimeout.js';
import { collectIncarnonGenesisUnlockers } from '../incarnonGenesisSeed.js';
import { safeImagePathUnderRoot } from '../safeImagePath.js';
import type { IncarnonData, IncarnonEvolutionTier, IncarnonPerkOption } from './incarnonTypes.js';
import { parseGenesisPageWithWeaponValues, parseIntrinsicPageHtml } from './incarnonWikiParse.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';
const INTRINSIC_INCANNON_WEAPONS = [
  'Felarx',
  'Innodem',
  'Laetum',
  'Onos',
  'Phenmor',
  'Praedos',
  'Ruvox',
  'Thalys',
] as const;

export interface IncarnonWikiSyncResult {
  pagesScraped: number;
  pagesFailed: number;
  weaponsTagged: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  fetchOk: boolean;
  errors: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWikiPage(slug: string): Promise<string> {
  const url = `${WIKI_BASE}/w/${slug}`;
  const { response, body } = await fetchBounded(
    url,
    {
      headers: {
        'User-Agent': getWikiUserAgent(),
        Accept: 'text/html',
      },
    },
    FETCH_TIMEOUT_MS.exportDownload,
    FETCH_BYTE_LIMITS.html,
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${slug}`);
  }
  return body.toString('utf-8');
}

function imagePathFromFileName(fileName: string): string {
  const localPath = safeImagePathUnderRoot(['incarnon', fileName]);
  const base = path.basename(localPath);
  return `/incarnon/${base}`;
}

async function ensureIncarnonImage(fileName: string): Promise<{
  imagePath: string;
  downloaded: boolean;
}> {
  const localPath = safeImagePathUnderRoot(['incarnon', fileName]);
  const imagePath = imagePathFromFileName(fileName);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    return { imagePath, downloaded: false };
  }

  const url = `${WIKI_BASE}/images/${encodeURIComponent(fileName).replace(/%2F/g, '/')}`;
  try {
    const { response, body } = await fetchBounded(
      url,
      { headers: { 'User-Agent': getWikiUserAgent() } },
      FETCH_TIMEOUT_MS.exportDownload,
      FETCH_BYTE_LIMITS.image,
      { requireImageMime: true },
    );
    if (!response.ok) {
      const thumbUrl = `${WIKI_BASE}/images/thumb/${encodeURIComponent(fileName)}/256px-${encodeURIComponent(fileName)}`;
      const thumb = await fetchBounded(
        thumbUrl,
        { headers: { 'User-Agent': getWikiUserAgent() } },
        FETCH_TIMEOUT_MS.exportDownload,
        FETCH_BYTE_LIMITS.image,
        { requireImageMime: true },
      );
      if (!thumb.response.ok) {
        throw new Error(`HTTP ${response.status} / ${thumb.response.status} for ${fileName}`);
      }
      fs.writeFileSync(localPath, thumb.body);
    } else {
      fs.writeFileSync(localPath, body);
    }
    return { imagePath, downloaded: true };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Image download timed out for ${fileName}`);
    }
    throw error;
  }
}

type PerkWithFile = IncarnonPerkOption & { imageFile?: string };

async function resolveTierImages(
  tiers: IncarnonEvolutionTier[],
  stats: { downloaded: number; skipped: number },
): Promise<IncarnonEvolutionTier[]> {
  const resolved: IncarnonEvolutionTier[] = [];
  for (const tier of tiers) {
    const options: IncarnonPerkOption[] = [];
    for (const option of tier.options) {
      const withFile = option as PerkWithFile;
      let imagePath = option.imagePath;
      if (withFile.imageFile) {
        const result = await ensureIncarnonImage(withFile.imageFile);
        imagePath = result.imagePath;
        if (result.downloaded) stats.downloaded++;
        else stats.skipped++;
      }
      const { imageFile: _drop, ...rest } = withFile;
      options.push({ ...rest, imagePath });
    }
    resolved.push({ ...tier, options });
  }
  return resolved;
}

function matchWeaponUniqueName(db: Database.Database, weaponName: string): string | null {
  const row = db
    .prepare(`SELECT unique_name FROM weapons WHERE LOWER(name) = LOWER(?) LIMIT 1`)
    .get(weaponName) as { unique_name: string } | undefined;
  return row?.unique_name ?? null;
}

function snapshotImageStats(stats: { downloaded: number; skipped: number }): {
  downloaded: number;
  skipped: number;
} {
  return { downloaded: stats.downloaded, skipped: stats.skipped };
}

function formatImageDelta(
  before: { downloaded: number; skipped: number },
  after: { downloaded: number; skipped: number },
): string {
  const downloaded = after.downloaded - before.downloaded;
  const cached = after.skipped - before.skipped;
  return `${downloaded} images downloaded, ${cached} cached`;
}

export async function syncIncarnonFromWiki(
  db: Database.Database,
  onProgress?: (message: string) => void,
): Promise<IncarnonWikiSyncResult> {
  const result: IncarnonWikiSyncResult = {
    pagesScraped: 0,
    pagesFailed: 0,
    weaponsTagged: 0,
    imagesDownloaded: 0,
    imagesSkipped: 0,
    fetchOk: true,
    errors: [],
  };

  const imageStats = { downloaded: 0, skipped: 0 };
  const updates = new Map<string, IncarnonData>();

  const genesisSeeds = collectIncarnonGenesisUnlockers();
  const intrinsicTotal = INTRINSIC_INCANNON_WEAPONS.length;
  onProgress?.(
    `Starting wiki scrape (${genesisSeeds.length} genesis + ${intrinsicTotal} intrinsic pages)...`,
  );

  for (let index = 0; index < genesisSeeds.length; index++) {
    const seed = genesisSeeds[index];
    const pageNum = index + 1;
    onProgress?.(`Genesis ${pageNum}/${genesisSeeds.length}: fetching ${seed.wikiSlug}...`);
    const imagesBefore = snapshotImageStats(imageStats);
    try {
      await sleep(500);
      const html = await fetchWikiPage(seed.wikiSlug);
      const parsed = parseGenesisPageWithWeaponValues(html);

      for (const weaponName of parsed.compatibleWeaponNames) {
        const uniqueName = matchWeaponUniqueName(db, weaponName);
        if (!uniqueName) {
          result.errors.push(`Genesis ${seed.wikiSlug}: weapon not in DB: ${weaponName}`);
          continue;
        }

        const rawTiers = parsed.weaponEvolutions.get(weaponName) ?? [];
        const evolutions = await resolveTierImages(rawTiers, imageStats);

        updates.set(uniqueName, {
          source: 'genesis',
          genesisUniqueName: seed.genesisUniqueName,
          wikiSlug: seed.wikiSlug,
          evolutions,
        });
      }

      result.pagesScraped++;
      onProgress?.(
        `Genesis ${pageNum}/${genesisSeeds.length}: ${seed.wikiSlug} — ${parsed.compatibleWeaponNames.length} weapons, ${formatImageDelta(imagesBefore, imageStats)}`,
      );
    } catch (error) {
      result.pagesFailed++;
      result.fetchOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Genesis ${seed.wikiSlug}: ${msg}`);
      onProgress?.(`Genesis ${pageNum}/${genesisSeeds.length}: ${seed.wikiSlug} — failed (${msg})`);
    }
  }

  for (let index = 0; index < INTRINSIC_INCANNON_WEAPONS.length; index++) {
    const weaponName = INTRINSIC_INCANNON_WEAPONS[index];
    const pageNum = index + 1;
    onProgress?.(`Intrinsic ${pageNum}/${intrinsicTotal}: fetching ${weaponName}...`);
    const imagesBefore = snapshotImageStats(imageStats);
    try {
      await sleep(500);
      const html = await fetchWikiPage(weaponName);
      const parsed = parseIntrinsicPageHtml(html, weaponName);
      const uniqueName = matchWeaponUniqueName(db, weaponName);
      if (!uniqueName) {
        result.errors.push(`Intrinsic ${weaponName}: weapon not in DB`);
        continue;
      }

      const evolutions = await resolveTierImages(parsed.tiers, imageStats);
      updates.set(uniqueName, {
        source: 'intrinsic',
        wikiSlug: weaponName,
        overview: parsed.overview,
        evolutions,
      });
      result.pagesScraped++;
      onProgress?.(
        `Intrinsic ${pageNum}/${intrinsicTotal}: ${weaponName} — ${parsed.tiers.length} evolutions, ${formatImageDelta(imagesBefore, imageStats)}`,
      );
    } catch (error) {
      result.pagesFailed++;
      result.fetchOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Intrinsic ${weaponName}: ${msg}`);
      onProgress?.(`Intrinsic ${pageNum}/${intrinsicTotal}: ${weaponName} — failed (${msg})`);
    }
  }

  onProgress?.(`Committing ${updates.size} weapons to database...`);
  const clearStmt = db.prepare('UPDATE weapons SET has_incarnon = 0, incarnon_data = NULL');
  const updateStmt = db.prepare(
    'UPDATE weapons SET has_incarnon = 1, incarnon_data = ? WHERE unique_name = ?',
  );
  let weaponsTagged = 0;
  const tx = db.transaction(() => {
    clearStmt.run();
    for (const [uniqueName, data] of updates) {
      updateStmt.run(JSON.stringify(data), uniqueName);
      weaponsTagged++;
    }
  });
  tx();
  result.weaponsTagged = weaponsTagged;

  result.imagesDownloaded = imageStats.downloaded;
  result.imagesSkipped = imageStats.skipped;

  return result;
}

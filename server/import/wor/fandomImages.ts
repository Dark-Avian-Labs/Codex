import { FACTION_DISPLAY_NAMES, FACTIONS } from '@codex/game-wor';
import type { FactionKey, HeroClassKey } from '@codex/game-wor';

import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../http/fetchWithTimeout.js';
import { getWikiUserAgent } from '../../scraping/wikiUserAgent.js';
import type { CatalogBundle } from './catalogQueries.js';
import type { FastidiousImageRef } from './fastidiousCatalog.js';
import { sleep } from './fastidiousClient.js';
import { buildFastidiousStorageUrl, downloadImageToWorDir, worImageWebPath } from './images.js';
import { wikiPageTitleFromName } from './normalize.js';
import { WOR_FANDOM_API_URL } from './paths.js';

const WIKI_CLASS_FILES: Record<HeroClassKey, string> = {
  fighter: 'Fighter.png',
  mage: 'Mage.png',
  marksman: 'Marksman.png',
  defender: 'Defender.png',
  healer: 'Healer.png',
  tactician: 'Tactician.png',
};

const WIKI_FACTION_FILES: Record<Exclude<FactionKey, 'unaffiliated'>, string> = {
  watchguard: 'Watchguard.png',
  north_throne: 'North_Throne.png',
  nightmare_council: 'Nightmare_Council.png',
  cursed_cult: 'Cursed_Cult.png',
  infernal_blast: 'Infernal_Blast.png',
  star_piercers: 'Star_Piercers.png',
  esoteria_order: 'Esoteria_Order.png',
  chaos_dominion: 'Chaos_Dominion.png',
  supreme_arbiters: 'Supreme_Arbiters.png',
  unnamable: 'Unnamable.png',
};

export type WorImageDownloadSummary = {
  portraitsDownloaded: number;
  portraitsSkipped: number;
  portraitsFailed: number;
  iconsDownloaded: number;
  iconsSkipped: number;
  iconsFailed: number;
  missingPortraits: string[];
  failedPortraitDetails: { slug: string; kind: 'hero' | 'artifact' | 'demon'; reason: string }[];
};

type WikiHeaders = Record<string, string>;

function wikiConfigured(): boolean {
  return Boolean(process.env.WIKI_USER_AGENT?.trim());
}

function wikiHeaders(): WikiHeaders | null {
  if (!wikiConfigured()) return null;
  return {
    Accept: 'application/json',
    'User-Agent': getWikiUserAgent(),
  };
}

async function fetchWikiJson<T>(params: Record<string, string>): Promise<T | null> {
  const headers = wikiHeaders();
  if (!headers) return null;
  const url = new URL(WOR_FANDOM_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetchWithTimeout(url, { headers }, FETCH_TIMEOUT_MS.wikiFetch);
  if (!response.ok) {
    throw new Error(`Wiki API HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function resolveWikiFileUrl(fileTitle: string): Promise<string | null> {
  const data = await fetchWikiJson<{
    query?: { pages?: Record<string, { imageinfo?: { url: string }[] }> };
  }>({
    action: 'query',
    titles: `File:${fileTitle}`,
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
  });
  if (!data) return null;
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  const url = page?.imageinfo?.[0]?.url;
  return url ?? null;
}

async function listWikiPageImages(pageTitle: string): Promise<string[]> {
  const data = await fetchWikiJson<{ parse?: { images?: string[] } }>({
    action: 'parse',
    page: pageTitle,
    prop: 'images',
    format: 'json',
  });
  return data?.parse?.images ?? [];
}

async function resolvePortraitFileName(entityName: string): Promise<string | null> {
  if (!wikiConfigured()) return null;
  const pageTitle = wikiPageTitleFromName(entityName);
  const images = await listWikiPageImages(pageTitle);
  const normalizedName = entityName.replace(/ /g, '_');
  const candidates = [
    `${normalizedName}_portrait.png`,
    `${normalizedName}.png`,
    `${entityName}.png`,
  ];
  for (const candidate of candidates) {
    if (images.includes(candidate)) return candidate;
  }
  const loose = images.find(
    (image) =>
      image.toLowerCase().endsWith('.png') &&
      image.toLowerCase().includes(normalizedName.toLowerCase().replace(/'/g, '')),
  );
  return loose ?? null;
}

async function downloadWikiFile(
  fileTitle: string,
  relativePath: string,
  forceDownload: boolean,
  summary: WorImageDownloadSummary,
): Promise<string | null> {
  if (!wikiConfigured()) return null;
  const fileUrl = await resolveWikiFileUrl(fileTitle);
  if (!fileUrl) {
    return null;
  }
  const headers = wikiHeaders();
  const result = await downloadImageToWorDir({
    url: fileUrl,
    relativePath,
    forceDownload,
    headers: headers ?? undefined,
  });
  if (result.status === 'downloaded') summary.iconsDownloaded += 1;
  else if (result.status === 'skipped') summary.iconsSkipped += 1;
  else summary.iconsFailed += 1;
  return result.status === 'failed' ? null : worImageWebPath(relativePath);
}

async function downloadPortraitForEntity(options: {
  kind: 'hero' | 'artifact' | 'demon';
  slug: string;
  name: string;
  fastidiousFile: string | null | undefined;
  imageRefs: FastidiousImageRef;
  forceDownload: boolean;
  summary: WorImageDownloadSummary;
}): Promise<string | null> {
  const basePath = `${options.kind}s/${options.slug}`;
  const portraitFile = await resolvePortraitFileName(options.name);
  if (portraitFile) {
    const wikiPath = `${basePath}${pathExtFromFile(portraitFile)}`;
    const webPath = await downloadWikiFile(
      portraitFile,
      wikiPath,
      options.forceDownload,
      options.summary,
    );
    if (webPath) return webPath;
    options.summary.failedPortraitDetails.push({
      slug: options.slug,
      kind: options.kind,
      reason: `wiki file unresolved: ${portraitFile}`,
    });
  }

  if (options.fastidiousFile) {
    const url = buildFastidiousStorageUrl(
      options.imageRefs.storageUrl,
      options.imageRefs.storageVersion,
      options.fastidiousFile,
    );
    const relativePath = `${basePath}.webp`;
    const result = await downloadImageToWorDir({
      url,
      relativePath,
      forceDownload: options.forceDownload,
    });
    if (result.status === 'downloaded') options.summary.portraitsDownloaded += 1;
    else if (result.status === 'skipped') options.summary.portraitsSkipped += 1;
    else {
      options.summary.portraitsFailed += 1;
      options.summary.failedPortraitDetails.push({
        slug: options.slug,
        kind: options.kind,
        reason: result.error ?? 'fastidious download failed',
      });
      return null;
    }
    return worImageWebPath(relativePath);
  }

  options.summary.portraitsFailed += 1;
  options.summary.failedPortraitDetails.push({
    slug: options.slug,
    kind: options.kind,
    reason: 'no wiki or fastidious image source',
  });
  return null;
}

function pathExtFromFile(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '.png' : fileName.slice(dotIndex);
}

export async function downloadClassAndFactionIcons(options: {
  classIcons: Partial<Record<HeroClassKey, string>>;
  factionIcons: Partial<Record<FactionKey, string>>;
  forceDownload?: boolean;
  onLog?: (message: string) => void;
}): Promise<WorImageDownloadSummary> {
  const summary: WorImageDownloadSummary = {
    portraitsDownloaded: 0,
    portraitsSkipped: 0,
    portraitsFailed: 0,
    iconsDownloaded: 0,
    iconsSkipped: 0,
    iconsFailed: 0,
    missingPortraits: [],
    failedPortraitDetails: [],
  };
  const forceDownload = options.forceDownload ?? false;

  for (const classKey of Object.keys(WIKI_CLASS_FILES) as HeroClassKey[]) {
    const wikiFile = WIKI_CLASS_FILES[classKey];
    const relativePath = `icons/classes/${classKey}.png`;
    const webPath = await downloadWikiFile(wikiFile, relativePath, forceDownload, summary);
    if (!webPath && options.classIcons[classKey]) {
      const result = await downloadImageToWorDir({
        url: options.classIcons[classKey]!,
        relativePath: `icons/classes/${classKey}${options.classIcons[classKey]!.includes('.svg') ? '.svg' : '.png'}`,
        forceDownload,
      });
      if (result.status === 'downloaded') summary.iconsDownloaded += 1;
      else if (result.status === 'skipped') summary.iconsSkipped += 1;
      else summary.iconsFailed += 1;
    }
    await sleep(150);
  }

  for (const factionKey of FACTIONS.filter((faction) => faction !== 'unaffiliated')) {
    const wikiFile = WIKI_FACTION_FILES[factionKey];
    if (!wikiFile) continue;
    const relativePath = `icons/factions/${factionKey}.png`;
    const webPath = await downloadWikiFile(wikiFile, relativePath, forceDownload, summary);
    if (!webPath && options.factionIcons[factionKey]) {
      const result = await downloadImageToWorDir({
        url: options.factionIcons[factionKey]!,
        relativePath: `icons/factions/${factionKey}.svg`,
        forceDownload,
      });
      if (result.status === 'downloaded') summary.iconsDownloaded += 1;
      else if (result.status === 'skipped') summary.iconsSkipped += 1;
      else summary.iconsFailed += 1;
    }
    options.onLog?.(`Faction icon ${FACTION_DISPLAY_NAMES[factionKey]} processed.`);
    await sleep(150);
  }

  options.onLog?.(
    `Class/faction icons: ${summary.iconsDownloaded} downloaded, ${summary.iconsSkipped} skipped, ${summary.iconsFailed} failed.`,
  );
  return summary;
}

export async function downloadCatalogPortraits(options: {
  bundle: CatalogBundle;
  imageRefs: FastidiousImageRef;
  existingPortraitPaths?: {
    heroes: Record<string, string | null>;
    artifacts: Record<string, string | null>;
    demons: Record<string, string | null>;
  };
  onlyMissing?: boolean;
  forceDownload?: boolean;
  onLog?: (message: string) => void;
}): Promise<{ bundle: CatalogBundle; summary: WorImageDownloadSummary }> {
  const summary: WorImageDownloadSummary = {
    portraitsDownloaded: 0,
    portraitsSkipped: 0,
    portraitsFailed: 0,
    iconsDownloaded: 0,
    iconsSkipped: 0,
    iconsFailed: 0,
    missingPortraits: [],
    failedPortraitDetails: [],
  };
  const onlyMissing = options.onlyMissing ?? true;
  const forceDownload = options.forceDownload ?? false;

  const heroes = [];
  for (const hero of options.bundle.heroes) {
    const existing = options.existingPortraitPaths?.heroes[hero.slug] ?? hero.portrait_path;
    if (onlyMissing && !forceDownload && existing) {
      heroes.push({ ...hero, portrait_path: existing });
      summary.portraitsSkipped += 1;
      continue;
    }
    const portrait = await downloadPortraitForEntity({
      kind: 'hero',
      slug: hero.slug,
      name: hero.name,
      fastidiousFile: options.imageRefs.heroes[hero.slug],
      imageRefs: options.imageRefs,
      forceDownload,
      summary,
    });
    heroes.push({ ...hero, portrait_path: portrait });
    if (!portrait) summary.missingPortraits.push(`hero:${hero.slug}`);
    await sleep(200);
  }

  const artifacts = [];
  for (const artifact of options.bundle.artifacts) {
    const existing =
      options.existingPortraitPaths?.artifacts[artifact.slug] ?? artifact.portrait_path;
    if (onlyMissing && !forceDownload && existing) {
      artifacts.push({ ...artifact, portrait_path: existing });
      summary.portraitsSkipped += 1;
      continue;
    }
    const portrait = await downloadPortraitForEntity({
      kind: 'artifact',
      slug: artifact.slug,
      name: artifact.name,
      fastidiousFile: options.imageRefs.artifacts[artifact.slug],
      imageRefs: options.imageRefs,
      forceDownload,
      summary,
    });
    artifacts.push({ ...artifact, portrait_path: portrait });
    if (!portrait) summary.missingPortraits.push(`artifact:${artifact.slug}`);
    await sleep(200);
  }

  const demons = [];
  for (const demon of options.bundle.demons) {
    const existing = options.existingPortraitPaths?.demons[demon.slug] ?? demon.portrait_path;
    if (onlyMissing && !forceDownload && existing) {
      demons.push({ ...demon, portrait_path: existing });
      summary.portraitsSkipped += 1;
      continue;
    }
    const portrait = await downloadPortraitForEntity({
      kind: 'demon',
      slug: demon.slug,
      name: demon.name,
      fastidiousFile: options.imageRefs.demons[demon.slug],
      imageRefs: options.imageRefs,
      forceDownload,
      summary,
    });
    demons.push({ ...demon, portrait_path: portrait });
    if (!portrait) summary.missingPortraits.push(`demon:${demon.slug}`);
    await sleep(200);
  }

  options.onLog?.(
    `Portraits: ${summary.portraitsDownloaded} downloaded, ${summary.portraitsSkipped} skipped, ${summary.portraitsFailed} failed, ${summary.missingPortraits.length} missing.`,
  );

  return {
    bundle: { heroes, artifacts, demons },
    summary,
  };
}

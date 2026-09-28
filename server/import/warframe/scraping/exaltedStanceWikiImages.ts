import fs from 'fs';
import path from 'path';

import * as cheerio from 'cheerio';

import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  fetchWithTimeout,
  isAbortError,
} from '../http/fetchWithTimeout.js';
import { safeImagePathUnderRoot, sanitizeUniqueNameSegments } from '../safeImagePath.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';

const ARMORY_STANCE_WIKI_ROOT_SEGMENTS = ['ArmoryWiki', 'StanceMod'] as const;

function wikiFetchHeaders(): Record<string, string> {
  return {
    Accept: 'text/html,application/json;q=0.9,image/*;q=0.8,*/*;q=0.7',
    'User-Agent': getWikiUserAgent(),
  };
}

export function wikiModCardFileNameFromStanceName(stanceModName: string): string {
  const words = stanceModName.trim().split(/\s+/).filter(Boolean);
  const pascal = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return `${pascal}Modx256.png`;
}

function toWikiArticleUrl(title: string): string {
  const underscored = title.trim().replace(/\s+/g, '_');
  return `${WIKI_BASE}/w/${encodeURIComponent(underscored)}`;
}

async function queryWikiFileDownloadUrl(fileName: string): Promise<string | null> {
  const api = new URL(`${WIKI_BASE}/api.php`);
  api.searchParams.set('action', 'query');
  api.searchParams.set('titles', `File:${fileName}`);
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url');
  api.searchParams.set('format', 'json');

  let response: Response;
  try {
    response = await fetchWithTimeout(
      api.toString(),
      { headers: wikiFetchHeaders() },
      FETCH_TIMEOUT_MS.htmlPage,
    );
  } catch (error: unknown) {
    if (isAbortError(error)) return null;
    throw error;
  }
  if (!response.ok) return null;

  const data = (await response.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string }> }> };
  };
  const pages = data.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const url = page.imageinfo?.[0]?.url;
    if (typeof url === 'string' && url.length > 0) {
      return url.split('?')[0];
    }
  }
  return null;
}

async function resolveFullWikiImageUrl(imageSrc: string): Promise<string | null> {
  const absolute = new URL(imageSrc, WIKI_BASE).href;
  const pathname = new URL(absolute).pathname;

  if (pathname.includes('/images/thumb/')) {
    const rest = pathname.slice(pathname.indexOf('/images/thumb/') + '/images/thumb/'.length);
    const segments = rest.split('/').filter(Boolean);

    if (segments.length >= 2 && /\.(png|jpe?g|webp)$/i.test(segments[0] ?? '')) {
      const baseFile = segments[0];
      return `${WIKI_BASE}/images/${baseFile}`;
    }

    const last = segments[segments.length - 1] ?? '';
    const pxMatch = /^(\d+)px-(.+)$/i.exec(last);
    const fileFromPx = pxMatch?.[2];
    if (fileFromPx) {
      const fromApi = await queryWikiFileDownloadUrl(fileFromPx);
      if (fromApi) return fromApi;
      return `${WIKI_BASE}/images/${fileFromPx}`;
    }

    if (segments.length >= 2) {
      const candidate = segments[segments.length - 2];
      if (/\.(png|jpe?g|webp)$/i.test(candidate)) {
        const fromApi = await queryWikiFileDownloadUrl(candidate);
        if (fromApi) return fromApi;
        return `${WIKI_BASE}/images/${candidate}`;
      }
    }
    return null;
  }

  if (pathname.startsWith('/images/') && !pathname.includes('/thumb/')) {
    return `${WIKI_BASE}${pathname}`;
  }

  return null;
}

function pickInfoboxImageSrc(html: string): string | null {
  const $ = cheerio.load(html);
  const selectors = [
    'aside.portable-infobox img',
    'table.infobox img',
    '.infobox img',
    '.mw-parser-output .infobox img',
  ];
  for (const sel of selectors) {
    const img = $(sel).first();
    const src = img.attr('src') ?? img.attr('data-src');
    if (src && /\/images\//i.test(src)) {
      return src;
    }
  }
  return null;
}

async function fetchWikiHtml(pageTitle: string): Promise<string | null> {
  const url = toWikiArticleUrl(pageTitle);
  try {
    const { response, body } = await fetchBounded(
      url,
      { headers: wikiFetchHeaders() },
      FETCH_TIMEOUT_MS.htmlPage,
      FETCH_BYTE_LIMITS.html,
    );
    if (!response.ok) return null;
    return body.toString('utf-8');
  } catch (error: unknown) {
    if (isAbortError(error)) return null;
    throw error;
  }
}

function diskPathForExaltedStanceWikiImage(
  uniqueName: string,
  ext: string,
): { diskPath: string; dbImagePath: string } {
  const segments = sanitizeUniqueNameSegments(uniqueName);
  const fileBase = `${segments[segments.length - 1]}${ext}`;
  const dirSegments = segments.slice(0, -1);
  const diskPath = safeImagePathUnderRoot([
    ...ARMORY_STANCE_WIKI_ROOT_SEGMENTS,
    ...dirSegments,
    fileBase,
  ]);
  const dbSuffix = [...dirSegments, fileBase].join('/');
  const dbImagePath = `/ArmoryWiki/StanceMod/${dbSuffix}`;
  return { diskPath, dbImagePath };
}

async function downloadWikiImageToDisk(
  fullUrl: string,
  uniqueName: string,
): Promise<string | null> {
  let response: Response;
  let buffer: Buffer;
  try {
    const result = await fetchBounded(
      fullUrl,
      { headers: wikiFetchHeaders() },
      FETCH_TIMEOUT_MS.binaryImage,
      FETCH_BYTE_LIMITS.image,
      { requireImageMime: true },
    );
    response = result.response;
    buffer = result.body;
  } catch (error: unknown) {
    if (isAbortError(error)) return null;
    throw error;
  }
  if (!response.ok) return null;

  const urlPath = new URL(fullUrl).pathname;
  const extMatch = urlPath.match(/\.(png|jpe?g|webp)$/i);
  const ext = extMatch ? `.${extMatch[1]!.toLowerCase()}` : '.png';

  const { diskPath, dbImagePath } = diskPathForExaltedStanceWikiImage(uniqueName, ext);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  fs.writeFileSync(diskPath, buffer);
  return dbImagePath;
}

async function tryDownloadByWikiFileName(
  fileName: string,
  uniqueName: string,
  label: string,
  onProgress?: (msg: string) => void,
): Promise<string | null> {
  const directUrl = `${WIKI_BASE}/images/${fileName}`;
  let saved = await downloadWikiImageToDisk(directUrl, uniqueName);
  if (saved) {
    onProgress?.(`[exaltedStanceWikiImages] ${label}: ${fileName} (direct)`);
    return saved;
  }

  const fromApi = await queryWikiFileDownloadUrl(fileName);
  if (fromApi) {
    saved = await downloadWikiImageToDisk(fromApi, uniqueName);
    if (saved) {
      onProgress?.(`[exaltedStanceWikiImages] ${label}: ${fileName} (via api)`);
      return saved;
    }
  }

  return null;
}

export async function fetchWikiImageForExaltedStanceMod(
  wikiPageTitle: string,
  uniqueName: string,
  stanceModName?: string,
  wikiImageFileOverride?: string | null,
  onProgress?: (msg: string) => void,
): Promise<string | null> {
  if (wikiImageFileOverride?.trim()) {
    const s = await tryDownloadByWikiFileName(
      wikiImageFileOverride.trim(),
      uniqueName,
      'override',
      onProgress,
    );
    if (s) return s;
  }

  if (stanceModName?.trim()) {
    const conventional = wikiModCardFileNameFromStanceName(stanceModName);
    const s = await tryDownloadByWikiFileName(conventional, uniqueName, 'convention', onProgress);
    if (s) return s;
  }

  const html = await fetchWikiHtml(wikiPageTitle);
  if (!html) {
    onProgress?.(`[exaltedStanceWikiImages] could not load wiki page "${wikiPageTitle}"`);
    return null;
  }

  const rawSrc = pickInfoboxImageSrc(html);
  if (!rawSrc) {
    onProgress?.(
      `[exaltedStanceWikiImages] no image: convention/override failed and no infobox img on "${wikiPageTitle}"`,
    );
    return null;
  }

  const fullUrl = await resolveFullWikiImageUrl(rawSrc);
  if (!fullUrl) {
    onProgress?.(`[exaltedStanceWikiImages] could not resolve full image URL from "${rawSrc}"`);
    return null;
  }

  const saved = await downloadWikiImageToDisk(fullUrl, uniqueName);
  if (saved) {
    onProgress?.(`[exaltedStanceWikiImages] infobox: ${wikiPageTitle}`);
  }
  return saved;
}

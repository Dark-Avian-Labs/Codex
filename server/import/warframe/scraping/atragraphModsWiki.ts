import fs from 'fs';
import path from 'path';

import { log } from '@codex/core';
import type Database from 'better-sqlite3';
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

import { getCatalogDb } from '../db/connection.js';
import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  fetchWithTimeout,
  isAbortError,
} from '../http/fetchWithTimeout.js';
import { safeImagePathUnderRoot, sanitizePathSegment } from '../safeImagePath.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';
const ATRAGRAPH_WIKI_PAGE_TITLE = 'Atragraph_Mods';

export const ARMORY_ATRAGRAPH_WIKI_PREFIX = '/ArmoryWiki/Atragraph/';
const ARMORY_ATRAGRAPH_DISK_SEGMENTS = ['ArmoryWiki', 'Atragraph'] as const;

export interface AtragraphModSet {
  setKey: string;
  displayName: string;
  overlayFileName: string;
  cardFileName: string;
  compatibleModNames: string[];
}

interface StoredAtragraphPaths {
  atragraph_card_path: string;
  foil_overlay_path: string;
}

function wikiFetchHeaders(): Record<string, string> {
  return {
    Accept: 'text/html,application/json;q=0.9,image/*;q=0.8,*/*;q=0.7',
    'User-Agent': getWikiUserAgent(),
  };
}

function toWikiArticleUrl(title: string): string {
  const underscored = title.trim().replace(/\s+/g, '_');
  return `${WIKI_BASE}/w/${encodeURIComponent(underscored)}`;
}

export function atragraphSetKeyFromModName(modName: string): string {
  return modName
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/'/g, '');
}

function normalizeWikiFileName(href: string): string | null {
  const match = /\/w\/File:([^#?]+)/i.exec(href);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].replace(/_/g, ' ')).replace(/ /g, '_');
  } catch {
    return match[1];
  }
}

function extractWikiFileHref(cell: cheerio.Cheerio<Element>): string | null {
  const img = cell.find('img').first();
  const imgSrc = img.attr('src') ?? img.attr('data-src');
  if (imgSrc && /\/w\/File:/i.test(imgSrc)) return imgSrc;
  const anchor = cell.find('a[href*="/w/File:"]').first();
  const href = anchor.attr('href');
  return href && /\/w\/File:/i.test(href) ? href : null;
}

function headingMatches($heading: cheerio.Cheerio<Element>, text: string): boolean {
  return $heading.text().replace(/\s+/g, ' ').trim().toLowerCase() === text.toLowerCase();
}

function findHeadingByText($: cheerio.CheerioAPI, text: string): cheerio.Cheerio<Element> {
  let match = $('h2, h3')
    .filter((_, el) => headingMatches($(el), text))
    .first();
  if (match.length > 0) return match;
  const headlineMatch = $('span.mw-headline')
    .filter((_, el) => headingMatches($(el), text))
    .first()
    .closest('h2, h3');
  return headlineMatch as cheerio.Cheerio<Element>;
}

function sectionStartNodes(heading: cheerio.Cheerio<Element>): cheerio.Cheerio<Element>[] {
  const nodes: cheerio.Cheerio<Element>[] = [heading];
  const parent = heading.parent();
  if (parent.length > 0 && (parent.is('.mw-heading') || parent.is('div'))) {
    nodes.push(parent);
  }
  return nodes;
}

function isNextSectionBoundary(node: cheerio.Cheerio<Element>): boolean {
  return node.is('h2, h3') || node.is('.mw-heading');
}

function forEachSiblingAfterHeading(
  heading: cheerio.Cheerio<Element>,
  visit: (node: cheerio.Cheerio<Element>) => boolean,
): void {
  for (const start of sectionStartNodes(heading)) {
    let node = start.next();
    while (node.length > 0) {
      if (isNextSectionBoundary(node)) return;
      if (visit(node)) return;
      node = node.next();
    }
  }
}

function nextWikitableAfter(
  _$: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<Element>,
): cheerio.Cheerio<Element> | null {
  for (const start of sectionStartNodes(heading)) {
    let node = start.next();
    while (node.length > 0) {
      if (isNextSectionBoundary(node)) break;
      if (node.is('table.wikitable')) return node;
      const nested = node.find('table.wikitable').first();
      if (nested.length > 0) return nested;
      node = node.next();
    }
  }
  return null;
}

function parseChecklistCompatibleMods($: cheerio.CheerioAPI): Map<string, string[]> {
  const bySetKey = new Map<string, string[]>();
  const heading = findHeadingByText($, 'Atragraph Mods Checklist');
  if (heading.length === 0) return bySetKey;

  forEachSiblingAfterHeading(heading, (node) => {
    const topItems = node.is('ul, ol') ? node.children('li') : node.find('> ul > li, > ol > li');
    topItems.each((_: number, topLi: AnyNode) => {
      const $topLi = $(topLi);
      const headerText = $topLi
        .clone()
        .children('ul, ol')
        .remove()
        .end()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      const atragraphMatch = /^Atragraph\s+(.+)$/i.exec(headerText);
      if (!atragraphMatch?.[1]) return;
      const setKey = atragraphSetKeyFromModName(atragraphMatch[1]);
      const names = new Set<string>();
      $topLi.find('ul li, ol li').each((__, childLi) => {
        const modName = $(childLi).text().replace(/\s+/g, ' ').trim();
        if (modName) names.add(modName);
      });
      if (names.size > 0) {
        bySetKey.set(setKey, [...names]);
      }
    });
    return false;
  });

  return bySetKey;
}

export function parseAtragraphModsWikiHtml(html: string): AtragraphModSet[] {
  const $ = cheerio.load(html);
  const checklistBySetKey = parseChecklistCompatibleMods($);
  const heading = findHeadingByText($, 'List of Atragraph Mods');
  if (heading.length === 0) return [];

  const table = nextWikitableAfter($, heading);
  if (!table || table.length === 0) return [];

  const sets: AtragraphModSet[] = [];
  table.find('tr').each((_: number, row: AnyNode) => {
    const $row = $(row);
    const nameCell = $row.find('th').first();
    const dataCells = $row.find('td');

    let displayName: string | null = null;
    let overlayCell: cheerio.Cheerio<Element> | null = null;
    let cardCell: cheerio.Cheerio<Element> | null = null;

    if (nameCell.length > 0 && dataCells.length >= 2) {
      displayName = nameCell.text().replace(/\s+/g, ' ').trim();
      overlayCell = $(dataCells.get(0)!);
      cardCell = $(dataCells.get(1)!);
    } else if (dataCells.length >= 3) {
      displayName = $(dataCells.get(0)!).text().replace(/\s+/g, ' ').trim();
      overlayCell = $(dataCells.get(1)!);
      cardCell = $(dataCells.get(2)!);
    } else {
      return;
    }

    if (!displayName || /^mod name$/i.test(displayName)) return;

    const overlayHref = extractWikiFileHref(overlayCell);
    const cardHref = extractWikiFileHref(cardCell);
    const overlayFileName = overlayHref ? normalizeWikiFileName(overlayHref) : null;
    const cardFileName = cardHref ? normalizeWikiFileName(cardHref) : null;
    if (!overlayFileName || !cardFileName) return;

    const setKey = atragraphSetKeyFromModName(displayName);
    const checklistNames = checklistBySetKey.get(setKey) ?? [];
    const compatibleModNames = [...new Set([displayName, ...checklistNames])];

    sets.push({
      setKey,
      displayName,
      overlayFileName,
      cardFileName,
      compatibleModNames,
    });
  });

  return sets;
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

async function resolveWikiImageDownloadUrl(fileName: string): Promise<string | null> {
  const directUrl = `${WIKI_BASE}/images/${fileName}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      directUrl,
      { method: 'HEAD', headers: wikiFetchHeaders() },
      FETCH_TIMEOUT_MS.binaryImage,
    );
  } catch (error: unknown) {
    if (isAbortError(error)) return null;
    throw error;
  }
  if (response.ok) return directUrl;
  return queryWikiFileDownloadUrl(fileName);
}

function diskPathForAtragraphImage(
  setKey: string,
  kind: 'Overlay' | 'Card',
  ext: string,
): { diskPath: string; dbImagePath: string } {
  const safeSetKey = sanitizePathSegment(setKey.replace(/[<>:"|?*]/g, '_'));
  if (!safeSetKey || safeSetKey === '.' || safeSetKey === '..') {
    throw new Error(`Invalid atragraph set key: ${setKey}`);
  }
  const fileName = `${kind}${ext}`;
  const diskPath = safeImagePathUnderRoot([
    ...ARMORY_ATRAGRAPH_DISK_SEGMENTS,
    safeSetKey,
    fileName,
  ]);
  const dbImagePath = `${ARMORY_ATRAGRAPH_WIKI_PREFIX}${safeSetKey}/${fileName}`;
  return { diskPath, dbImagePath };
}

async function downloadAtragraphImage(
  fileName: string,
  setKey: string,
  kind: 'Overlay' | 'Card',
  onProgress?: (msg: string) => void,
): Promise<string | null> {
  const downloadUrl = await resolveWikiImageDownloadUrl(fileName);
  if (!downloadUrl) {
    onProgress?.(`[atragraphMods] could not resolve wiki file "${fileName}"`);
    return null;
  }

  let response: Response;
  let buffer: Buffer;
  try {
    const result = await fetchBounded(
      downloadUrl,
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
  if (!response.ok) {
    onProgress?.(`[atragraphMods] download failed (${response.status}) for "${fileName}"`);
    return null;
  }

  const urlPath = new URL(downloadUrl).pathname;
  const extMatch = urlPath.match(/\.(png|jpe?g|webp)$/i);
  const ext = extMatch ? `.${extMatch[1]!.toLowerCase()}` : '.png';
  const { diskPath, dbImagePath } = diskPathForAtragraphImage(setKey, kind, ext);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  fs.writeFileSync(diskPath, buffer);
  onProgress?.(`[atragraphMods] saved ${kind.toLowerCase()} for ${setKey}`);
  return dbImagePath;
}

async function fetchAtragraphWikiHtml(onProgress?: (msg: string) => void): Promise<string | null> {
  const url = toWikiArticleUrl(ATRAGRAPH_WIKI_PAGE_TITLE);
  try {
    const { response, body } = await fetchBounded(
      url,
      { headers: wikiFetchHeaders() },
      FETCH_TIMEOUT_MS.htmlPage,
      FETCH_BYTE_LIMITS.html,
    );
    if (!response.ok) {
      onProgress?.(`[atragraphMods] wiki page request failed (${response.status})`);
      return null;
    }
    return body.toString('utf-8');
  } catch (error: unknown) {
    if (isAbortError(error)) return null;
    throw error;
  }
}

export function countModsMissingAtragraphImages(db: Database.Database = getCatalogDb()): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM mods
       WHERE atragraph_card_path IS NULL OR foil_overlay_path IS NULL`,
    )
    .get() as { c: number };
  return row.c ?? 0;
}

export async function syncAtragraphModsFromWiki(
  options: {
    onlyMissing?: boolean;
    onProgress?: (msg: string) => void;
    db?: Database.Database;
  } = {},
): Promise<{
  setsFound: number;
  modsUpdated: number;
  imagesDownloaded: number;
  attempted: number;
}> {
  const db = options.db ?? getCatalogDb();
  const onProgress = options.onProgress;
  const html = await fetchAtragraphWikiHtml(onProgress);
  if (!html) {
    return { setsFound: 0, modsUpdated: 0, imagesDownloaded: 0, attempted: 0 };
  }

  const sets = parseAtragraphModsWikiHtml(html);
  onProgress?.(`[atragraphMods] parsed ${sets.length} atragraph set(s) from wiki`);

  const updateStmt = db.prepare(
    `UPDATE mods
     SET atragraph_card_path = COALESCE(?, atragraph_card_path),
         foil_overlay_path = COALESCE(?, foil_overlay_path)
     WHERE name = ?`,
  );
  const selectExistingStmt = db.prepare(
    `SELECT atragraph_card_path, foil_overlay_path
     FROM mods
     WHERE name = ?
     LIMIT 1`,
  );

  let modsUpdated = 0;
  let imagesDownloaded = 0;
  let attempted = 0;

  for (const set of sets) {
    attempted += 1;
    const overlayPath = await downloadAtragraphImage(
      set.overlayFileName,
      set.setKey,
      'Overlay',
      onProgress,
    );
    const cardPath = await downloadAtragraphImage(set.cardFileName, set.setKey, 'Card', onProgress);
    if (!overlayPath && !cardPath) continue;

    if (overlayPath) imagesDownloaded += 1;
    if (cardPath) imagesDownloaded += 1;

    const unmatchedModNames: string[] = [];

    const applyTx = db.transaction(() => {
      for (const modName of set.compatibleModNames) {
        let cardValue: string | null = cardPath;
        let overlayValue: string | null = overlayPath;

        if (options.onlyMissing) {
          const existing = selectExistingStmt.get(modName) as
            | { atragraph_card_path: string | null; foil_overlay_path: string | null }
            | undefined;
          cardValue = cardPath && !existing?.atragraph_card_path ? cardPath : null;
          overlayValue = overlayPath && !existing?.foil_overlay_path ? overlayPath : null;
          if (!cardValue && !overlayValue) continue;
        }

        const result = updateStmt.run(cardValue, overlayValue, modName);
        if (result.changes > 0) {
          modsUpdated += result.changes;
        } else {
          unmatchedModNames.push(modName);
        }
      }
    });
    applyTx();

    if (unmatchedModNames.length > 0) {
      onProgress?.(
        `[atragraphMods] no catalog mod for ${set.setKey}: ${unmatchedModNames.join(', ')}`,
      );
    }
  }

  return { setsFound: sets.length, modsUpdated, imagesDownloaded, attempted };
}

export function saveModAtragraphPaths(): Map<string, StoredAtragraphPaths> {
  const db = getCatalogDb();
  const pathMap = new Map<string, StoredAtragraphPaths>();
  const rows = db
    .prepare(
      `SELECT unique_name, atragraph_card_path, foil_overlay_path
       FROM mods
       WHERE atragraph_card_path IS NOT NULL OR foil_overlay_path IS NOT NULL`,
    )
    .all() as Array<{
    unique_name: string;
    atragraph_card_path: string | null;
    foil_overlay_path: string | null;
  }>;
  for (const row of rows) {
    if (!row.atragraph_card_path && !row.foil_overlay_path) continue;
    pathMap.set(row.unique_name, {
      atragraph_card_path: row.atragraph_card_path ?? '',
      foil_overlay_path: row.foil_overlay_path ?? '',
    });
  }
  if (pathMap.size > 0) {
    log('info', 'Saved atragraph image paths before reprocessing', { count: pathMap.size });
  }
  return pathMap;
}

export function restoreModAtragraphPaths(pathMap: Map<string, StoredAtragraphPaths>): void {
  if (pathMap.size === 0) return;
  const db = getCatalogDb();
  const stmt = db.prepare(
    `UPDATE mods SET atragraph_card_path = ?, foil_overlay_path = ? WHERE unique_name = ?`,
  );
  const tx = db.transaction(() => {
    for (const [uniqueName, paths] of pathMap) {
      stmt.run(paths.atragraph_card_path || null, paths.foil_overlay_path || null, uniqueName);
    }
  });
  tx();
  log('info', 'Restored atragraph image paths after reprocessing', { count: pathMap.size });
}

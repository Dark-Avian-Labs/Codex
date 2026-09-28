import * as cheerio from 'cheerio';

import { resolveSiriusOrionUniqueNameFromScrapeName } from '../../../../shared/warframeImport/siriusOrionRegistry.js';
import { getCatalogDb } from '../db/connection.js';
import { fetchOverframeHtml } from '../http/fetchOverframe.js';
import { FETCH_TIMEOUT_MS, isAbortError } from '../http/fetchWithTimeout.js';

const BASE_URL = 'https://overframe.gg';

export interface OverframeIndexEntry {
  overframeId: number;
  slug: string;
  name: string;
  category: string;
  dbUniqueName: string | null;
}

const CATEGORY_URLS: Record<string, string> = {
  warframe: '/build/new/warframes/',
  primary: '/build/new/primary-weapons/',
  secondary: '/build/new/secondary-weapons/',
  melee: '/build/new/melee-weapons/',
  archwing: '/build/new/archwing/',
  companion: '/build/new/sentinels/',
};

export function countItemsMissingOverframeData(): number {
  const db = getCatalogDb();
  let total = 0;
  for (const table of ['warframes', 'weapons', 'companions'] as const) {
    const row = db
      .prepare(`SELECT COUNT(*) as c FROM ${table} WHERE artifact_slots IS NULL`)
      .get() as { c: number };
    total += row.c;
  }
  return total;
}

async function scrapeCategory(category: string, urlPath: string): Promise<OverframeIndexEntry[]> {
  const url = `${BASE_URL}${urlPath}`;
  let html: string;
  try {
    html = await fetchOverframeHtml(urlPath, FETCH_TIMEOUT_MS.htmlPage);
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(`Failed to fetch ${url}: timed out after ${FETCH_TIMEOUT_MS.htmlPage}ms`);
    }
    throw error;
  }

  const $ = cheerio.load(html);
  const entries: OverframeIndexEntry[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/^\/build\/new\/(\d+)\/([^/]+)\/?$/);
    if (!match) return;

    const overframeId = parseInt(match[1], 10);
    const slug = match[2];
    const name = $(el).text().trim();
    if (name && overframeId) {
      entries.push({ overframeId, slug, name, category, dbUniqueName: null });
    }
  });

  return entries;
}

function matchToDb(entries: OverframeIndexEntry[], onlyMissing = false): OverframeIndexEntry[] {
  const db = getCatalogDb();

  const warframes = db.prepare('SELECT unique_name, name FROM warframes').all() as {
    unique_name: string;
    name: string;
  }[];
  const weapons = db.prepare('SELECT unique_name, name FROM weapons').all() as {
    unique_name: string;
    name: string;
  }[];
  const companions = db.prepare('SELECT unique_name, name FROM companions').all() as {
    unique_name: string;
    name: string;
  }[];

  const nameMap = new Map<string, string>();
  for (const item of [...warframes, ...weapons, ...companions]) {
    nameMap.set(item.name.toLowerCase(), item.unique_name);
  }

  let hasDataSet: Set<string> | null = null;
  if (onlyMissing) {
    hasDataSet = new Set<string>();
    for (const table of ['warframes', 'weapons', 'companions']) {
      const rows = db
        .prepare(`SELECT unique_name FROM ${table} WHERE artifact_slots IS NOT NULL`)
        .all() as { unique_name: string }[];
      for (const row of rows) hasDataSet.add(row.unique_name);
    }
  }

  const matched: OverframeIndexEntry[] = [];
  for (const entry of entries) {
    const aliasUniqueName = resolveSiriusOrionUniqueNameFromScrapeName(entry.name);
    const uniqueName = aliasUniqueName ?? nameMap.get(entry.name.toLowerCase()) ?? null;
    if (uniqueName) {
      if (hasDataSet && hasDataSet.has(uniqueName)) continue;
      matched.push({ ...entry, dbUniqueName: uniqueName });
    }
  }

  return matched;
}

export interface IndexScrapeResult {
  totalFound: number;
  matched: number;
  entries: OverframeIndexEntry[];
  skippedIndexFetch: boolean;
}

export async function scrapeIndex(
  categories?: string[],
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<IndexScrapeResult> {
  if (onlyMissing && countItemsMissingOverframeData() === 0) {
    onProgress?.('All matched items already have Overframe build data; skipping index fetch.');
    return {
      totalFound: 0,
      matched: 0,
      entries: [],
      skippedIndexFetch: true,
    };
  }

  const cats = categories?.length
    ? Object.entries(CATEGORY_URLS).filter(([k]) => categories.includes(k))
    : Object.entries(CATEGORY_URLS);

  const allEntries: OverframeIndexEntry[] = [];

  for (const [category, urlPath] of cats) {
    onProgress?.(`Scraping index: ${category}...`);
    const entries = await scrapeCategory(category, urlPath);
    allEntries.push(...entries);
    onProgress?.(`Found ${entries.length} items in ${category}`);
  }

  onProgress?.(`Total found: ${allEntries.length}. Matching to database...`);
  const matched = matchToDb(allEntries, onlyMissing);
  if (onlyMissing) {
    onProgress?.(
      `${matched.length} items need scraping (${allEntries.length - matched.length} already have data)`,
    );
  } else {
    onProgress?.(`Matched ${matched.length} of ${allEntries.length} to database`);
  }

  return {
    totalFound: allEntries.length,
    matched: matched.length,
    entries: matched,
    skippedIndexFetch: false,
  };
}

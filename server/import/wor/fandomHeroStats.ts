import fs from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import { FETCH_TIMEOUT_MS, fetchWithTimeout } from '../../http/fetchWithTimeout.js';
import { getWikiUserAgent } from '../../scraping/wikiUserAgent.js';
import { sleep } from './fastidiousClient.js';
import { wikiPageTitleFromName } from './normalize.js';
import { parseHeroInfobox, type WikiHeroBaseStats } from './parseHeroInfobox.js';
import { resolveWorImportCacheDir, WOR_FANDOM_API_URL } from './paths.js';

export type FandomHeroStatsSummary = {
  updated: number;
  skipped: number;
  missing: number;
  failed: number;
};

type CatalogHeroNameRow = {
  slug: string;
  name: string;
};

function wikiConfigured(): boolean {
  return Boolean(process.env.WIKI_USER_AGENT?.trim());
}

function wikiHeaders(): Record<string, string> | null {
  if (!wikiConfigured()) return null;
  return {
    Accept: 'application/json',
    'User-Agent': getWikiUserAgent(),
  };
}

async function fetchWikiWikitext(pageTitle: string): Promise<string | null> {
  const headers = wikiHeaders();
  if (!headers) return null;
  const url = new URL(WOR_FANDOM_API_URL);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', pageTitle);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const response = await fetchWithTimeout(url, { headers }, FETCH_TIMEOUT_MS.wikiFetch);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Wiki API HTTP ${response.status} for ${pageTitle}`);
  }
  const payload = (await response.json()) as {
    parse?: { wikitext?: string };
    error?: { code?: string };
  };
  if (payload.error?.code === 'missingtitle') return null;
  const wikitext = payload.parse?.wikitext;
  return typeof wikitext === 'string' && wikitext.length > 0 ? wikitext : null;
}

function cachePathFor(slug: string): string {
  return path.join(resolveWorImportCacheDir(), 'hero-stats', `${slug}.json`);
}

function readCachedStats(slug: string): WikiHeroBaseStats | null {
  const filePath = cachePathFor(slug);
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as WikiHeroBaseStats;
  } catch {
    return null;
  }
}

function writeCachedStats(slug: string, stats: WikiHeroBaseStats): void {
  const filePath = cachePathFor(slug);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
}

function applyStats(db: Database.Database, slug: string, stats: WikiHeroBaseStats): void {
  db.prepare(
    `UPDATE catalog_heroes SET
      base_hp = @hp,
      base_atk = @atk,
      base_def = @def,
      base_mdef = @mdef,
      base_block = @block,
      base_cost = @cost,
      base_atk_interval = @atkInterval,
      base_rr_auto = @rrAuto,
      base_rr_attack = @rrAttack,
      base_rr_attacked = @rrAttacked
     WHERE slug = @slug`,
  ).run({
    slug,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    mdef: stats.mdef,
    block: stats.block,
    cost: stats.cost,
    atkInterval: stats.atkInterval,
    rrAuto: stats.rrAuto,
    rrAttack: stats.rrAttack,
    rrAttacked: stats.rrAttacked,
  });
}

export async function importFandomHeroStats(options: {
  db: Database.Database;
  force?: boolean;
  live?: boolean;
  onLog?: (message: string) => void;
}): Promise<FandomHeroStatsSummary> {
  const summary: FandomHeroStatsSummary = { updated: 0, skipped: 0, missing: 0, failed: 0 };
  const heroes = options.db
    .prepare(
      `SELECT slug, name FROM catalog_heroes WHERE active = 1 ORDER BY display_order ASC, name ASC`,
    )
    .all() as CatalogHeroNameRow[];

  const live = options.live !== false && wikiConfigured();
  if (!live && !options.force) {
    options.onLog?.('WIKI_USER_AGENT not set — applying cached hero stats only.');
  }

  for (const hero of heroes) {
    let stats = options.force ? null : readCachedStats(hero.slug);
    if (!stats && live) {
      try {
        const wikitext = await fetchWikiWikitext(wikiPageTitleFromName(hero.name));
        stats = wikitext ? parseHeroInfobox(wikitext) : null;
        if (stats) writeCachedStats(hero.slug, stats);
        await sleep(200);
      } catch (error) {
        summary.failed += 1;
        options.onLog?.(
          `${hero.name}: wiki fetch failed (${error instanceof Error ? error.message : String(error)})`,
        );
        continue;
      }
    } else if (!stats) {
      stats = readCachedStats(hero.slug);
    }

    if (!stats) {
      summary.missing += 1;
      continue;
    }
    applyStats(options.db, hero.slug, stats);
    summary.updated += 1;
  }

  return summary;
}

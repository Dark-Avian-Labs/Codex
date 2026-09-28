import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { catalogArmoryKeyForArchonBuff } from '../db/catalogKeys.js';
import { getCatalogDb } from '../db/connection.js';
import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS, fetchTextBounded } from '../http/fetchWithTimeout.js';
import {
  fetchHelminthWikiHtml,
  HELMINTH_WIKI_URL,
  resolveHelminthAbilityWikiUrls,
} from './helminthWikiPage.js';

const WIKI_BASE = 'https://wiki.warframe.com';

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; statusText: string; text: () => Promise<string> }> {
  const { response, text } = await fetchTextBounded(url, init, timeoutMs, FETCH_BYTE_LIMITS.html);
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text: async () => text,
  };
}

const SLOT_SECONDARY = 0;
const SLOT_PRIMARY = 1;

const logger = {
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WikiAbilityStats {
  energy_cost: number | null;
  strength: string | null;
  duration: string | null;
  range: string | null;
  misc: string[];
}

export interface WikiAbilityResult {
  uniqueName: string;
  name: string;
  stats: WikiAbilityStats;
}

export interface WikiPassiveResult {
  uniqueName: string;
  name: string;
  passive: string;
}

export interface WikiAugmentMapping {
  augmentName: string;
  abilityName: string;
  abilityUniqueName: string;
  warframeName: string;
}

export interface WikiShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  sort_order: number;
}

export interface WikiShardBuff {
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
  sort_order: number;
}

export interface WikiShardResult {
  types: WikiShardType[];
  buffs: WikiShardBuff[];
}

export interface WikiRivenDisposition {
  weapon_name: string;
  disposition: number;
}

export interface WikiScrapeResult {
  abilities: WikiAbilityResult[];
  passives: WikiPassiveResult[];
  augments: WikiAugmentMapping[];
  shards: WikiShardResult;
  dispositions: WikiRivenDisposition[];
  projectileSpeedByWeapon: Map<string, Array<number | null>>;
}

export interface WikiScrapeProgress {
  phase:
    | 'abilities'
    | 'passives'
    | 'augments'
    | 'shards'
    | 'riven_disposition'
    | 'projectile_speed'
    | 'merging'
    | 'done';
  current: number;
  total: number;
  currentItem: string;
  log: string[];
}

function extractLastSlashDelimitedValue(text: string): string {
  const parts = text
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || text.trim();
}

function cleanStatValue(raw: string): string | null {
  const text = raw.trim();
  if (!text || text === 'N/A') return null;
  return extractLastSlashDelimitedValue(text);
}

function wikiSlug(name: string): string {
  return encodeURIComponent(name.replace(/ /g, '_'));
}

function normalizeText(s: string): string {
  return s
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\r\n/g, '\n')
    .trim();
}

function textPreservingLineBreaks($root: cheerio.Cheerio<Element>): string {
  if ($root.length === 0) return '';
  const $clone = $root.clone();
  $clone.find('br').replaceWith('\n');
  return $clone.text();
}

async function scrapeAbilityPage(
  abilityName: string,
  overrideUrl?: string,
): Promise<WikiAbilityStats | null> {
  const url = overrideUrl ?? `${WIKI_BASE}/w/${wikiSlug(abilityName)}`;

  const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.wikiFetch);
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const abilityBox = $('table.ability-box').first();
  if (abilityBox.length === 0) return null;

  let energy_cost: number | null = null;
  let strength: string | null = null;
  let duration: string | null = null;
  let range: string | null = null;
  const misc: string[] = [];

  abilityBox.find('a[href="/w/Ability_Efficiency"]').each((_, el) => {
    const b = $(el).find('b[style*="font-size"]');
    if (b.length) {
      const val = parseInt(b.text().trim(), 10);
      if (!isNaN(val)) energy_cost = val;
    }
    const siblingB = $(el).prev('b[style*="font-size"]');
    if (siblingB.length) {
      const val = parseInt(siblingB.text().trim(), 10);
      if (!isNaN(val)) energy_cost = val;
    }
  });
  if (energy_cost === null) {
    abilityBox.find('b[style*="font-size:16px"]').each((_, el) => {
      const val = parseInt($(el).text().trim(), 10);
      if (!isNaN(val) && val > 0 && val <= 200) energy_cost = val;
    });
  }

  abilityBox.find('td').each((_, td) => {
    const $td = $(td);

    const paramSpan = $td.find('span.tooltip[data-param-name]').first();
    if (paramSpan.length === 0) return;

    const paramName = paramSpan.attr('data-param-name') || '';
    const valueSpan = $td.find('span[style*="float:right"]').first();
    const rawValue = valueSpan.length ? valueSpan.text().trim() : '';

    if (paramName === 'Ability Strength') {
      strength = cleanStatValue(rawValue);
    } else if (paramName === 'Ability Duration') {
      duration = cleanStatValue(rawValue);
    } else if (paramName === 'Ability Range') {
      range = cleanStatValue(rawValue);
    }
  });

  abilityBox.find('td').each((_, td) => {
    const $td = $(td);
    const boldTitle = $td.find('b[title*="unlisted"]');
    if (boldTitle.length === 0 && !$td.text().trim().startsWith('Misc')) return;

    const miscSpan = $td.find('span[style*="float:right"]').first();
    if (miscSpan.length === 0) return;

    miscSpan.find('br').replaceWith('\n');
    const lines = miscSpan
      .text()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const maxed = extractLastSlashDelimitedValue(line);
      if (maxed) misc.push(maxed);
    }
  });

  return { energy_cost, strength, duration, range, misc };
}

async function resolveAbilityUrls(
  abilities: { name: string; wf_name: string | null }[],
  onProgress?: (msg: string) => void,
  helminthWikiHtml?: string | null,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  const warframeNames = new Set<string>();
  for (const ab of abilities) {
    if (ab.wf_name) warframeNames.add(ab.wf_name);
  }

  for (const rawName of warframeNames) {
    const cleanName = rawName.replace(/^<ARCHWING>\s*/i, '').trim();
    const slug = cleanName.replace(/ /g, '_');
    const url = `${WIKI_BASE}/w/${encodeURIComponent(slug)}/Abilities`;

    try {
      const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.wikiFetch);
      if (!res.ok) {
        onProgress?.(`  Could not fetch ${cleanName}/Abilities (${res.status})`);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      const abilityNames = abilities.filter((a) => a.wf_name === rawName).map((a) => a.name);

      for (const name of abilityNames) {
        const normName = normalizeText(name);
        $('a[href^="/w/"]').each((_, el) => {
          if (resolved.has(name)) return;
          const linkText = normalizeText($(el).text());
          const title = normalizeText($(el).attr('title') || '');
          const href = $(el).attr('href') || '';
          if (href.includes('/Abilities')) return;
          if (linkText === normName || title === normName || title.startsWith(`${normName} (`)) {
            resolved.set(name, `${WIKI_BASE}${href}`);
          }
        });
      }
      await sleep(500);
    } catch (err) {
      onProgress?.(`  Error resolving ${rawName}: ${err}`);
    }
  }

  const helminthAbilities = abilities.filter((a) => !a.wf_name).map((a) => a.name);
  if (helminthAbilities.length > 0) {
    try {
      if (helminthWikiHtml) {
        const helminthUrls = resolveHelminthAbilityWikiUrls(
          helminthWikiHtml,
          helminthAbilities,
          normalizeText,
        );
        for (const [name, url] of helminthUrls) {
          resolved.set(name, url);
        }
      } else {
        const fetched = await fetchHelminthWikiHtml();
        if (fetched.fetchOk && fetched.html) {
          const helminthUrls = resolveHelminthAbilityWikiUrls(
            fetched.html,
            helminthAbilities,
            normalizeText,
          );
          for (const [name, url] of helminthUrls) {
            resolved.set(name, url);
          }
        }
      }
      await sleep(500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress?.(`  Error resolving Helminth abilities: ${message}`);
      console.error('[wikiScraper] resolveAbilityUrls Helminth scrape failed', {
        url: HELMINTH_WIKI_URL,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
    }
  }

  return resolved;
}

async function scrapeAbilityWithFallbacks(
  name: string,
  resolvedUrl?: string,
): Promise<WikiAbilityStats | null> {
  if (resolvedUrl) {
    const result = await scrapeAbilityPage(name, resolvedUrl);
    if (result) return result;
  }

  const result = await scrapeAbilityPage(name);
  if (result) return result;

  const slug = name.replace(/ /g, '_');

  const titleCased = name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('_');
  if (titleCased !== slug) {
    const r = await scrapeAbilityPage(name, `${WIKI_BASE}/w/${wikiSlug(titleCased)}`);
    if (r) return r;
  }

  const r2 = await scrapeAbilityPage(name, `${WIKI_BASE}/w/${wikiSlug(`${slug}_(Ability)`)}`);
  if (r2) return r2;

  return null;
}

export async function scrapeAbilities(
  onProgress?: (msg: string) => void,
  onlyMissing = false,
  helminthWikiHtml?: string | null,
): Promise<WikiAbilityResult[]> {
  const db = getCatalogDb();
  const missingStatsWhereClause = onlyMissing ? 'WHERE a.wiki_stats IS NULL' : '';
  const abilities = db
    .prepare(
      `
    SELECT a.unique_name, a.name, w.name as wf_name
    FROM abilities a
    LEFT JOIN warframes w ON a.warframe_unique_name = w.unique_name
    ${missingStatsWhereClause}
    ORDER BY a.name
  `,
    )
    .all() as { unique_name: string; name: string; wf_name: string | null }[];

  if (onlyMissing) {
    const total = (db.prepare('SELECT COUNT(*) as c FROM abilities').get() as { c: number }).c;
    onProgress?.(
      `${abilities.length} abilities need scraping (${total - abilities.length} already have data)`,
    );
  } else {
    onProgress?.(`Found ${abilities.length} abilities to scrape`);
  }

  if (abilities.length === 0) {
    onProgress?.('All abilities already have wiki data, skipping');
    return [];
  }

  onProgress?.('Resolving ability URLs from warframe pages...');
  const urlMap = await resolveAbilityUrls(abilities, onProgress, helminthWikiHtml);
  onProgress?.(`Resolved ${urlMap.size}/${abilities.length} ability URLs from warframe pages`);

  const results: WikiAbilityResult[] = [];

  for (let i = 0; i < abilities.length; i++) {
    const ab = abilities[i];
    const resolvedUrl = urlMap.get(ab.name);
    onProgress?.(`[${i + 1}/${abilities.length}] ${ab.name}${resolvedUrl ? '' : ' (fallbacks)'}`);

    try {
      const stats = await scrapeAbilityWithFallbacks(ab.name, resolvedUrl);
      if (stats) {
        results.push({ uniqueName: ab.unique_name, name: ab.name, stats });
      } else {
        onProgress?.(`  No data found for ${ab.name}`);
      }
    } catch (err) {
      onProgress?.(`  Failed: ${err instanceof Error ? err.message : err}`);
    }

    if (i < abilities.length - 1) await sleep(800);
  }

  onProgress?.(`Scraped ${results.length} abilities successfully`);
  return results;
}

async function scrapeWarframePage(wfName: string): Promise<string | null> {
  const slug = wfName.replace(/ /g, '_');
  const url = `${WIKI_BASE}/w/${encodeURIComponent(slug)}`;

  const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.wikiFetch);
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const infobox = $('div.infobox').first();
  if (infobox.length > 0) {
    const passiveGroup = infobox
      .find('div.group')
      .filter((_, el) => {
        const header = normalizeText($(el).find('> .header').first().text());
        return header.toLowerCase() === 'passive';
      })
      .first();

    if (passiveGroup.length > 0) {
      const $captionCell = passiveGroup.find('.row .value.caption').first();
      if ($captionCell.length > 0) {
        const caption = normalizeText(textPreservingLineBreaks($captionCell));
        if (caption.length > 0) {
          return caption;
        }
      }

      const $valueCell = passiveGroup.find('.row .value').first();
      if ($valueCell.length > 0) {
        const value = normalizeText(textPreservingLineBreaks($valueCell));
        if (value.length > 0) {
          return value;
        }
      }

      const $fallback = passiveGroup.clone();
      $fallback.find('br').replaceWith('\n');
      const fallbackGroupText = normalizeText($fallback.text().replace(/^Passive\s*/i, ''));
      if (fallbackGroupText.length > 0) {
        return fallbackGroupText;
      }
    }
  }

  const passiveHeader = $('h3:contains("Passive")').first();
  if (passiveHeader.length > 0) {
    const nextP = passiveHeader.nextAll('p').first();
    if (nextP.length > 0) {
      return normalizeText(textPreservingLineBreaks(nextP));
    }
  }

  let passiveHeading = $('h2 span#Passive').first().closest('h2').first();
  if (passiveHeading.length === 0) {
    passiveHeading = $('h3 span#Passive').first().closest('h3').first();
  }
  if (passiveHeading.length > 0) {
    const nextP = passiveHeading.nextAll('p').first();
    if (nextP.length > 0) {
      return normalizeText(textPreservingLineBreaks(nextP));
    }
  }

  if (infobox.length > 0) {
    const text = normalizeText(infobox.text());
    const passiveMatch = text.match(
      /Passive\s*(.+?)(?=Abilities|General Information|\d+(?:st|nd|rd|th)\s+Ability|Notes|Trivia|Gallery|References|$)/s,
    );
    if (passiveMatch) {
      return normalizeText(passiveMatch[1]);
    }
  }

  return null;
}

const WARFRAME_SUITS_BASE_WHERE = `product_category = 'Suits' AND name NOT LIKE '%Prime' AND name NOT LIKE '%Umbra'`;

export async function scrapePassives(
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<WikiPassiveResult[]> {
  const db = getCatalogDb();
  const query = onlyMissing
    ? `SELECT unique_name, name FROM warframes WHERE ${WARFRAME_SUITS_BASE_WHERE} AND passive_description_wiki IS NULL ORDER BY name`
    : `SELECT unique_name, name FROM warframes WHERE ${WARFRAME_SUITS_BASE_WHERE} ORDER BY name`;
  const warframes = db.prepare(query).all() as {
    unique_name: string;
    name: string;
  }[];

  if (onlyMissing) {
    const total = (
      db
        .prepare(`SELECT COUNT(*) as c FROM warframes WHERE ${WARFRAME_SUITS_BASE_WHERE}`)
        .get() as { c: number }
    ).c;
    onProgress?.(
      `${warframes.length} warframes need passive scraping (${total - warframes.length} already have data)`,
    );
  } else {
    onProgress?.(`Found ${warframes.length} warframes to scrape`);
  }

  if (warframes.length === 0) {
    onProgress?.('All warframes already have passive data, skipping');
    return [];
  }

  const results: WikiPassiveResult[] = [];

  for (let i = 0; i < warframes.length; i++) {
    const wf = warframes[i];
    onProgress?.(`[${i + 1}/${warframes.length}] ${wf.name}`);

    try {
      const passive = await scrapeWarframePage(wf.name);
      if (passive) {
        results.push({ uniqueName: wf.unique_name, name: wf.name, passive });
      }
    } catch (err) {
      onProgress?.(`  Failed: ${err instanceof Error ? err.message : err}`);
    }

    if (i < warframes.length - 1) await sleep(800);
  }

  onProgress?.(`Scraped ${results.length} passives successfully`);
  return results;
}

function extractBraceBlock(lua: string, startIdx: number): string {
  let depth = 1;
  let i = startIdx;
  while (i < lua.length && depth > 0) {
    if (lua[i] === '{') depth++;
    else if (lua[i] === '}') depth--;
    i++;
  }
  return lua.substring(startIdx, i - 1);
}

async function fetchAugmentMappings(): Promise<WikiAugmentMapping[]> {
  const url = `${WIKI_BASE}/w/Module:Ability/data?action=raw`;
  const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.wikiFetch);
  if (!res.ok) throw new Error(`Failed to fetch Module:Ability/data: ${res.status}`);

  const lua = await res.text();
  const mappings: WikiAugmentMapping[] = [];

  const entryPattern = /\["([^"]+)"\]\s*=\s*\{/g;
  let match;

  while ((match = entryPattern.exec(lua)) !== null) {
    const abilityName = match[1];
    const blockStart = match.index + match[0].length;
    const body = extractBraceBlock(lua, blockStart);

    const psMatch = body.match(/Powersuit\s*=\s*"([^"]+)"/);
    const warframeName = psMatch?.[1] || '';

    const inMatch = body.match(/InternalName\s*=\s*"([^"]+)"/);
    const internalName = inMatch?.[1] || '';

    const augMatch = body.match(/Augments\s*=\s*\{([^}]*)\}/);
    if (augMatch && warframeName) {
      const augNames = [...augMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      for (const augName of augNames) {
        mappings.push({
          augmentName: augName,
          abilityName,
          abilityUniqueName: internalName,
          warframeName,
        });
      }
    }
  }

  return mappings;
}

export async function scrapeAugments(
  onProgress?: (msg: string) => void,
): Promise<WikiAugmentMapping[]> {
  onProgress?.('Fetching Module:Ability/data...');
  const mappings = await fetchAugmentMappings();
  onProgress?.(`Found ${mappings.length} augment→ability mappings`);
  return mappings;
}

function parseBuffValues(text: string): {
  base: number;
  tauforged: number;
  isPercent: boolean;
} | null {
  const m = text.match(
    /\+?(?<baseValue>\d+(?:\.\d+)?)(?<basePercent>%?)\s*\(\+?(?<tauValue>\d+(?:\.\d+)?)(?<tauPercent>%?)\)/,
  );
  if (!m || !m.groups) return null;
  const { baseValue, basePercent, tauValue, tauPercent } = m.groups as {
    baseValue: string;
    basePercent: string;
    tauValue: string;
    tauPercent: string;
  };
  return {
    base: parseFloat(baseValue),
    tauforged: parseFloat(tauValue),
    isPercent: basePercent === '%' || tauPercent === '%',
  };
}

function deriveValueFormat(text: string, isPercent: boolean): string {
  if (isPercent) return '%';
  if (/\/s\b/i.test(text)) return '/s';
  return '+flat';
}

export function hasArchonShardDataInDb(): boolean {
  try {
    const db = getCatalogDb();
    const row = db.prepare('SELECT COUNT(*) AS c FROM archon_shard_types').get() as { c: number };
    return row.c > 0;
  } catch {
    return false;
  }
}

export async function scrapeArchonShards(
  onProgress?: (msg: string) => void,
): Promise<WikiShardResult> {
  onProgress?.('Fetching Archon Shard wiki page...');
  const url = `${WIKI_BASE}/w/Archon_Shard`;
  const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.wikiFetch);
  if (!res.ok) throw new Error(`Failed to fetch Archon Shard page: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const table = $('table.wikitable.sortable').first();
  if (table.length === 0) throw new Error('Shard buff table not found');

  const types: WikiShardType[] = [];
  const buffs: WikiShardBuff[] = [];

  let currentShardId = '';
  let shardSortOrder = 0;
  let buffSortOrder = 0;

  table.find('tr').each((i, row) => {
    if (i === 0) return;

    const cells = $(row).find('td');
    let buffCellIdx = 0;

    const rowspanCell = cells.filter('[rowspan]').first();
    if (rowspanCell.length > 0) {
      const paramSpan = rowspanCell.find('span.tooltip[data-param-name]').first();
      const shardName = paramSpan.attr('data-param-name') || rowspanCell.text().trim();
      const color = shardName
        .replace(/\s*Archon Shard.*/, '')
        .replace('Tauforged ', '')
        .trim();
      const id = color.toLowerCase();

      shardSortOrder++;
      buffSortOrder = 0;
      currentShardId = id;

      types.push({
        id,
        name: color,
        icon_path: `/icons/shards/${color}ArchonShard.png`,
        tauforged_icon_path: `/icons/shards/Tauforged${color}ArchonShard.png`,
        sort_order: shardSortOrder,
      });

      buffCellIdx = 1;
    }

    const buffCell = cells.eq(buffCellIdx);
    const buffText = buffCell.text().trim();
    if (!buffText || !currentShardId) return;

    const parsedValues = parseBuffValues(buffText);
    if (!parsedValues) {
      logger.warn(`[wikiScraper] Skipping unparsable shard buff text: "${buffText}"`);
      return;
    }

    buffSortOrder++;
    const { base, tauforged, isPercent } = parsedValues;
    const valueFormat = deriveValueFormat(buffText, isPercent);

    buffs.push({
      shard_type_id: currentShardId,
      description: buffText,
      base_value: base,
      tauforged_value: tauforged,
      value_format: valueFormat,
      sort_order: buffSortOrder,
    });
  });

  onProgress?.(`Found ${types.length} shard types with ${buffs.length} buffs`);
  return { types, buffs };
}

export async function scrapeRivenDispositions(
  onProgress?: (msg: string) => void,
): Promise<WikiRivenDisposition[]> {
  function dedupeDispositions(
    items: WikiRivenDisposition[],
    keep: 'first' | 'last' = 'first',
  ): WikiRivenDisposition[] {
    const deduped = new Map<string, WikiRivenDisposition>();
    for (const d of items) {
      const key = d.weapon_name.toLowerCase();
      if (!deduped.has(key) || keep === 'last') {
        deduped.set(key, d);
      }
    }
    return Array.from(deduped.values());
  }

  function collectRivenDispositionsFromCheerio(
    $: cheerio.CheerioAPI,
    sourceLabel: string,
  ): WikiRivenDisposition[] {
    const dispositions: WikiRivenDisposition[] = [];

    $('table.wikitable, table.listtable').each((_, table) => {
      const headers = $(table)
        .find('tr')
        .first()
        .find('th')
        .toArray()
        .map((th) => normalizeText($(th).text()).toLowerCase());
      if (!headers.some((h) => h.includes('weapon') || h.includes('name'))) return;
      if (
        !headers.some(
          (h) => h.includes('disposition') || h.includes('attenuation') || h.includes('multiplier'),
        )
      ) {
        return;
      }

      $(table)
        .find('tr')
        .slice(1)
        .each((__, row) => {
          const cells = $(row).find('td');
          if (cells.length < 2) return;
          const weaponName = normalizeText(cells.eq(0).text()).replace(/\s+/g, ' ');
          const rowText = normalizeText($(row).text());
          const multMatch = rowText.match(/(\d+(?:\.\d+)?)\s*x/i);
          if (!weaponName || !multMatch) return;
          const disposition = parseFloat(multMatch[1]);
          if (!Number.isFinite(disposition)) return;
          dispositions.push({ weapon_name: weaponName, disposition });
        });
    });

    const addFromText = (text: string): void => {
      const normalized = normalizeText(text).replace(/\s+/g, ' ').trim();
      if (!normalized) return;
      const m = normalized.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\)\s*$/);
      if (!m) return;

      const weaponName = m[1].trim();
      const disposition = parseFloat(m[2]);
      if (!weaponName || !Number.isFinite(disposition)) return;
      if (disposition < 0 || disposition > 2) return;

      dispositions.push({ weapon_name: weaponName, disposition });
    };

    $('#mw-content-text td, #mw-content-text li').each((_, el) => {
      addFromText($(el).text());
    });
    if (dispositions.length === 0) {
      const text = normalizeText($('#mw-content-text').text());
      const re = /([A-Za-z0-9'().\-&:+/ ]{2,}?)\s*\((\d+(?:\.\d+)?)\)/g;
      let match: RegExpExecArray | null = null;
      while ((match = re.exec(text)) !== null) {
        addFromText(`${match[1]}(${match[2]})`);
      }
    }

    const deduped = dedupeDispositions(dispositions);
    onProgress?.(
      `[Riven Dispositions] Parsed ${deduped.length} candidate rows from ${sourceLabel}`,
    );
    return deduped;
  }

  onProgress?.('Fetching Riven Mods wiki page...');
  const res = await fetchWithTimeout(`${WIKI_BASE}/w/Riven_Mods`, {}, FETCH_TIMEOUT_MS.wikiFetch);
  if (!res.ok) {
    throw new Error(`Failed to fetch Riven Mods page: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  let output = collectRivenDispositionsFromCheerio($, '/w/Riven_Mods');

  if (output.length === 0) {
    onProgress?.(
      '[Riven Dispositions] No rows found on /w/Riven_Mods; trying /w/Riven_Mods/Weapon_Dispos...',
    );
    const fallbackRes = await fetchWithTimeout(
      `${WIKI_BASE}/w/Riven_Mods/Weapon_Dispos`,
      {},
      FETCH_TIMEOUT_MS.wikiFetch,
    );
    if (fallbackRes.ok) {
      const fallbackHtml = await fallbackRes.text();
      const $fallback = cheerio.load(fallbackHtml);
      output = collectRivenDispositionsFromCheerio($fallback, '/w/Riven_Mods/Weapon_Dispos');
    } else {
      onProgress?.(
        `[Riven Dispositions] Fallback page fetch failed: ${fallbackRes.status} ${fallbackRes.statusText}`,
      );
    }
  }

  onProgress?.(`Found ${output.length} riven disposition rows`);
  return output;
}

function normalizeWikiWeaponLabel(s: string): string {
  return normalizeText(s).replace(/\s+/g, ' ').toLowerCase();
}

function parseProjectileSpeedCell(text: string): number | null {
  const t = normalizeText(text);
  if (!t || /^n\/?a$/i.test(t)) return null;
  const m = t.match(/(\d+(?:\.\d+)?)\s*m?\/?s/i);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractWeaponNameFromCell($: cheerio.CheerioAPI, cellElement: Element): string {
  const $cell = $(cellElement);
  const link = $cell.find('a[href*="/w/"]').first();
  const fromLink = normalizeText(link.text());
  if (fromLink) return fromLink;
  return normalizeText($cell.text());
}

function getWikiTableHeaderRow(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>,
): cheerio.Cheerio<Element> {
  const thead = $table.find('thead tr').first();
  if (thead.length) return thead;
  return $table
    .find('tr')
    .filter((_, el) => $(el).find('th').length > 0)
    .first();
}

function parseProjectileSpeedTables($: cheerio.CheerioAPI): Map<string, Array<number | null>> {
  const map = new Map<string, Array<number | null>>();

  function appendSpeed(nameRaw: string, speed: number | null): void {
    if (!nameRaw) return;
    const name = normalizeWikiWeaponLabel(nameRaw);
    if (!name) return;
    const existing = map.get(name) ?? [];
    existing.push(speed);
    map.set(name, existing);
  }

  $('table.wikitable, table.listtable').each((_, table) => {
    const $table = $(table);
    const $headerRow = getWikiTableHeaderRow($, $table);
    if ($headerRow.length === 0) return;

    const headerCells = $headerRow.find('th, td').toArray();
    const headerTexts = headerCells.map((c) => normalizeText($(c).text()).toLowerCase());

    const nameIdx = headerTexts.findIndex((h) => h === 'name' || h.startsWith('name '));
    if (nameIdx < 0) return;

    const chargedFlightIdx = headerTexts.findIndex((h) => h.includes('charged flight'));
    if (chargedFlightIdx >= 0) {
      const bodyRows = $table.find('tbody tr').length
        ? $table.find('tbody tr')
        : $table.find('tr').slice(1);
      bodyRows.each((__, row) => {
        const cells = $(row).find('td').toArray();
        if (cells.length <= Math.max(nameIdx, chargedFlightIdx)) return;
        const wname = extractWeaponNameFromCell($, cells[nameIdx]);
        const speed = parseProjectileSpeedCell($(cells[chargedFlightIdx]).text());
        appendSpeed(wname, speed);
      });
      return;
    }

    const speedIdx = headerTexts.findIndex(
      (h) => h.includes('projectile speed') || h.includes('projectile speed (m/s)'),
    );
    if (speedIdx < 0) return;

    const bodyRows = $table.find('tbody tr').length
      ? $table.find('tbody tr')
      : $table.find('tr').slice(1);
    bodyRows.each((__, row) => {
      const cells = $(row).find('td').toArray();
      if (cells.length <= Math.max(nameIdx, speedIdx)) return;
      const wname = extractWeaponNameFromCell($, cells[nameIdx]);
      const speed = parseProjectileSpeedCell($(cells[speedIdx]).text());
      appendSpeed(wname, speed);
    });
  });

  return map;
}

export async function scrapeProjectileSpeedsFromWiki(
  onProgress?: (msg: string) => void,
): Promise<Map<string, Array<number | null>>> {
  onProgress?.('Fetching Projectile Speed wiki page...');
  const res = await fetchWithTimeout(
    `${WIKI_BASE}/w/Projectile_Speed`,
    {},
    FETCH_TIMEOUT_MS.wikiFetch,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Projectile Speed page: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const map = parseProjectileSpeedTables($);
  onProgress?.(`Parsed projectile speeds for ${map.size} wiki weapon name(s)`);
  return map;
}

function buildProjectileSpeedLookupKeys(name: string, slot: number | null): string[] {
  const base = normalizeWikiWeaponLabel(name);
  const keys: string[] = [base];
  if (slot === SLOT_PRIMARY) {
    keys.push(`${base} (primary)`);
  } else if (slot === SLOT_SECONDARY) {
    keys.push(`${base} (secondary)`);
  }
  return keys;
}

function resolveProjectileSpeedList(
  wikiMap: Map<string, Array<number | null>>,
  name: string,
  slot: number | null,
): Array<number | null> | undefined {
  const keys = buildProjectileSpeedLookupKeys(name, slot);
  for (const k of keys) {
    const hit = wikiMap.get(k);
    if (hit && hit.length > 0) return hit;
  }
  return undefined;
}

function mergeProjectileSpeedsIntoWeapons(
  wikiMap: Map<string, Array<number | null>>,
  onProgress?: (msg: string) => void,
): number {
  const db = getCatalogDb();
  const update = db.prepare('UPDATE weapons SET fire_behaviors = ? WHERE unique_name = ?');
  const rows = db
    .prepare(
      `SELECT unique_name, name, slot, fire_behaviors FROM weapons WHERE fire_behaviors IS NOT NULL`,
    )
    .all() as Array<{
    unique_name: string;
    name: string;
    slot: number | null;
    fire_behaviors: string;
  }>;

  let updated = 0;
  for (const row of rows) {
    const speeds = resolveProjectileSpeedList(wikiMap, row.name, row.slot);
    if (!speeds || speeds.length === 0) continue;
    if (!speeds.some((s) => s != null && Number.isFinite(s))) continue;

    let behaviors: unknown;
    try {
      behaviors = JSON.parse(row.fire_behaviors);
    } catch {
      continue;
    }
    if (!Array.isArray(behaviors)) continue;

    const next = behaviors.map((b, i) => {
      if (i >= speeds.length) return b;
      if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
      const s = speeds[i];
      if (s == null || !Number.isFinite(s)) return b;
      return { ...(b as Record<string, unknown>), projectileSpeed: s };
    });

    const newJson = JSON.stringify(next);
    if (newJson === row.fire_behaviors) continue;
    update.run(newJson, row.unique_name);
    updated++;
  }

  onProgress?.(`Projectile speed: updated ${updated} weapon fire mode row(s)`);
  return updated;
}

export interface WikiMergeResult {
  abilitiesUpdated: number;
  passivesUpdated: number;
  augmentsUpdated: number;
  shardTypes: number;
  shardBuffs: number;
  rivenDispositionsSyncedFromOmega: number;
  rivenDispositionsWikiFallback: number;
  weaponsProjectileSpeedsUpdated: number;
}

export function mergeWikiData(
  data: WikiScrapeResult,
  onProgress?: (msg: string) => void,
): WikiMergeResult {
  const db = getCatalogDb();
  const result: WikiMergeResult = {
    abilitiesUpdated: 0,
    passivesUpdated: 0,
    augmentsUpdated: 0,
    shardTypes: 0,
    shardBuffs: 0,
    rivenDispositionsSyncedFromOmega: 0,
    rivenDispositionsWikiFallback: 0,
    weaponsProjectileSpeedsUpdated: 0,
  };

  const updateAbility = db.prepare(
    'UPDATE abilities SET wiki_stats = ?, energy_cost = ? WHERE unique_name = ?',
  );
  const updatePassive = db.prepare(
    'UPDATE warframes SET passive_description_wiki = ? WHERE unique_name = ?',
  );
  const updatePassiveLike = db.prepare(
    `UPDATE warframes SET passive_description_wiki = ?
     WHERE unique_name LIKE ? AND passive_description_wiki IS NULL`,
  );
  const updateAugment = db.prepare(
    'UPDATE mods SET augment_for_ability = ? WHERE name = ? AND is_augment = 1',
  );
  const syncRivenDispositionFromOmega = db.prepare(
    'UPDATE weapons SET riven_disposition = omega_attenuation WHERE omega_attenuation IS NOT NULL',
  );
  const updateRivenDispositionWikiFallback = db.prepare(
    'UPDATE weapons SET riven_disposition = ? WHERE name = ? COLLATE NOCASE AND omega_attenuation IS NULL',
  );

  const mergeAll = db.transaction(() => {
    for (const ab of data.abilities) {
      const statsJson = JSON.stringify(ab.stats);
      const changes = updateAbility.run(statsJson, ab.stats.energy_cost, ab.uniqueName);
      if (changes.changes > 0) result.abilitiesUpdated++;
    }

    for (const p of data.passives) {
      const changes = updatePassive.run(p.passive, p.uniqueName);
      if (changes.changes > 0) result.passivesUpdated++;

      if (p.uniqueName.includes('/')) {
        const pathBase = `${p.uniqueName.substring(0, p.uniqueName.lastIndexOf('/') + 1)}%`;
        updatePassiveLike.run(p.passive, pathBase);
      }
    }

    for (const aug of data.augments) {
      const changes = updateAugment.run(aug.abilityName, aug.augmentName);
      if (changes.changes > 0) result.augmentsUpdated++;
    }

    if (data.shards.types.length > 0) {
      const getTypeByName = db.prepare(
        'SELECT id FROM archon_shard_types WHERE lower(name) = lower(?) LIMIT 1',
      );
      const insertType = db.prepare(
        'INSERT INTO archon_shard_types (name, icon_path, tauforged_icon_path, sort_order) VALUES (?, ?, ?, ?)',
      );
      const updateType = db.prepare(
        'UPDATE archon_shard_types SET name = ?, icon_path = ?, tauforged_icon_path = ?, sort_order = ? WHERE id = ?',
      );
      const getBuffByTypeAndOrder = db.prepare(
        'SELECT id FROM archon_shard_buffs WHERE shard_type_id = ? AND sort_order = ? LIMIT 1',
      );
      const insertBuff = db.prepare(
        'INSERT INTO archon_shard_buffs (shard_type_id, description, base_value, tauforged_value, value_format, sort_order, armory_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );
      const updateBuff = db.prepare(
        'UPDATE archon_shard_buffs SET description = ?, base_value = ?, tauforged_value = ?, value_format = ?, armory_key = ? WHERE id = ?',
      );

      const typeIdMap = new Map<string, number>();
      const dbTypeNameById = new Map<number, string>();
      for (const st of data.shards.types) {
        const existingType = getTypeByName.get(st.name) as { id: number } | undefined;
        if (existingType) {
          updateType.run(
            st.name,
            st.icon_path,
            st.tauforged_icon_path,
            st.sort_order,
            existingType.id,
          );
          typeIdMap.set(st.id, existingType.id);
          dbTypeNameById.set(existingType.id, st.name);
        } else {
          const insertResult = insertType.run(
            st.name,
            st.icon_path,
            st.tauforged_icon_path,
            st.sort_order,
          );
          const insertedTypeId = Number(
            (insertResult as { lastInsertRowid: number | bigint }).lastInsertRowid,
          );
          typeIdMap.set(st.id, insertedTypeId);
          dbTypeNameById.set(insertedTypeId, st.name);
        }
        result.shardTypes++;
      }

      for (const sb of data.shards.buffs) {
        const shardTypeId = typeIdMap.get(sb.shard_type_id);
        if (shardTypeId === undefined) {
          console.warn(
            `[wikiScraper] Missing shard type mapping for buff: shard_type_id=${sb.shard_type_id}, description=${sb.description}, sort_order=${sb.sort_order}`,
          );
          continue;
        }

        const typeName = dbTypeNameById.get(shardTypeId);
        const armoryKey =
          typeName != null ? catalogArmoryKeyForArchonBuff(typeName, sb.sort_order) : null;

        const existingBuff = getBuffByTypeAndOrder.get(shardTypeId, sb.sort_order) as
          | { id: number }
          | undefined;
        if (existingBuff) {
          updateBuff.run(
            sb.description,
            sb.base_value,
            sb.tauforged_value,
            sb.value_format,
            armoryKey,
            existingBuff.id,
          );
        } else {
          insertBuff.run(
            shardTypeId,
            sb.description,
            sb.base_value,
            sb.tauforged_value,
            sb.value_format,
            sb.sort_order,
            armoryKey,
          );
        }
        result.shardBuffs++;
      }
    }

    const synced = syncRivenDispositionFromOmega.run();
    result.rivenDispositionsSyncedFromOmega = synced.changes;

    for (const d of data.dispositions) {
      const changes = updateRivenDispositionWikiFallback.run(d.disposition, d.weapon_name);
      if (changes.changes > 0) result.rivenDispositionsWikiFallback += changes.changes;
    }

    if (data.projectileSpeedByWeapon.size > 0) {
      result.weaponsProjectileSpeedsUpdated = mergeProjectileSpeedsIntoWeapons(
        data.projectileSpeedByWeapon,
        onProgress,
      );
    }
  });

  mergeAll();
  onProgress?.(
    `Merged: ${result.abilitiesUpdated} abilities, ` +
      `${result.passivesUpdated} passives, ` +
      `${result.augmentsUpdated} augments, ` +
      `${result.shardTypes} shard types, ${result.shardBuffs} shard buffs, ` +
      `${result.rivenDispositionsSyncedFromOmega} riven dispositions synced from omega, ` +
      `${result.rivenDispositionsWikiFallback} wiki disposition fallbacks (no omega), ` +
      `${result.weaponsProjectileSpeedsUpdated} weapon projectile speed rows`,
  );
  return result;
}

export interface WikiScrapeRunResult {
  merge: WikiMergeResult;
  helminthWikiHtml: string | null;
}

export async function runWikiScrape(
  onProgress?: (progress: WikiScrapeProgress) => void,
  onlyMissing = false,
): Promise<WikiScrapeRunResult> {
  const state: WikiScrapeProgress = {
    phase: 'augments',
    current: 0,
    total: 0,
    currentItem: '',
    log: [],
  };

  const log = (msg: string) => {
    state.log.push(msg);
    onProgress?.(state);
  };

  state.phase = 'augments';
  let augments: WikiAugmentMapping[] = [];
  try {
    augments = await scrapeAugments(log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(
      `[WikiScraper] fetchAugmentMappings/scrapeAugments failed: ${message}. Continuing with empty augment mappings.`,
    );
  }

  state.phase = 'shards';
  let shards: WikiShardResult = { types: [], buffs: [] };
  try {
    shards = await scrapeArchonShards(log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`[WikiScraper] scrapeArchonShards failed: ${message}. Continuing with empty shard data.`);
  }

  state.phase = 'riven_disposition';
  let dispositions: WikiRivenDisposition[] = [];
  try {
    dispositions = await scrapeRivenDispositions(log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(
      `[WikiScraper] scrapeRivenDispositions failed: ${message}. Continuing with empty dispositions.`,
    );
  }

  state.phase = 'projectile_speed';
  let projectileSpeedByWeapon = new Map<string, Array<number | null>>();
  try {
    projectileSpeedByWeapon = await scrapeProjectileSpeedsFromWiki(log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(
      `[WikiScraper] scrapeProjectileSpeedsFromWiki failed: ${message}. Continuing without projectile speeds.`,
    );
  }

  state.phase = 'abilities';
  const helminthFetch = await fetchHelminthWikiHtml();
  const helminthWikiHtml = helminthFetch.fetchOk ? helminthFetch.html : null;
  if (!helminthFetch.fetchOk) {
    log(
      `[WikiScraper] Helminth wiki fetch failed: ${helminthFetch.error ?? 'unknown error'}. Ability URL resolution may fall back to per-ability requests.`,
    );
  }

  const abilities = await scrapeAbilities(
    (msg) => {
      const m = msg.match(/\[(\d+)\/(\d+)\]\s*(.*)/);
      if (m) {
        state.current = parseInt(m[1]);
        state.total = parseInt(m[2]);
        state.currentItem = m[3];
      }
      log(msg);
    },
    onlyMissing,
    helminthWikiHtml,
  );

  state.phase = 'passives';
  const passives = await scrapePassives((msg) => {
    const m = msg.match(/\[(\d+)\/(\d+)\]\s*(.*)/);
    if (m) {
      state.current = parseInt(m[1]);
      state.total = parseInt(m[2]);
      state.currentItem = m[3];
    }
    log(msg);
  }, onlyMissing);

  state.phase = 'merging';
  log('Merging wiki data into database...');
  const result = mergeWikiData(
    { abilities, passives, augments, shards, dispositions, projectileSpeedByWeapon },
    log,
  );

  state.phase = 'done';
  log('Wiki scrape complete');
  onProgress?.(state);

  return { merge: result, helminthWikiHtml };
}

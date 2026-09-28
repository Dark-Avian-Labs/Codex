import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { getCatalogDb } from '../db/connection.js';
import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS, fetchTextBounded } from '../http/fetchWithTimeout.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';

export interface WikiFireBehavior {
  name: string;
  ammoRequirement: number;
  fireRate?: number;
}

function wikiSlug(name: string): string {
  return encodeURIComponent(name.replace(/ /g, '_'));
}

function parseFireRateValue(raw: string): number | undefined {
  const match = raw.match(/([\d.]+)/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function readInfoboxRowValue(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<Element>,
  labelIncludes: string,
): string | null {
  let found: string | null = null;
  infobox.find('.row').each((_, row) => {
    const label = $(row).find('.label').text().replace(/\s+/g, ' ').trim().toLowerCase();
    if (!label.includes(labelIncludes.toLowerCase())) return;
    const value = $(row).find('.value').text().replace(/\s+/g, ' ').trim();
    if (value) found = value;
  });
  return found;
}

export function parseWeaponFireBehaviorsFromWikiHtml(html: string): WikiFireBehavior[] {
  const $ = cheerio.load(html);
  const infobox = $('div.infobox').first();
  if (infobox.length === 0) return [];

  const behaviors: WikiFireBehavior[] = [];
  infobox.find('.group').each((_, group) => {
    const $group = $(group);
    const header = $group.find('.header').first().text().replace(/\s+/g, ' ').trim();
    if (!header) return;

    let fireRate: number | undefined;
    $group.find('.row').each((_, row) => {
      const label = $(row).find('.label').text().replace(/\s+/g, ' ').trim().toLowerCase();
      if (!label.includes('fire rate')) return;
      const value = $(row).find('.value').text().replace(/\s+/g, ' ').trim();
      fireRate = parseFireRateValue(value);
    });

    if (/attack/i.test(header) || fireRate != null) {
      const entry: WikiFireBehavior = { name: header, ammoRequirement: 1 };
      if (fireRate != null) entry.fireRate = fireRate;
      behaviors.push(entry);
    }
  });

  if (behaviors.length > 0) return behaviors;

  const triggerRaw = readInfoboxRowValue($, infobox, 'trigger type');
  const modes = triggerRaw
    ? triggerRaw
        .split(/\s*\/\s*|\s*,\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
    : ['Default'];

  for (const mode of modes) {
    behaviors.push({ name: mode, ammoRequirement: 1 });
  }

  return behaviors;
}

async function fetchWeaponWikiHtml(name: string): Promise<string | null> {
  const url = `${WIKI_BASE}/w/${wikiSlug(name)}`;
  const { response, text } = await fetchTextBounded(
    url,
    { headers: { 'User-Agent': getWikiUserAgent() } },
    FETCH_TIMEOUT_MS.wikiFetch,
    FETCH_BYTE_LIMITS.html,
  );
  if (!response.ok) return null;
  return text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function countWeaponsMissingFireBehaviors(): number {
  const db = getCatalogDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM weapons
       WHERE fire_behaviors IS NULL OR TRIM(fire_behaviors) = '' OR fire_behaviors = '[]'`,
    )
    .get() as { c: number };
  return row.c;
}

export async function syncWeaponFireBehaviorsFromWiki(
  onProgress?: (msg: string) => void,
  onlyMissing = true,
): Promise<{ attempted: number; updated: number }> {
  const db = getCatalogDb();
  const rows = db
    .prepare(
      onlyMissing
        ? `SELECT unique_name, name FROM weapons
           WHERE (fire_behaviors IS NULL OR TRIM(fire_behaviors) = '' OR fire_behaviors = '[]')
             AND name IS NOT NULL AND TRIM(name) <> ''
             AND product_category NOT IN ('SentinelWeapons')
           ORDER BY name`
        : `SELECT unique_name, name FROM weapons
           WHERE name IS NOT NULL AND TRIM(name) <> ''
             AND product_category NOT IN ('SentinelWeapons')
           ORDER BY name`,
    )
    .all() as Array<{ unique_name: string; name: string }>;

  const update = db.prepare('UPDATE weapons SET fire_behaviors = ? WHERE unique_name = ?');
  let attempted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    attempted += 1;
    onProgress?.(`[${i + 1}/${rows.length}] ${row.name}`);

    try {
      const html = await fetchWeaponWikiHtml(row.name);
      if (!html) continue;
      const behaviors = parseWeaponFireBehaviorsFromWikiHtml(html);
      if (behaviors.length === 0) continue;
      const json = JSON.stringify(behaviors);
      const result = update.run(json, row.unique_name);
      if (result.changes > 0) updated += 1;
    } catch (error) {
      onProgress?.(
        `  Failed ${row.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (i < rows.length - 1) await sleep(350);
  }

  onProgress?.(`Weapon fire behaviors: updated ${updated} of ${attempted} wiki page(s)`);
  return { attempted, updated };
}

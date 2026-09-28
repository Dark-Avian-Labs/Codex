import * as cheerio from 'cheerio';

import { getCatalogDb } from '../db/connection.js';
import { dedupeHelminthAbilityRows } from '../helminthAbilityDedupe.js';
import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS, fetchTextBounded } from '../http/fetchWithTimeout.js';
import { normalizeAbilityName } from './helminthWikiPage.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';

function warframeWikiSlug(displayName: string): string {
  const clean = displayName.replace(/^<ARCHWING>\s*/i, '').trim();
  return encodeURIComponent(clean.replace(/ /g, '_'));
}

export function parseSubsumableAbilitiesFromWarframeAbilitiesHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const names = new Set<string>();

  $('tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text();
    if (!/subsumable\s+to\s+helminth/i.test(rowText)) return;

    const abilityLink = $row
      .find('a[data-param-source="Ability"][href^="/w/"], table.ability-box a[href^="/w/"]')
      .first();
    let name = abilityLink.text().replace(/\s+/g, ' ').trim();
    if (!name) {
      const title = abilityLink.attr('title')?.trim() ?? '';
      name = title.replace(/\s*\(ability\)\s*$/i, '').trim();
    }
    const normalized = normalizeAbilityName(name);
    if (normalized && normalized.length >= 3 && normalized.length <= 80) {
      names.add(normalized);
    }
  });

  return Array.from(names);
}

async function fetchWarframeAbilitiesHtml(warframeName: string): Promise<string | null> {
  const url = `${WIKI_BASE}/w/${warframeWikiSlug(warframeName)}/Abilities`;
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

export function warframeNamesNeedingHelminthWikiScrape(
  db: import('better-sqlite3').Database,
): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT w.name AS name
       FROM warframes w
       WHERE w.name IS NOT NULL AND TRIM(w.name) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM abilities a
           WHERE a.warframe_unique_name = w.unique_name
             AND a.is_helminth_extractable = 1
         )
       ORDER BY w.name`,
    )
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export async function collectHelminthAbilityNamesFromWarframeWikiPages(
  onProgress?: (msg: string) => void,
): Promise<Set<string>> {
  const db = getCatalogDb();
  const warframes = warframeNamesNeedingHelminthWikiScrape(db).map((name) => ({ name }));
  if (warframes.length === 0) {
    onProgress?.(
      '[Helminth wiki] Skipped warframe pages — all warframes already have helminth data.',
    );
    return new Set<string>();
  }

  const names = new Set<string>();
  for (let i = 0; i < warframes.length; i++) {
    const wf = warframes[i]!;
    onProgress?.(`[Helminth wiki] ${i + 1}/${warframes.length} ${wf.name}`);
    try {
      const html = await fetchWarframeAbilitiesHtml(wf.name);
      if (!html) continue;
      for (const abilityName of parseSubsumableAbilitiesFromWarframeAbilitiesHtml(html)) {
        names.add(abilityName);
      }
    } catch (error) {
      onProgress?.(`  ${wf.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (i < warframes.length - 1) await sleep(300);
  }

  onProgress?.(`[Helminth wiki] ${names.size} subsumable ability name(s) from warframe pages`);
  return names;
}

export function applyHelminthFlagsFromWikiNames(
  db: import('better-sqlite3').Database,
  names: Set<string>,
): number {
  if (names.size === 0) {
    return 0;
  }

  const rows = db
    .prepare(`SELECT unique_name, name FROM abilities WHERE name IS NOT NULL AND TRIM(name) != ''`)
    .all() as Array<{ unique_name: string; name: string }>;

  const matched: Array<{ unique_name: string; name: string }> = [];
  for (const row of rows) {
    const key = normalizeAbilityName(row.name);
    if (key && names.has(key)) matched.push(row);
  }

  const toUpdate = dedupeHelminthAbilityRows(matched).map((r) => r.unique_name);
  const stmt = db.prepare('UPDATE abilities SET is_helminth_extractable = 1 WHERE unique_name = ?');
  const runMany = db.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(id);
  });
  runMany(toUpdate);
  return toUpdate.length;
}

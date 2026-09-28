import * as cheerio from 'cheerio';

import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS, fetchBounded } from '../http/fetchWithTimeout.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

export const HELMINTH_WIKI_URL = 'https://wiki.warframe.com/w/Helminth';
const WIKI_BASE = 'https://wiki.warframe.com';

const ABILITY_TOOLTIP = '.tooltip[data-param-source="Ability"]';

export function normalizeAbilityName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectHelminthAbilityLinkElements($: cheerio.CheerioAPI) {
  const $content = $('#mw-content-text');
  const checklistLinks = $content.find(
    `table[data-tableid="Subsumable Ability Checklist"] tr td:nth-child(2) ${ABILITY_TOOLTIP} a[href^="/w/"]`,
  );
  const helminthSectionLinks = $content
    .find('h3#Helminth_Abilities')
    .closest('div.mw-heading')
    .nextAll('table.ability-box')
    .find(`${ABILITY_TOOLTIP} a[href^="/w/"]`);

  if (checklistLinks.length > 0 || helminthSectionLinks.length > 0) {
    return checklistLinks.add(helminthSectionLinks);
  }

  return $content.find(`${ABILITY_TOOLTIP} a[href^="/w/"]`);
}

export async function fetchHelminthWikiHtml(): Promise<{
  html: string | null;
  fetchOk: boolean;
  error?: string;
}> {
  try {
    const { response, body } = await fetchBounded(
      HELMINTH_WIKI_URL,
      {
        headers: {
          'User-Agent': getWikiUserAgent(),
        },
      },
      FETCH_TIMEOUT_MS.wikiFetch,
      FETCH_BYTE_LIMITS.html,
    );
    if (!response.ok) {
      return {
        html: null,
        fetchOk: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
    return { html: body.toString('utf-8'), fetchOk: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { html: null, fetchOk: false, error: message };
  }
}

export function parseHelminthExtractableAbilityNames(html: string): Set<string> {
  const $ = cheerio.load(html);
  const names = new Set<string>();

  collectHelminthAbilityLinkElements($).each((_, el) => {
    const text = normalizeAbilityName($(el).text());
    const title = normalizeAbilityName($(el).attr('title') || '');
    for (const raw of [text, title]) {
      if (!raw) continue;
      const cleaned = raw.replace(/\s*\(ability\)$/, '').trim();
      if (!cleaned || cleaned.length < 3 || cleaned.length > 80) continue;
      names.add(cleaned);
    }
  });

  return names;
}

export function resolveHelminthAbilityWikiUrls(
  html: string,
  abilityNames: string[],
  normalizeText: (value: string) => string,
): Map<string, string> {
  const resolved = new Map<string, string>();
  if (abilityNames.length === 0) return resolved;

  const $ = cheerio.load(html);
  for (const name of abilityNames) {
    const normName = normalizeText(name);
    $('a[href^="/w/"]').each((_, el) => {
      if (resolved.has(name)) return false;
      const linkText = normalizeText($(el).text());
      const title = normalizeText($(el).attr('title') || '');
      const href = $(el).attr('href') || '';
      if (linkText === normName || title === normName || title.startsWith(`${normName} (`)) {
        resolved.set(name, `${WIKI_BASE}${href}`);
        return false;
      }
    });
  }

  return resolved;
}

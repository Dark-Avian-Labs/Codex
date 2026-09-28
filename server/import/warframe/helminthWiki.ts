import type Database from 'better-sqlite3';

import {
  fetchHelminthWikiHtml,
  parseHelminthExtractableAbilityNames,
} from './scraping/helminthWikiPage.js';
import {
  applyHelminthFlagsFromWikiNames,
  collectHelminthAbilityNamesFromWarframeWikiPages,
} from './scraping/warframeHelminthAbilityWiki.js';

export async function fetchHelminthAbilityNameSet(options?: { html?: string | null }): Promise<{
  names: Set<string>;
  fetchOk: boolean;
  error?: string;
}> {
  let html = options?.html ?? null;
  if (html == null) {
    const fetched = await fetchHelminthWikiHtml();
    if (!fetched.fetchOk || fetched.html == null) {
      return {
        names: new Set(),
        fetchOk: fetched.fetchOk,
        error: fetched.error,
      };
    }
    html = fetched.html;
  }

  return { names: parseHelminthExtractableAbilityNames(html), fetchOk: true };
}

export interface HelminthWikiSyncResult {
  wikiNamesFound: number;
  abilitiesFlagged: number;
  fetchOk: boolean;
  error?: string;
}

export async function syncHelminthFlagsFromWiki(
  db: Database.Database,
  options?: { html?: string | null; onProgress?: (msg: string) => void },
): Promise<HelminthWikiSyncResult> {
  const combined = new Set<string>();
  const { names: helminthPageNames, fetchOk, error } = await fetchHelminthAbilityNameSet(options);
  for (const name of helminthPageNames) combined.add(name);

  if (!fetchOk) {
    return {
      wikiNamesFound: combined.size,
      abilitiesFlagged: 0,
      fetchOk,
      error,
    };
  }

  const warframePageNames = await collectHelminthAbilityNamesFromWarframeWikiPages(
    options?.onProgress,
  );
  for (const name of warframePageNames) combined.add(name);

  if (combined.size === 0) {
    return {
      wikiNamesFound: 0,
      abilitiesFlagged: 0,
      fetchOk: true,
    };
  }

  const abilitiesFlagged = applyHelminthFlagsFromWikiNames(db, combined);

  return {
    wikiNamesFound: combined.size,
    abilitiesFlagged,
    fetchOk: true,
  };
}

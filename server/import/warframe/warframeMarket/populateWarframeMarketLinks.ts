import type Database from 'better-sqlite3';

import { WORKSHEET_ORDER, loadArmoryWorksheetSources } from './armorySources.js';
import { isPrimeVariantName, resolveCanonicalKey } from './canonical.js';
import { fetchWarframeMarketSlugSet } from './fetchWarframeMarketSlugs.js';
import type { MarketLinkKind, WorksheetCategory } from './resolveHref.js';
import { resolveMarketHref, warframeMarketSellHrefUsesPrimeOnlyItemSlug } from './resolveHref.js';

export interface PopulateWarframeMarketLinksResult {
  rowsUpserted: number;
  slugCount: number;
}

type MergedRow = {
  market_href: string | null;
  market_href_prime: string | null;
  link_kind: MarketLinkKind | null;
};

export async function populateWarframeMarketLinksTable(
  armoryDb: Database.Database,
): Promise<PopulateWarframeMarketLinksResult> {
  const wmSlugs = await fetchWarframeMarketSlugSet();
  const sources = loadArmoryWorksheetSources(armoryDb);

  const mergedByCanonicalKey = new Map<string, Map<WorksheetCategory, MergedRow>>();

  for (const worksheet of WORKSHEET_ORDER) {
    const names = sources[worksheet];
    for (const displayName of names) {
      const canonicalKey = resolveCanonicalKey(displayName);
      if (!canonicalKey) continue;
      const resolved = resolveMarketHref(displayName, worksheet, wmSlugs);
      let { href, kind } = resolved;
      if (
        !isPrimeVariantName(displayName) &&
        href &&
        warframeMarketSellHrefUsesPrimeOnlyItemSlug(href)
      ) {
        href = null;
        kind = null;
      }

      const outer =
        mergedByCanonicalKey.get(canonicalKey) ?? new Map<WorksheetCategory, MergedRow>();
      const entry: MergedRow = outer.get(worksheet) ?? {
        market_href: null,
        market_href_prime: null,
        link_kind: null,
      };

      if (isPrimeVariantName(displayName)) {
        entry.market_href_prime = href;
        if (entry.link_kind == null) entry.link_kind = kind;
      } else {
        entry.market_href = href;
        entry.link_kind = kind;
      }

      outer.set(worksheet, entry);
      mergedByCanonicalKey.set(canonicalKey, outer);
    }
  }

  const upsert = armoryDb.prepare(`
    INSERT INTO warframe_market_links (canonical_key, worksheet_category, market_href, market_href_prime, link_kind, updated_at)
    VALUES (@canonical_key, @worksheet_category, @market_href, @market_href_prime, @link_kind, datetime('now'))
    ON CONFLICT(canonical_key, worksheet_category) DO UPDATE SET
      market_href = excluded.market_href,
      market_href_prime = excluded.market_href_prime,
      link_kind = excluded.link_kind,
      updated_at = datetime('now')
  `);

  let rowsUpserted = 0;

  const tx = armoryDb.transaction(() => {
    for (const [canonicalKey, worksheetMap] of mergedByCanonicalKey) {
      for (const [worksheet, row] of worksheetMap) {
        upsert.run({
          canonical_key: canonicalKey,
          worksheet_category: worksheet,
          market_href: row.market_href,
          market_href_prime: row.market_href_prime,
          link_kind: row.link_kind,
        });
        rowsUpserted += 1;
      }
    }
  });

  tx();

  return { rowsUpserted, slugCount: wmSlugs.size };
}

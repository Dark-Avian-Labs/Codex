import { normalizeDisplayName } from './canonical.js';
import { warframeMarketBaseSlug } from './slug.js';

export type WorksheetCategory =
  | 'Warframes'
  | 'Primary Weapons'
  | 'Secondary Weapons'
  | 'Melee Weapons'
  | 'Modular Weapons'
  | 'Companions'
  | 'Companion Weapons'
  | 'Archwing Weapons'
  | 'Accessories'
  | 'Arcanes';

export type MarketLinkKind = 'item' | 'sister' | 'lich';

const ITEM_SELL_BASE = 'https://warframe.market/items';

const KUVA_WEAPON_WORKSHEETS = new Set<WorksheetCategory>([
  'Primary Weapons',
  'Secondary Weapons',
  'Melee Weapons',
  'Modular Weapons',
  'Companion Weapons',
  'Archwing Weapons',
]);

function isKuvaWeaponRow(displayName: string, worksheet: WorksheetCategory): boolean {
  return KUVA_WEAPON_WORKSHEETS.has(worksheet) && /^kuva\s+/i.test(displayName);
}

function isTenetSisterAuction(displayName: string, worksheet: WorksheetCategory): boolean {
  return worksheet !== 'Melee Weapons' && /^tenet\s+/i.test(displayName);
}

function lichAuctionUrl(weaponSlug: string): string {
  const q = new URLSearchParams({
    type: 'lich',
    has_ephemera: 'false',
    sort_by: 'price_asc',
    weapon_url_name: weaponSlug,
  });
  return `https://warframe.market/auctions/search?${q.toString()}`;
}

function sisterAuctionUrl(weaponSlug: string): string {
  const q = new URLSearchParams({
    type: 'sister',
    has_ephemera: 'false',
    sort_by: 'price_asc',
    weapon_url_name: weaponSlug,
  });
  return `https://warframe.market/auctions/search?${q.toString()}`;
}

function itemSellUrl(slug: string): string {
  return `${ITEM_SELL_BASE}/${encodeURIComponent(slug)}?type=sell`;
}

export function warframeMarketSellHrefUsesPrimeOnlyItemSlug(href: string | null): boolean {
  if (!href) return false;
  const m = /\/items\/([^/?]+)/.exec(href);
  if (!m) return false;
  const slug = m[1].toLowerCase();
  return /(^|_)prime(_|$)/.test(slug);
}

export interface ResolvedMarketHref {
  href: string | null;
  kind: MarketLinkKind | null;
}

export function resolveMarketHref(
  displayName: string,
  worksheet: WorksheetCategory,
  wmSlugs: ReadonlySet<string>,
): ResolvedMarketHref {
  const trimmed = normalizeDisplayName(displayName);
  if (!trimmed) {
    return { href: null, kind: null };
  }

  if (isKuvaWeaponRow(trimmed, worksheet)) {
    const slug = warframeMarketBaseSlug(trimmed);
    return slug ? { href: lichAuctionUrl(slug), kind: 'lich' } : { href: null, kind: null };
  }

  if (isTenetSisterAuction(trimmed, worksheet)) {
    const slug = warframeMarketBaseSlug(trimmed);
    return slug ? { href: sisterAuctionUrl(slug), kind: 'sister' } : { href: null, kind: null };
  }

  const base = warframeMarketBaseSlug(trimmed);
  if (!base) {
    return { href: null, kind: null };
  }

  const candidates = [base, `${base}_set`, `${base}_blueprint`];
  for (const slug of candidates) {
    if (wmSlugs.has(slug)) {
      return { href: itemSellUrl(slug), kind: 'item' };
    }
  }

  return { href: null, kind: null };
}

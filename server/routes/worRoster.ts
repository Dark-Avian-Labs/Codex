export type RosterOwnedFilter = 'owned' | 'unowned' | 'all';
export type RosterInclude = 'heroes' | 'artifacts' | 'demons';

type OwnedRow = { owned: number };

type HeroRow = OwnedRow & {
  id: number;
  catalog_hero_slug: string | null;
  name: string;
  class: string;
  faction: string;
  faction_secondary?: string | null;
  rarity: string;
  star_rating: number;
  gauge_level: number;
  is_lord?: number;
  is_regular?: number;
  is_ancient?: number;
  is_limited?: number;
  reference_tier?: string | null;
};

type ArtifactRow = OwnedRow & {
  id: number;
  catalog_artifact_slug: string | null;
  name: string;
  class?: string | null;
  rarity: string;
  star_rating: number;
  gauge_level: number;
  reference_tier?: string | null;
  exclusive_hero_slug?: string | null;
  exclusive_hero_name?: string | null;
  is_universal?: number;
};

type DemonRow = OwnedRow & {
  id: number;
  catalog_demon_slug: string | null;
  name: string;
  rarity: string;
  star_rating: number;
  gauge_level: number;
  max_level: number;
};

const ROSTER_INCLUDES = [
  'heroes',
  'artifacts',
  'demons',
] as const satisfies readonly RosterInclude[];

export function parseRosterOwnedFilter(raw: unknown): RosterOwnedFilter {
  const value = String(raw ?? '1')
    .trim()
    .toLowerCase();
  if (value === 'all' || value === '*') return 'all';
  if (value === '0' || value === 'unowned' || value === 'missing') return 'unowned';
  return 'owned';
}

export function parseRosterInclude(raw: unknown): Set<RosterInclude> {
  const all = new Set<RosterInclude>(ROSTER_INCLUDES);
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!value) return all;
  const next = new Set<RosterInclude>();
  for (const part of value.split(',')) {
    const key = part.trim();
    if (key === 'heroes' || key === 'artifacts' || key === 'demons') {
      next.add(key);
    }
  }
  return next.size > 0 ? next : all;
}

export function filterOwnedRows<T extends OwnedRow>(rows: T[], filter: RosterOwnedFilter): T[] {
  if (filter === 'all') return rows;
  const wantOwned = filter === 'owned';
  return rows.filter((row) => (row.owned === 1) === wantOwned);
}

export function compactRosterHero(hero: HeroRow) {
  return {
    id: hero.id,
    slug: hero.catalog_hero_slug,
    name: hero.name,
    class: hero.class,
    faction: hero.faction,
    faction_secondary: hero.faction_secondary ?? null,
    rarity: hero.rarity,
    star_rating: hero.star_rating,
    is_lord: hero.is_lord === 1,
    is_regular: hero.is_regular === 1,
    is_ancient: hero.is_ancient === 1,
    is_limited: hero.is_limited === 1,
    owned: hero.owned === 1,
    awakening: hero.gauge_level,
    reference_tier: hero.reference_tier ?? null,
  };
}

export function compactRosterArtifact(artifact: ArtifactRow) {
  return {
    id: artifact.id,
    slug: artifact.catalog_artifact_slug,
    name: artifact.name,
    class: artifact.class ?? null,
    rarity: artifact.rarity,
    star_rating: artifact.star_rating,
    is_universal: artifact.is_universal !== 0,
    exclusive_hero_slug: artifact.exclusive_hero_slug ?? null,
    exclusive_hero_name: artifact.exclusive_hero_name ?? null,
    owned: artifact.owned === 1,
    promotion: artifact.gauge_level,
    reference_tier: artifact.reference_tier ?? null,
  };
}

export function compactRosterDemon(demon: DemonRow) {
  return {
    id: demon.id,
    slug: demon.catalog_demon_slug,
    name: demon.name,
    rarity: demon.rarity,
    star_rating: demon.star_rating,
    owned: demon.owned === 1,
    level: demon.gauge_level,
    max_level: demon.max_level,
  };
}

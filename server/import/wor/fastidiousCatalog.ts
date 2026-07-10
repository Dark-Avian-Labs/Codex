import fs from 'node:fs';
import path from 'node:path';

import type { FactionKey, HeroClassKey } from '@codex/game-wor';

import type {
  CatalogArtifactRow,
  CatalogBundle,
  CatalogDemonRow,
  CatalogHeroRow,
} from './catalogQueries.js';
import {
  fetchFastidiousInertiaPage,
  loadOrFetchJsonCache,
  readCachedJson,
  sanitizeCacheSlug,
  sleep,
  writeCachedJson,
} from './fastidiousClient.js';
import {
  normalizeArtifactRarity,
  normalizeDamageType,
  normalizeDemonFactionGroup,
  normalizeDemonRarity,
  normalizeFactionName,
  normalizeHeroClass,
  normalizeHeroRarity,
  slugifyName,
} from './normalize.js';
import { ensureWorImportDirs, FASTIDIOUS_BASE_URL, resolveWorImportCacheDir } from './paths.js';

type FastidiousRarity = { name: string };
type FastidiousRole = { name: string; image?: string };
type FastidiousFaction = {
  name: string;
  image?: string;
  pivot?: { is_lord?: boolean };
};
type FastidiousHero = {
  name: string;
  slug: string;
  image_card?: string | null;
  damage_type?: string | null;
  rarity: FastidiousRarity;
  role: FastidiousRole;
  factions: FastidiousFaction[];
  overall_rating?: string | null;
};
type FastidiousArtifact = {
  name: string;
  image?: string | null;
  rarity: FastidiousRarity;
  role?: FastidiousRole | null;
  rating?: { name?: string | null } | null;
  hero?: { slug?: string | null; name?: string | null } | null;
  is_exclusive?: boolean;
};
type FastidiousDemonListItem = {
  name: string;
  slug: string;
  image?: string | null;
  rarity: string;
  rarity_label?: string;
  demon_faction?: { name: string; slug: string } | null;
};
type FastidiousDemonDetail = {
  slug: string;
  skills?: { unlocks_at_demon_level: number | null }[];
};
type HeroesPageProps = {
  heroes: FastidiousHero[];
  storageUrl?: string;
  storageVersion?: string;
};
type ArtifactsPageProps = {
  artifacts: FastidiousArtifact[];
  storageUrl?: string;
  storageVersion?: string;
};
type DemonsPageProps = {
  demons: FastidiousDemonListItem[];
  storageUrl?: string;
  storageVersion?: string;
};
type DemonShowProps = { demon: FastidiousDemonDetail };

export type FastidiousImageRef = {
  heroes: Record<string, string | null>;
  artifacts: Record<string, string | null>;
  demons: Record<string, string | null>;
  storageUrl: string;
  storageVersion: string;
};

export type FastidiousCatalogResult = {
  bundle: CatalogBundle;
  imageRefs: FastidiousImageRef;
  classIcons: Partial<Record<HeroClassKey, string>>;
  factionIcons: Partial<Record<FactionKey, string>>;
};

const CLASS_ICON_FILES: Record<HeroClassKey, string> = {
  fighter: 'fighter.svg',
  mage: 'mage.svg',
  marksman: 'marksman.svg',
  defender: 'defender.svg',
  healer: 'healer.svg',
  tactician: 'Profession_TacticMaster.png',
};

const FACTION_ICON_FILES: Record<Exclude<FactionKey, 'unaffiliated'>, string> = {
  watchguard: 'faction-watchguard-emblem.svg',
  north_throne: 'faction-north-throne-emblem.svg',
  nightmare_council: 'faction-nightmare-council-emblem.svg',
  cursed_cult: 'faction-cursed-cult-emblem.svg',
  infernal_blast: 'faction-infernal-blast-emblem.svg',
  star_piercers: 'faction-star-piercers-emblem.svg',
  esoteria_order: 'faction-esoteria-order-emblem.svg',
  chaos_dominion: 'faction-chaos-emblem.svg',
  supreme_arbiters: 'faction-arbiters-emblem.svg',
  unnamable: 'faction-unnamable-emblem.svg',
};

function buildStorageUrl(storageUrl: string, storageVersion: string, fileName: string): string {
  const base = storageUrl.endsWith('/') ? storageUrl : `${storageUrl}/`;
  return `${base}${fileName}?v=${storageVersion}`;
}

function computeDemonMaxLevel(detail: FastidiousDemonDetail | null): number {
  const levels = (detail?.skills ?? [])
    .map((skill) => skill.unlocks_at_demon_level)
    .filter((level): level is number => typeof level === 'number' && level > 0);
  if (levels.length === 0) return 5;
  return Math.max(...levels);
}

function mapHero(hero: FastidiousHero, displayOrder: number): CatalogHeroRow {
  const primaryFaction = hero.factions[0];
  return {
    slug: hero.slug,
    name: decodeHtmlEntities(hero.name),
    class: normalizeHeroClass(hero.role.name),
    faction: primaryFaction ? normalizeFactionName(primaryFaction.name) : ('unaffiliated' as const),
    rarity: normalizeHeroRarity(hero.rarity.name),
    damage_type: normalizeDamageType(hero.damage_type),
    is_lord: primaryFaction?.pivot?.is_lord ? 1 : 0,
    reference_tier: hero.overall_rating ?? null,
    display_order: displayOrder,
    active: 1,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function mapArtifactClass(role: FastidiousRole | null | undefined): string | null {
  if (!role?.name) return null;
  try {
    return normalizeHeroClass(role.name);
  } catch {
    return null;
  }
}

function mapArtifact(artifact: FastidiousArtifact, displayOrder: number): CatalogArtifactRow {
  const name = decodeHtmlEntities(artifact.name);
  const slug = slugifyName(name);
  const heroSlug = artifact.hero?.slug?.trim() || null;
  return {
    slug,
    name,
    class: mapArtifactClass(artifact.role),
    rarity: normalizeArtifactRarity(artifact.rarity.name),
    exclusive_hero_slug: heroSlug,
    is_universal: heroSlug ? 0 : 1,
    reference_tier: artifact.rating?.name ?? null,
    display_order: displayOrder,
    active: 1,
  };
}

function mapDemon(
  demon: FastidiousDemonListItem,
  maxLevel: number,
  displayOrder: number,
): CatalogDemonRow {
  return {
    slug: demon.slug,
    name: decodeHtmlEntities(demon.name),
    rarity: normalizeDemonRarity(demon.rarity_label ?? demon.rarity),
    faction_group: normalizeDemonFactionGroup(demon.demon_faction),
    max_level: maxLevel,
    display_order: displayOrder,
    active: 1,
  };
}

async function fetchHeroesCache(cacheDir: string, live: boolean): Promise<HeroesPageProps> {
  return loadOrFetchJsonCache(path.join(cacheDir, 'heroes.json'), live, async () => {
    const { page } = await fetchFastidiousInertiaPage<HeroesPageProps>('/heroes');
    return page.props;
  });
}

async function fetchArtifactsCache(cacheDir: string, live: boolean): Promise<ArtifactsPageProps> {
  return loadOrFetchJsonCache(path.join(cacheDir, 'artifacts.json'), live, async () => {
    const { page } = await fetchFastidiousInertiaPage<ArtifactsPageProps>('/artifacts');
    return page.props;
  });
}

async function fetchDemonsCache(cacheDir: string, live: boolean): Promise<DemonsPageProps> {
  return loadOrFetchJsonCache(path.join(cacheDir, 'demons.json'), live, async () => {
    const { page } = await fetchFastidiousInertiaPage<DemonsPageProps>('/demons');
    return page.props;
  });
}

async function loadDemonDetail(
  cacheDir: string,
  slug: string,
  live: boolean,
): Promise<FastidiousDemonDetail | null> {
  const safeSlug = sanitizeCacheSlug(slug);
  if (!safeSlug) return null;
  const detailPath = path.join(cacheDir, 'demon-details', `${safeSlug}.json`);
  if (!live && fs.existsSync(detailPath)) {
    return readCachedJson<FastidiousDemonDetail>(detailPath);
  }
  if (live) {
    try {
      const { page } = await fetchFastidiousInertiaPage<DemonShowProps>(`/demons/${safeSlug}`);
      writeCachedJson(detailPath, page.props.demon);
      await sleep(500);
      return page.props.demon;
    } catch {
      // fall through to cached fallback below
    }
  }
  if (fs.existsSync(detailPath)) {
    return readCachedJson<FastidiousDemonDetail>(detailPath);
  }
  return null;
}

export async function fetchFastidiousCatalog(options?: {
  live?: boolean;
  onLog?: (message: string) => void;
}): Promise<FastidiousCatalogResult> {
  ensureWorImportDirs();
  const cacheDir = resolveWorImportCacheDir();
  const live = options?.live ?? false;
  const onLog = options?.onLog;

  onLog?.(`Loading Fastidious catalog (${live ? 'live' : 'cache'}) from ${cacheDir}…`);

  const heroesProps = await fetchHeroesCache(cacheDir, live);
  const artifactsProps = await fetchArtifactsCache(cacheDir, live);
  const demonsProps = await fetchDemonsCache(cacheDir, live);

  const storageUrl = heroesProps.storageUrl ?? `${FASTIDIOUS_BASE_URL}/storage/`;
  const storageVersion = heroesProps.storageVersion ?? '1';

  const heroes = heroesProps.heroes.map((hero, index) => mapHero(hero, index + 1));
  const artifacts = artifactsProps.artifacts.map((artifact, index) =>
    mapArtifact(artifact, index + 1),
  );

  const demons: CatalogDemonRow[] = [];
  for (const [index, demon] of demonsProps.demons.entries()) {
    const detail = await loadDemonDetail(cacheDir, demon.slug, live);
    demons.push(mapDemon(demon, computeDemonMaxLevel(detail), index + 1));
  }

  const imageRefs: FastidiousImageRef = {
    heroes: Object.fromEntries(
      heroesProps.heroes.map((hero) => [hero.slug, hero.image_card ?? null]),
    ),
    artifacts: Object.fromEntries(
      artifactsProps.artifacts.map((artifact) => [
        slugifyName(decodeHtmlEntities(artifact.name)),
        artifact.image ?? null,
      ]),
    ),
    demons: Object.fromEntries(
      demonsProps.demons.map((demon) => [demon.slug, demon.image ?? null]),
    ),
    storageUrl,
    storageVersion,
  };

  const classIcons = Object.fromEntries(
    (Object.entries(CLASS_ICON_FILES) as [HeroClassKey, string][]).map(([key, file]) => [
      key,
      buildStorageUrl(storageUrl, storageVersion, file),
    ]),
  ) as Partial<Record<HeroClassKey, string>>;

  const factionIcons = Object.fromEntries(
    (Object.entries(FACTION_ICON_FILES) as [FactionKey, string][]).map(([key, file]) => [
      key,
      buildStorageUrl(storageUrl, storageVersion, file),
    ]),
  ) as Partial<Record<FactionKey, string>>;

  onLog?.(
    `Fastidious catalog parsed: ${heroes.length} heroes, ${artifacts.length} artifacts, ${demons.length} demons.`,
  );

  return {
    bundle: { heroes, artifacts, demons },
    imageRefs,
    classIcons,
    factionIcons,
  };
}

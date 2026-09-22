import fs from 'node:fs';
import path from 'node:path';

import { HERO_RARITIES, type FactionKey } from '@codex/game-wor';
import type Database from 'better-sqlite3';

import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../http/fetchWithTimeout.js';
import type { CatalogArtifactRow, CatalogBundle, CatalogHeroRow } from './catalogQueries.js';
import { applyHeroBaseStats } from './fandomHeroStats.js';
import { sleep } from './fastidiousClient.js';
import { decodeHtmlEntities } from './htmlEntities.js';
import { assertTrustedImageUrl } from './images.js';
import { isValidHeroClassKey, slugifyName } from './normalize.js';
import type { WikiHeroBaseStats } from './parseHeroInfobox.js';
import { PROSPECTOR_API_BASE, resolveWorImportCacheDir } from './paths.js';

const MIN_HEROES = 200;
const MIN_ARTIFACTS = 150;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const FACTION_SLUGS: Record<string, FactionKey> = {
  watchguard: 'watchguard',
  'north-throne': 'north_throne',
  'nightmare-council': 'nightmare_council',
  'cursed-cult': 'cursed_cult',
  'infernal-blast': 'infernal_blast',
  'star-piercers': 'star_piercers',
  'esoteria-order': 'esoteria_order',
  'chaos-dominion': 'chaos_dominion',
  'supreme-arbiters': 'supreme_arbiters',
  'the-unnamable': 'unnamable',
};

const HERO_RARITY_SLUGS = new Set<string>(HERO_RARITIES);

const ARTIFACT_RARITY_SLUGS: Record<string, string> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
  mythic: 'mythic',
  generic: 'epic',
};

const DAMAGE_SLUGS: Record<string, string> = {
  magic: 'Magic',
  normal: 'Physical',
  piercing: 'Piercing',
};

const SUMMON_FLAGS: Record<string, 'regular' | 'ancient' | 'limited'> = {
  'normal-summon': 'regular',
  'ancient-exclusive': 'ancient',
  'limited-exclusive': 'limited',
  'special-limited': 'limited',
};

// Fastidious still stores these under misspelled slugs. Same artifact, so don't add a second row.
const FASTIDIOUS_SLUG_ALIASES: Record<string, string> = {
  'blaze-of-talkiel': 'blade-of-talkiel',
  'heart-of-the-mountain': 'heart-of-the-mouintain',
  'aureate-pledge': 'aurate-pledge',
};

export type ProspectorTerm = {
  id: number;
  slug: string;
  name: string;
};

export type ProspectorHeroRecord = {
  id: number;
  slug: string;
  name: string;
  classId: number | null;
  factionIds: number[];
  rarityId: number | null;
  damageId: number | null;
  summonId: number | null;
  isLord: boolean;
  mediaId: number | null;
  stats: WikiHeroBaseStats | null;
};

export type ProspectorArtifactRecord = {
  id: number;
  slug: string;
  name: string;
  classId: number | null;
  rarityId: number | null;
  exclusive: boolean;
  exclusiveHeroId: number | null;
  mediaId: number | null;
};

export type ProspectorSnapshot = {
  heroes: ProspectorHeroRecord[];
  artifacts: ProspectorArtifactRecord[];
  terms: {
    class: ProspectorTerm[];
    faction: ProspectorTerm[];
    rarity: ProspectorTerm[];
    damage: ProspectorTerm[];
    artifactRarity: ProspectorTerm[];
    summon: ProspectorTerm[];
  };
  media: Record<string, string>;
};

export type ProspectorPortraitRefs = {
  heroes: Record<string, string>;
  artifacts: Record<string, string>;
};

export type ProspectorMergeResult = {
  bundle: CatalogBundle;
  portraits: ProspectorPortraitRefs;
  addedHeroes: string[];
  addedArtifacts: string[];
  skipped: string[];
};

type TermIndex = Map<number, ProspectorTerm>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed > 0 ? parsed : null;
  }
  return null;
}

function numberList(value: unknown): number[] {
  if (typeof value === 'number' || typeof value === 'string') {
    const id = positiveId(value);
    return id === null ? [] : [id];
  }
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const entry of value) {
    const id = positiveId(entry);
    if (id !== null) ids.push(id);
  }
  return ids;
}

function decodeWpText(value: string): string {
  const numeric = value
    .replace(/&#(\d+);/g, (_match, digits: string) => codePoint(digits, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => codePoint(hex, 16));
  return decodeHtmlEntities(numeric)
    .replace(/<[^>]+>/g, '')
    .trim();
}

function codePoint(value: string, radix: number): string {
  const code = Number.parseInt(value, radix);
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}

function readTitle(post: Record<string, unknown>): string | null {
  const title = post.title;
  if (typeof title === 'string' && title.trim()) return decodeWpText(title);
  if (isRecord(title) && typeof title.rendered === 'string' && title.rendered.trim()) {
    return decodeWpText(title.rendered);
  }
  return null;
}

function readSlug(post: Record<string, unknown>): string | null {
  if (typeof post.slug !== 'string') return null;
  const slug = post.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

function readStatNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function statsFromProspectorAcf(
  acf: Record<string, unknown> | null,
): WikiHeroBaseStats | null {
  if (!acf) return null;
  const basic = isRecord(acf.basic_attributes) ? acf.basic_attributes : null;
  const advanced = isRecord(acf.advanced_attributes) ? acf.advanced_attributes : null;
  if (!basic && !advanced) return null;
  const stats: WikiHeroBaseStats = {
    hp: readStatNumber(basic?.hero_attribute_hp),
    atk: readStatNumber(basic?.hero_attribute_atk),
    def: readStatNumber(basic?.hero_attribute_def),
    mdef: readStatNumber(basic?.hero_attribute_m_res),
    block: readStatNumber(basic?.hero_attribute_block),
    cost: readStatNumber(basic?.hero_attribute_cost),
    atkInterval: readStatNumber(advanced?.hero_attribute_atk_interval),
    rrAuto: readStatNumber(advanced?.hero_attribute_rage_regen_auto),
    rrAttack: readStatNumber(advanced?.hero_attribute_rage_regen_basic_atk),
    rrAttacked: readStatNumber(advanced?.hero_attribute_rage_regen_attacked),
  };
  if (stats.hp == null || stats.atk == null) return null;
  return stats;
}

function parseHeroStats(value: unknown): WikiHeroBaseStats | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  const stats: WikiHeroBaseStats = {
    hp: readStatNumber(value.hp),
    atk: readStatNumber(value.atk),
    def: readStatNumber(value.def),
    mdef: readStatNumber(value.mdef),
    block: readStatNumber(value.block),
    cost: readStatNumber(value.cost),
    atkInterval: readStatNumber(value.atkInterval),
    rrAuto: readStatNumber(value.rrAuto),
    rrAttack: readStatNumber(value.rrAttack),
    rrAttacked: readStatNumber(value.rrAttacked),
  };
  if (stats.hp == null || stats.atk == null) return null;
  return stats;
}

function firstId(value: unknown): number | null {
  const ids = numberList(value);
  return ids[0] ?? null;
}

export function slimHeroFromWp(post: unknown): ProspectorHeroRecord | null {
  if (!isRecord(post)) return null;
  const id = positiveId(post.id);
  const slug = readSlug(post);
  const name = readTitle(post);
  if (id === null || !slug || !name) return null;
  const acf = isRecord(post.acf) ? post.acf : null;
  const identity = acf && isRecord(acf.identity_group_1) ? acf.identity_group_1 : null;
  const factionSource = identity ? identity.hero_faction : post.faction;
  return {
    id,
    slug,
    name,
    classId: positiveId(identity?.hero_class) ?? firstId(post.class),
    factionIds: numberList(factionSource),
    rarityId: positiveId(identity?.hero_rarity) ?? firstId(post.rarity),
    damageId: positiveId(identity?.hero_dmg_type) ?? firstId(post['dmg-type']),
    summonId:
      positiveId(identity?.hero_summoning_requirement) ?? firstId(post['summoning-requirement']),
    isLord: identity?.is_this_hero_a_lord === true,
    mediaId: positiveId(acf?.portrait_image) ?? positiveId(post.featured_media),
    stats: statsFromProspectorAcf(acf),
  };
}

export function slimArtifactFromWp(post: unknown): ProspectorArtifactRecord | null {
  if (!isRecord(post)) return null;
  const id = positiveId(post.id);
  const slug = readSlug(post);
  const name = readTitle(post);
  if (id === null || !slug || !name) return null;
  const acf = isRecord(post.acf) ? post.acf : null;
  return {
    id,
    slug,
    name,
    classId: positiveId(acf?.artifact_class) ?? firstId(post.class),
    rarityId: positiveId(acf?.artifact_rarity) ?? firstId(post.artifact_rarity),
    exclusive: acf?.artifact_exclusive === true,
    exclusiveHeroId:
      positiveId(acf?.artifact_exclusive_heroes) ?? firstId(acf?.artifact_exclusive_heroes),
    mediaId: positiveId(post.featured_media),
  };
}

function parseTerm(value: unknown): ProspectorTerm | null {
  if (!isRecord(value)) return null;
  const id = positiveId(value.id);
  const slug = readSlug(value);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (id === null || !slug || !name) return null;
  return { id, slug, name };
}

function parseTermList(value: unknown): ProspectorTerm[] | null {
  if (!Array.isArray(value)) return null;
  const terms: ProspectorTerm[] = [];
  for (const entry of value) {
    const term = parseTerm(entry);
    if (!term) return null;
    terms.push(term);
  }
  return terms;
}

function parseHeroRecord(value: unknown): ProspectorHeroRecord | null {
  if (!isRecord(value)) return null;
  const id = positiveId(value.id);
  const slug = readSlug(value);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (id === null || !slug || !name) return null;
  if (!Array.isArray(value.factionIds)) return null;
  return {
    id,
    slug,
    name,
    classId: positiveId(value.classId),
    factionIds: numberList(value.factionIds),
    rarityId: positiveId(value.rarityId),
    damageId: positiveId(value.damageId),
    summonId: positiveId(value.summonId),
    isLord: value.isLord === true,
    mediaId: positiveId(value.mediaId),
    stats: parseHeroStats(value.stats),
  };
}

function parseArtifactRecord(value: unknown): ProspectorArtifactRecord | null {
  if (!isRecord(value)) return null;
  const id = positiveId(value.id);
  const slug = readSlug(value);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (id === null || !slug || !name) return null;
  return {
    id,
    slug,
    name,
    classId: positiveId(value.classId),
    rarityId: positiveId(value.rarityId),
    exclusive: value.exclusive === true,
    exclusiveHeroId: positiveId(value.exclusiveHeroId),
    mediaId: positiveId(value.mediaId),
  };
}

export function parseProspectorSnapshot(value: unknown): ProspectorSnapshot | null {
  if (!isRecord(value) || !isRecord(value.terms) || !isRecord(value.media)) return null;
  if (!Array.isArray(value.heroes) || !Array.isArray(value.artifacts)) return null;
  const heroes: ProspectorHeroRecord[] = [];
  for (const entry of value.heroes) {
    const hero = parseHeroRecord(entry);
    if (!hero) return null;
    heroes.push(hero);
  }
  const artifacts: ProspectorArtifactRecord[] = [];
  for (const entry of value.artifacts) {
    const artifact = parseArtifactRecord(entry);
    if (!artifact) return null;
    artifacts.push(artifact);
  }
  const classTerms = parseTermList(value.terms.class);
  const factionTerms = parseTermList(value.terms.faction);
  const rarityTerms = parseTermList(value.terms.rarity);
  const damageTerms = parseTermList(value.terms.damage);
  const artifactRarityTerms = parseTermList(value.terms.artifactRarity);
  const summonTerms = parseTermList(value.terms.summon);
  if (
    !classTerms ||
    !factionTerms ||
    !rarityTerms ||
    !damageTerms ||
    !artifactRarityTerms ||
    !summonTerms
  ) {
    return null;
  }
  const media: Record<string, string> = {};
  for (const [key, url] of Object.entries(value.media)) {
    if (!/^\d+$/.test(key) || typeof url !== 'string' || !url.startsWith('https://')) return null;
    media[key] = url;
  }
  return {
    heroes,
    artifacts,
    terms: {
      class: classTerms,
      faction: factionTerms,
      rarity: rarityTerms,
      damage: damageTerms,
      artifactRarity: artifactRarityTerms,
      summon: summonTerms,
    },
    media,
  };
}

function termIndex(terms: ProspectorTerm[]): TermIndex {
  return new Map(terms.map((term) => [term.id, term]));
}

function nextDisplayOrder(rows: { display_order?: number }[]): number {
  let max = 0;
  for (const row of rows) {
    if (typeof row.display_order === 'number' && row.display_order > max) max = row.display_order;
  }
  return max + 1;
}

function identityKeys(rows: { slug: string; name: string }[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(row.slug);
    keys.add(slugifyName(decodeHtmlEntities(row.name)));
  }
  return keys;
}

function alreadyPresent(keys: Set<string>, slug: string, name: string): boolean {
  if (keys.has(slug) || keys.has(slugifyName(name))) return true;
  const alias = FASTIDIOUS_SLUG_ALIASES[slug];
  return alias !== undefined && keys.has(alias);
}

function mapFactions(ids: number[], factions: TermIndex): FactionKey[] | null {
  const keys: FactionKey[] = [];
  for (const id of ids) {
    const term = factions.get(id);
    if (!term) return null;
    if (term.slug === 'all-factions') continue;
    const key = FACTION_SLUGS[term.slug];
    if (!key) return null;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

function portraitUrl(media: Record<string, string>, mediaId: number | null): string | null {
  if (mediaId === null) return null;
  return media[String(mediaId)] ?? null;
}

export function mergeProspectorCatalog(
  bundle: CatalogBundle,
  snapshot: ProspectorSnapshot,
): ProspectorMergeResult {
  const classes = termIndex(snapshot.terms.class);
  const factions = termIndex(snapshot.terms.faction);
  const rarities = termIndex(snapshot.terms.rarity);
  const damages = termIndex(snapshot.terms.damage);
  const artifactRarities = termIndex(snapshot.terms.artifactRarity);
  const summons = termIndex(snapshot.terms.summon);
  const heroIdToSlug = new Map(snapshot.heroes.map((hero) => [hero.id, hero.slug]));
  const skipped: string[] = [];
  const addedHeroes: string[] = [];
  const addedArtifacts: string[] = [];
  const portraits: ProspectorPortraitRefs = { heroes: {}, artifacts: {} };

  const heroKeys = identityKeys(bundle.heroes);
  let heroOrder = nextDisplayOrder(bundle.heroes);
  const heroes = [...bundle.heroes];
  for (const hero of snapshot.heroes) {
    if (alreadyPresent(heroKeys, hero.slug, hero.name)) continue;
    const classTerm = hero.classId === null ? undefined : classes.get(hero.classId);
    if (!classTerm || !isValidHeroClassKey(classTerm.slug)) {
      skipped.push(`Skipped hero ${hero.slug}: unknown class.`);
      continue;
    }
    const factionKeys = mapFactions(hero.factionIds, factions);
    if (factionKeys === null) {
      skipped.push(`Skipped hero ${hero.slug}: unknown faction.`);
      continue;
    }
    const rarityTerm = hero.rarityId === null ? undefined : rarities.get(hero.rarityId);
    const rarity = rarityTerm?.slug ?? '';
    if (!HERO_RARITY_SLUGS.has(rarity)) {
      skipped.push(`Skipped hero ${hero.slug}: unknown rarity.`);
      continue;
    }
    const damageTerm = hero.damageId === null ? undefined : damages.get(hero.damageId);
    const summonTerm = hero.summonId === null ? undefined : summons.get(hero.summonId);
    const summon = summonTerm ? SUMMON_FLAGS[summonTerm.slug] : undefined;
    const row: CatalogHeroRow = {
      slug: hero.slug,
      name: hero.name,
      class: classTerm.slug,
      faction: factionKeys[0] ?? 'unaffiliated',
      faction_secondary: factionKeys[1] ?? null,
      rarity,
      damage_type: damageTerm ? (DAMAGE_SLUGS[damageTerm.slug] ?? null) : null,
      is_lord: hero.isLord ? 1 : 0,
      is_regular: summon === 'regular' ? 1 : 0,
      is_ancient: summon === 'ancient' ? 1 : 0,
      is_limited: summon === 'limited' ? 1 : 0,
      reference_tier: null,
      display_order: heroOrder,
      active: 1,
    };
    heroOrder += 1;
    heroes.push(row);
    heroKeys.add(row.slug);
    heroKeys.add(slugifyName(row.name));
    addedHeroes.push(row.slug);
    const url = portraitUrl(snapshot.media, hero.mediaId);
    if (url) portraits.heroes[row.slug] = url;
  }

  const artifactKeys = identityKeys(bundle.artifacts);
  const catalogHeroSlugs = new Set(heroes.map((hero) => hero.slug));
  let artifactOrder = nextDisplayOrder(bundle.artifacts);
  const artifacts = [...bundle.artifacts];
  for (const artifact of snapshot.artifacts) {
    if (alreadyPresent(artifactKeys, artifact.slug, artifact.name)) continue;
    const classTerm = artifact.classId === null ? undefined : classes.get(artifact.classId);
    let artifactClass: string | null = null;
    if (classTerm && classTerm.slug !== 'generic') {
      if (!isValidHeroClassKey(classTerm.slug)) {
        skipped.push(`Skipped artifact ${artifact.slug}: unknown class.`);
        continue;
      }
      artifactClass = classTerm.slug;
    }
    const rarityTerm =
      artifact.rarityId === null ? undefined : artifactRarities.get(artifact.rarityId);
    const rarity = rarityTerm ? ARTIFACT_RARITY_SLUGS[rarityTerm.slug] : undefined;
    if (!rarity) {
      skipped.push(`Skipped artifact ${artifact.slug}: unknown rarity.`);
      continue;
    }
    const linkedHeroSlug = artifact.exclusiveHeroId
      ? (heroIdToSlug.get(artifact.exclusiveHeroId) ?? null)
      : null;
    const exclusiveHeroSlug =
      linkedHeroSlug && catalogHeroSlugs.has(linkedHeroSlug) ? linkedHeroSlug : null;
    const row: CatalogArtifactRow = {
      slug: artifact.slug,
      name: artifact.name,
      class: artifactClass,
      rarity,
      exclusive_hero_slug: exclusiveHeroSlug,
      is_universal: artifact.exclusive || exclusiveHeroSlug ? 0 : 1,
      reference_tier: null,
      display_order: artifactOrder,
      active: 1,
    };
    artifactOrder += 1;
    artifacts.push(row);
    artifactKeys.add(row.slug);
    artifactKeys.add(slugifyName(row.name));
    addedArtifacts.push(row.slug);
    const url = portraitUrl(snapshot.media, artifact.mediaId);
    if (url) portraits.artifacts[row.slug] = url;
  }

  return {
    bundle: { heroes, artifacts, demons: bundle.demons },
    portraits,
    addedHeroes,
    addedArtifacts,
    skipped,
  };
}

function prospectorUserAgent(): string {
  return process.env.WOR_PROSPECTOR_USER_AGENT?.trim() || 'CodexWoRImport/1.0';
}

async function fetchWpJson(url: URL): Promise<{ body: unknown; totalPages: number }> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': prospectorUserAgent(),
        Accept: 'application/json',
      },
    },
    FETCH_TIMEOUT_MS.htmlPage,
  );
  if (!response.ok) {
    throw new Error(`Prospector fetch failed (${response.status}) for ${url.pathname}`);
  }
  const headerPages = Number(response.headers.get('x-wp-totalpages'));
  return {
    body: await response.json(),
    totalPages: Number.isFinite(headerPages) && headerPages > 0 ? headerPages : 1,
  };
}

async function fetchCollection(route: string, fields: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= MAX_PAGES) {
    const url = new URL(`${PROSPECTOR_API_BASE}/${route}`);
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    url.searchParams.set('_fields', fields);
    const { body, totalPages: reportedPages } = await fetchWpJson(url);
    if (!Array.isArray(body)) {
      throw new Error(`Prospector ${route} did not return a list.`);
    }
    totalPages = reportedPages;
    rows.push(...body);
    if (body.length === 0) break;
    page += 1;
    if (page <= totalPages) await sleep(300);
  }
  return rows;
}

async function fetchTerms(route: string): Promise<ProspectorTerm[]> {
  const rows = await fetchCollection(route, 'id,name,slug');
  const terms: ProspectorTerm[] = [];
  for (const row of rows) {
    const term = parseTerm(row);
    if (!term) throw new Error(`Prospector term ${route} is missing id, slug, or name.`);
    terms.push(term);
  }
  return terms;
}

async function fetchMediaUrls(ids: number[]): Promise<Record<string, string>> {
  const media: Record<string, string> = {};
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += PAGE_SIZE) {
    const chunk = unique.slice(offset, offset + PAGE_SIZE);
    if (chunk.length === 0) continue;
    const url = new URL(`${PROSPECTOR_API_BASE}/media`);
    url.searchParams.set('include', chunk.join(','));
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('_fields', 'id,source_url');
    const { body } = await fetchWpJson(url);
    if (!Array.isArray(body)) throw new Error('Prospector media did not return a list.');
    for (const entry of body) {
      if (!isRecord(entry)) continue;
      const id = positiveId(entry.id);
      if (id === null || typeof entry.source_url !== 'string') continue;
      try {
        assertTrustedImageUrl(entry.source_url);
      } catch {
        continue;
      }
      media[String(id)] = entry.source_url;
    }
    if (offset + PAGE_SIZE < unique.length) await sleep(300);
  }
  return media;
}

async function fetchProspectorSnapshot(
  onLog?: (message: string) => void,
): Promise<ProspectorSnapshot> {
  onLog?.('Fetching Prospector taxonomies…');
  const [classTerms, factionTerms, rarityTerms, damageTerms, artifactRarityTerms, summonTerms] =
    await Promise.all([
      fetchTerms('class'),
      fetchTerms('faction'),
      fetchTerms('rarity'),
      fetchTerms('dmg-type'),
      fetchTerms('artifact_rarity'),
      fetchTerms('summoning-requirement'),
    ]);

  onLog?.('Fetching Prospector heroes…');
  const heroPosts = await fetchCollection(
    'hero',
    'id,slug,title,featured_media,class,faction,rarity,dmg-type,summoning-requirement,acf',
  );
  const heroes: ProspectorHeroRecord[] = [];
  for (const post of heroPosts) {
    const hero = slimHeroFromWp(post);
    if (hero) heroes.push(hero);
  }

  onLog?.('Fetching Prospector artifacts…');
  const artifactPosts = await fetchCollection(
    'artifact',
    'id,slug,title,featured_media,class,artifact_rarity,acf',
  );
  const artifacts: ProspectorArtifactRecord[] = [];
  for (const post of artifactPosts) {
    const artifact = slimArtifactFromWp(post);
    if (artifact) artifacts.push(artifact);
  }

  if (heroes.length < MIN_HEROES || artifacts.length < MIN_ARTIFACTS) {
    throw new Error(
      `Prospector snapshot too small (${heroes.length} heroes, ${artifacts.length} artifacts).`,
    );
  }

  onLog?.('Fetching Prospector portrait URLs…');
  const media = await fetchMediaUrls(
    [...heroes, ...artifacts].flatMap((entry) => (entry.mediaId === null ? [] : [entry.mediaId])),
  );

  return {
    heroes,
    artifacts,
    terms: {
      class: classTerms,
      faction: factionTerms,
      rarity: rarityTerms,
      damage: damageTerms,
      artifactRarity: artifactRarityTerms,
      summon: summonTerms,
    },
    media,
  };
}

export function prospectorCachePath(cacheDir: string): string {
  return path.join(cacheDir, 'prospector.json');
}

export type ProspectorHeroStatsFillSummary = {
  updated: number;
  missing: number;
};

export function fillMissingHeroStatsFromProspector(
  db: Database.Database,
  snapshot: ProspectorSnapshot,
  onLog?: (message: string) => void,
): ProspectorHeroStatsFillSummary {
  const bySlug = new Map(
    snapshot.heroes
      .filter((hero) => hero.stats !== null)
      .map((hero) => [hero.slug, hero.stats as WikiHeroBaseStats]),
  );
  const rows = db
    .prepare(
      `SELECT slug FROM catalog_heroes
       WHERE active = 1 AND (base_hp IS NULL OR base_atk IS NULL)
       ORDER BY display_order ASC, name ASC`,
    )
    .all() as { slug: string }[];

  const summary: ProspectorHeroStatsFillSummary = {
    updated: 0,
    missing: 0,
  };
  if (rows.length === 0) {
    onLog?.('No active heroes are missing base_hp/base_atk.');
    return summary;
  }

  onLog?.(`Filling missing combat stats for ${rows.length} heroes from Prospector…`);
  for (const row of rows) {
    const stats = bySlug.get(row.slug);
    if (!stats) {
      summary.missing += 1;
      continue;
    }
    applyHeroBaseStats(db, row.slug, stats);
    summary.updated += 1;
  }
  onLog?.(`Prospector stats fill: ${summary.updated} updated, ${summary.missing} still missing.`);
  return summary;
}

export async function loadProspectorCatalog(options?: {
  live?: boolean;
  cacheDir?: string;
  onLog?: (message: string) => void;
}): Promise<ProspectorSnapshot | null> {
  const cacheDir = options?.cacheDir ?? resolveWorImportCacheDir();
  const cachePath = prospectorCachePath(cacheDir);
  const onLog = options?.onLog;
  const readCache = (): ProspectorSnapshot | null => {
    if (!fs.existsSync(cachePath)) return null;
    try {
      return parseProspectorSnapshot(JSON.parse(fs.readFileSync(cachePath, 'utf8')));
    } catch {
      onLog?.('Prospector cache could not be read.');
      return null;
    }
  };

  if (!options?.live) return readCache();

  try {
    const snapshot = await fetchProspectorSnapshot(onLog);
    const parsed = parseProspectorSnapshot(snapshot);
    if (!parsed) throw new Error('Prospector snapshot failed validation.');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    onLog?.(
      `Cached ${parsed.heroes.length} Prospector heroes and ${parsed.artifacts.length} artifacts.`,
    );
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cached = readCache();
    onLog?.(
      cached
        ? `Prospector fetch failed (${message}). Using the cached snapshot.`
        : `Prospector fetch failed (${message}).`,
    );
    return cached;
  }
}

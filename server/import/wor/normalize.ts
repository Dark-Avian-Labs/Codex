import {
  ARTIFACT_RARITIES,
  DEMON_RARITIES,
  FACTIONS,
  HERO_CLASSES,
  HERO_RARITIES,
  type ArtifactRarityKey,
  type DemonRarityKey,
  type FactionKey,
  type HeroClassKey,
  type HeroRarityKey,
} from '@codex/game-wor';

const FACTION_NAME_TO_KEY: Record<string, FactionKey> = {
  Watchguard: 'watchguard',
  'North Throne': 'north_throne',
  'Nightmare Council': 'nightmare_council',
  'Cursed Cult': 'cursed_cult',
  'Infernal Blast': 'infernal_blast',
  'Star Piercers': 'star_piercers',
  'Esoteria Order': 'esoteria_order',
  'Chaos Dominion': 'chaos_dominion',
  'Supreme Arbiters': 'supreme_arbiters',
  Unnamable: 'unnamable',
};

const RARITY_NAME_TO_KEY: Record<string, string> = {
  Common: 'common',
  Uncommon: 'uncommon',
  Rare: 'rare',
  Epic: 'epic',
  Legendary: 'legendary',
  Mythic: 'mythic',
  Captain: 'captain',
};

export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function wikiPageTitleFromName(name: string): string {
  return name.replace(/ /g, '_');
}

export function normalizeFactionName(name: string): FactionKey {
  const key = FACTION_NAME_TO_KEY[name.trim()];
  if (!key) {
    throw new Error(`Unknown faction name: ${name}`);
  }
  return key;
}

export function normalizeHeroClass(name: string): HeroClassKey {
  const value = name.trim().toLowerCase() as HeroClassKey;
  if (!(HERO_CLASSES as readonly string[]).includes(value)) {
    throw new Error(`Unknown hero class: ${name}`);
  }
  return value;
}

export function normalizeHeroRarity(name: string): HeroRarityKey {
  const key = RARITY_NAME_TO_KEY[name.trim()] as HeroRarityKey | undefined;
  if (!key || !(HERO_RARITIES as readonly string[]).includes(key)) {
    throw new Error(`Unknown hero rarity: ${name}`);
  }
  return key;
}

export function normalizeArtifactRarity(name: string): ArtifactRarityKey {
  const key = RARITY_NAME_TO_KEY[name.trim()] as ArtifactRarityKey | undefined;
  if (!key || !(ARTIFACT_RARITIES as readonly string[]).includes(key)) {
    throw new Error(`Unknown artifact rarity: ${name}`);
  }
  return key;
}

export function normalizeDemonRarity(name: string): DemonRarityKey {
  const trimmed = name.trim();
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  const key = (RARITY_NAME_TO_KEY[trimmed] ?? RARITY_NAME_TO_KEY[titleCase]) as
    | DemonRarityKey
    | undefined;
  if (!key || !(DEMON_RARITIES as readonly string[]).includes(key)) {
    throw new Error(`Unknown demon rarity: ${name}`);
  }
  return key;
}

export function normalizeDamageType(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'normal') return 'Physical';
  return trimmed;
}

export function normalizeDemonFactionGroup(
  faction: { name: string; slug: string } | null | undefined,
): string | null {
  if (!faction) return null;
  return faction.slug || slugifyName(faction.name);
}

export function isValidFactionKey(value: string): value is FactionKey {
  return (FACTIONS as readonly string[]).includes(value);
}

export function isValidHeroClassKey(value: string): value is HeroClassKey {
  return (HERO_CLASSES as readonly string[]).includes(value);
}

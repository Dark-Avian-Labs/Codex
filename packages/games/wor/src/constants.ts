export const HERO_CLASSES = [
  'fighter',
  'mage',
  'marksman',
  'defender',
  'healer',
  'tactician',
] as const;
export type HeroClassKey = (typeof HERO_CLASSES)[number];

export const FACTIONS = [
  'watchguard',
  'north_throne',
  'nightmare_council',
  'cursed_cult',
  'infernal_blast',
  'star_piercers',
  'esoteria_order',
  'chaos_dominion',
  'supreme_arbiters',
  'unnamable',
] as const;
export type FactionKey = (typeof FACTIONS)[number];

export const HERO_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type HeroRarityKey = (typeof HERO_RARITIES)[number];

export const ARTIFACT_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
] as const;
export type ArtifactRarityKey = (typeof ARTIFACT_RARITIES)[number];

export const DEMON_RARITIES = ['rare', 'epic', 'legendary', 'captain'] as const;
export type DemonRarityKey = (typeof DEMON_RARITIES)[number];

export const RARITY_STAR_COUNTS: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6,
  captain: 5,
};

export function rarityToStarRating(rarity: string): number {
  return RARITY_STAR_COUNTS[rarity] ?? 3;
}

export const HERO_AWAKENING_MAX = 5;
export const ARTIFACT_PROMOTION_MAX = 5;

export const ARTIFACT_GAUGE_FILLED = '▰';
export const ARTIFACT_GAUGE_EMPTY = '▱';

export const GAUGE_COLORS: Record<number, string> = {
  0: '#6b7280',
  1: '#3b82f6',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
};

export const HERO_AWAKENING_LABELS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const;

export const CLASS_DISPLAY_NAMES: Record<HeroClassKey, string> = {
  fighter: 'Fighter',
  mage: 'Mage',
  marksman: 'Marksman',
  defender: 'Defender',
  healer: 'Healer',
  tactician: 'Tactician',
};

export const FACTION_DISPLAY_NAMES: Record<FactionKey, string> = {
  watchguard: 'Watchguard',
  north_throne: 'North Throne',
  nightmare_council: 'Nightmare Council',
  cursed_cult: 'Cursed Cult',
  infernal_blast: 'Infernal Blast',
  star_piercers: 'Star Piercers',
  esoteria_order: 'Esoteria Order',
  chaos_dominion: 'Chaos Dominion',
  supreme_arbiters: 'Supreme Arbiters',
  unnamable: 'Unnamable',
};

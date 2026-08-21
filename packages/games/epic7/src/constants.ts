export const HERO_CLASSES = ['warrior', 'knight', 'thief', 'ranger', 'mage', 'soulweaver'] as const;
export type HeroClassKey = (typeof HERO_CLASSES)[number];
export const ARTIFACT_CLASSES = [...HERO_CLASSES, 'universal'] as const;
export const ELEMENTS = ['fire', 'ice', 'earth', 'light', 'dark'] as const;

export type ClassKey = (typeof ARTIFACT_CLASSES)[number];
export type ElementKey = (typeof ELEMENTS)[number];
export const HERO_RATINGS = ['-', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
export type HeroRating = (typeof HERO_RATINGS)[number];
export const ARTIFACT_GAUGE_MAX = 5;
export const ARTIFACT_GAUGE_FILLED = '▰';
export const ARTIFACT_GAUGE_EMPTY = '▱';
export const STAR_RATINGS = [3, 4, 5] as const;

export const CLASS_DISPLAY_NAMES: Record<HeroClassKey | 'universal', string> = {
  knight: 'Knight',
  warrior: 'Warrior',
  thief: 'Thief',
  ranger: 'Ranger',
  mage: 'Mage',
  soulweaver: 'Soul Weaver',
  universal: 'Universal',
};

export const ELEMENT_DISPLAY_NAMES: Record<ElementKey, string> = {
  fire: 'Fire',
  ice: 'Ice',
  earth: 'Earth',
  light: 'Light',
  dark: 'Dark',
};

export const RATING_COLORS: Record<HeroRating, string> = {
  '-': 'var(--color-rarity-gray)',
  D: 'var(--color-rarity-teal)',
  C: 'var(--color-rarity-green)',
  B: 'var(--color-rarity-blue)',
  A: 'var(--color-rarity-purple)',
  S: 'var(--color-rarity-gold)',
  SS: 'var(--color-rarity-orange)',
  SSS: 'var(--color-rarity-red)',
};

export const GAUGE_COLORS: Record<number, string> = {
  0: 'var(--color-rarity-gray)',
  1: 'var(--color-rarity-blue)',
  2: 'var(--color-rarity-green)',
  3: 'var(--color-rarity-gold)',
  4: 'var(--color-rarity-orange)',
  5: 'var(--color-rarity-red)',
};

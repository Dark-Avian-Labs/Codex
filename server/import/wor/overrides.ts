import fs from 'node:fs';

import type {
  CatalogArtifactRow,
  CatalogBundle,
  CatalogDemonRow,
  CatalogHeroRow,
} from './catalogQueries.js';
import { WOR_OVERRIDES_PATH } from './paths.js';

type WorOverridesFile = {
  heroes?: Record<string, Partial<CatalogHeroRow>>;
  artifacts?: Record<string, Partial<CatalogArtifactRow>>;
  demons?: Record<string, Partial<CatalogDemonRow>>;
};

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function nextDisplayOrder(rows: { display_order?: number }[]): number {
  let max = -1;
  for (const row of rows) {
    if (typeof row.display_order === 'number' && row.display_order > max) {
      max = row.display_order;
    }
  }
  return max + 1;
}

function requireHeroFields(
  slug: string,
  override: Partial<CatalogHeroRow>,
): asserts override is Pick<CatalogHeroRow, 'name' | 'class' | 'faction' | 'rarity'> &
  Partial<CatalogHeroRow> {
  for (const field of ['name', 'class', 'faction', 'rarity'] as const) {
    if (typeof override[field] !== 'string' || !override[field]?.trim()) {
      throw new Error(
        `WoR override add for hero "${slug}" requires ${field} (hero is missing from Fastidious catalog).`,
      );
    }
  }
}

function requireArtifactFields(
  slug: string,
  override: Partial<CatalogArtifactRow>,
): asserts override is Pick<CatalogArtifactRow, 'name' | 'rarity'> & Partial<CatalogArtifactRow> {
  for (const field of ['name', 'rarity'] as const) {
    if (typeof override[field] !== 'string' || !override[field]?.trim()) {
      throw new Error(
        `WoR override add for artifact "${slug}" requires ${field} (artifact is missing from Fastidious catalog).`,
      );
    }
  }
}

function requireDemonFields(
  slug: string,
  override: Partial<CatalogDemonRow>,
): asserts override is Pick<CatalogDemonRow, 'name' | 'rarity'> & Partial<CatalogDemonRow> {
  for (const field of ['name', 'rarity'] as const) {
    if (typeof override[field] !== 'string' || !override[field]?.trim()) {
      throw new Error(
        `WoR override add for demon "${slug}" requires ${field} (demon is missing from Fastidious catalog).`,
      );
    }
  }
}

function applyEntityOverrides<T extends { slug: string; display_order?: number }>(
  rows: T[],
  overrides: Record<string, Partial<T>> | undefined,
  buildAdded: (slug: string, override: Partial<T>, displayOrder: number) => T,
): T[] {
  if (!overrides) return rows;

  const existingSlugs = new Set(rows.map((row) => row.slug));
  const patched = rows.map((row) => ({
    ...row,
    ...overrides[row.slug],
  }));

  let displayOrder = nextDisplayOrder(patched);
  const added: T[] = [];
  for (const [slug, override] of Object.entries(overrides)) {
    if (existingSlugs.has(slug)) continue;
    added.push(buildAdded(slug, override, displayOrder));
    displayOrder += 1;
  }

  return [...patched, ...added];
}

export function applyWorOverrides(
  bundle: CatalogBundle,
  overridesPath = WOR_OVERRIDES_PATH,
): CatalogBundle {
  if (!fs.existsSync(overridesPath)) return bundle;
  const overrides = readJsonFile<WorOverridesFile>(overridesPath);

  const heroes = applyEntityOverrides(bundle.heroes, overrides.heroes, (slug, override, order) => {
    requireHeroFields(slug, override);
    return {
      slug,
      name: override.name,
      class: override.class,
      faction: override.faction,
      rarity: override.rarity,
      damage_type: override.damage_type ?? null,
      is_lord: override.is_lord ?? 0,
      reference_tier: override.reference_tier ?? null,
      portrait_path: override.portrait_path ?? null,
      display_order: override.display_order ?? order,
      active: override.active ?? 1,
    };
  });

  const artifacts = applyEntityOverrides(
    bundle.artifacts,
    overrides.artifacts,
    (slug, override, order) => {
      requireArtifactFields(slug, override);
      return {
        slug,
        name: override.name,
        class: override.class ?? null,
        rarity: override.rarity,
        exclusive_hero_slug: override.exclusive_hero_slug ?? null,
        is_universal: override.is_universal ?? (override.exclusive_hero_slug ? 0 : 1),
        reference_tier: override.reference_tier ?? null,
        portrait_path: override.portrait_path ?? null,
        display_order: override.display_order ?? order,
        active: override.active ?? 1,
      };
    },
  );

  const demons = applyEntityOverrides(bundle.demons, overrides.demons, (slug, override, order) => {
    requireDemonFields(slug, override);
    return {
      slug,
      name: override.name,
      rarity: override.rarity,
      faction_group: override.faction_group ?? null,
      max_level: override.max_level ?? 5,
      portrait_path: override.portrait_path ?? null,
      display_order: override.display_order ?? order,
      active: override.active ?? 1,
    };
  });

  return { heroes, artifacts, demons };
}

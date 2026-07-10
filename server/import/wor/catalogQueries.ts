import { rarityToStarRating } from '@codex/game-wor';
import type Database from 'better-sqlite3';

export type CatalogHeroRow = {
  slug: string;
  name: string;
  class: string;
  faction: string;
  rarity: string;
  damage_type?: string | null;
  is_lord?: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
  display_order?: number;
  active?: number;
};

export type CatalogArtifactRow = {
  slug: string;
  name: string;
  class?: string | null;
  rarity: string;
  exclusive_hero_slug?: string | null;
  is_universal?: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
  display_order?: number;
  active?: number;
};

export type CatalogDemonRow = {
  slug: string;
  name: string;
  rarity: string;
  faction_group?: string | null;
  max_level?: number;
  portrait_path?: string | null;
  display_order?: number;
  active?: number;
};

export type CatalogBundle = {
  heroes: CatalogHeroRow[];
  artifacts: CatalogArtifactRow[];
  demons: CatalogDemonRow[];
};

export function upsertCatalogHeroes(db: Database.Database, heroes: CatalogHeroRow[]): number {
  const stmt = db.prepare(`
    INSERT INTO catalog_heroes (
      slug, name, class, faction, rarity, star_rating, damage_type, is_lord,
      reference_tier, portrait_path, display_order, active
    ) VALUES (
      @slug, @name, @class, @faction, @rarity, @star_rating, @damage_type, @is_lord,
      @reference_tier, @portrait_path, @display_order, @active
    )
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      class = excluded.class,
      faction = excluded.faction,
      rarity = excluded.rarity,
      star_rating = excluded.star_rating,
      damage_type = excluded.damage_type,
      is_lord = excluded.is_lord,
      reference_tier = excluded.reference_tier,
      portrait_path = COALESCE(excluded.portrait_path, catalog_heroes.portrait_path),
      display_order = excluded.display_order,
      active = excluded.active
  `);
  let count = 0;
  const transaction = db.transaction(() => {
    for (const hero of heroes) {
      stmt.run({
        slug: hero.slug,
        name: hero.name,
        class: hero.class,
        faction: hero.faction,
        rarity: hero.rarity,
        star_rating: rarityToStarRating(hero.rarity),
        damage_type: hero.damage_type ?? null,
        is_lord: hero.is_lord ?? 0,
        reference_tier: hero.reference_tier ?? null,
        portrait_path: hero.portrait_path ?? null,
        display_order: hero.display_order ?? 0,
        active: hero.active ?? 1,
      });
      count += 1;
    }
  });
  transaction();
  return count;
}

export function upsertCatalogArtifacts(
  db: Database.Database,
  artifacts: CatalogArtifactRow[],
): number {
  const stmt = db.prepare(`
    INSERT INTO catalog_artifacts (
      slug, name, class, rarity, star_rating, exclusive_hero_slug, is_universal,
      reference_tier, portrait_path, display_order, active
    ) VALUES (
      @slug, @name, @class, @rarity, @star_rating, @exclusive_hero_slug, @is_universal,
      @reference_tier, @portrait_path, @display_order, @active
    )
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      class = excluded.class,
      rarity = excluded.rarity,
      star_rating = excluded.star_rating,
      exclusive_hero_slug = excluded.exclusive_hero_slug,
      is_universal = excluded.is_universal,
      reference_tier = excluded.reference_tier,
      portrait_path = COALESCE(excluded.portrait_path, catalog_artifacts.portrait_path),
      display_order = excluded.display_order,
      active = excluded.active
  `);
  let count = 0;
  const transaction = db.transaction(() => {
    for (const artifact of artifacts) {
      stmt.run({
        slug: artifact.slug,
        name: artifact.name,
        class: artifact.class ?? null,
        rarity: artifact.rarity,
        star_rating: rarityToStarRating(artifact.rarity),
        exclusive_hero_slug: artifact.exclusive_hero_slug ?? null,
        is_universal: artifact.is_universal ?? 1,
        reference_tier: artifact.reference_tier ?? null,
        portrait_path: artifact.portrait_path ?? null,
        display_order: artifact.display_order ?? 0,
        active: artifact.active ?? 1,
      });
      count += 1;
    }
  });
  transaction();
  return count;
}

export function upsertCatalogDemons(db: Database.Database, demons: CatalogDemonRow[]): number {
  const stmt = db.prepare(`
    INSERT INTO catalog_demons (
      slug, name, rarity, star_rating, faction_group, max_level, portrait_path, display_order, active
    ) VALUES (
      @slug, @name, @rarity, @star_rating, @faction_group, @max_level, @portrait_path, @display_order, @active
    )
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      rarity = excluded.rarity,
      star_rating = excluded.star_rating,
      faction_group = excluded.faction_group,
      max_level = excluded.max_level,
      portrait_path = COALESCE(excluded.portrait_path, catalog_demons.portrait_path),
      display_order = excluded.display_order,
      active = excluded.active
  `);
  let count = 0;
  const transaction = db.transaction(() => {
    for (const demon of demons) {
      stmt.run({
        slug: demon.slug,
        name: demon.name,
        rarity: demon.rarity,
        star_rating: rarityToStarRating(demon.rarity),
        faction_group: demon.faction_group ?? null,
        max_level: demon.max_level ?? 5,
        portrait_path: demon.portrait_path ?? null,
        display_order: demon.display_order ?? 0,
        active: demon.active ?? 1,
      });
      count += 1;
    }
  });
  transaction();
  return count;
}

export function bumpCatalogVersion(db: Database.Database): void {
  db.prepare(
    `UPDATE catalog_meta SET catalog_version = catalog_version + 1, last_import_at = datetime('now') WHERE id = 1`,
  ).run();
}

export function getCatalogCounts(db: Database.Database): {
  heroes: number;
  artifacts: number;
  demons: number;
} {
  const heroes = (
    db.prepare('SELECT COUNT(*) as c FROM catalog_heroes WHERE active = 1').get() as { c: number }
  ).c;
  const artifacts = (
    db.prepare('SELECT COUNT(*) as c FROM catalog_artifacts WHERE active = 1').get() as {
      c: number;
    }
  ).c;
  const demons = (
    db.prepare('SELECT COUNT(*) as c FROM catalog_demons WHERE active = 1').get() as { c: number }
  ).c;
  return { heroes, artifacts, demons };
}

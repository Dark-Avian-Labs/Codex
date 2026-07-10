import Database from 'better-sqlite3';

import { ARTIFACT_PROMOTION_MAX, HERO_AWAKENING_MAX, HERO_CLASSES, FACTIONS } from '../config.js';

export interface GameAccount {
  id: number;
  account_name: string;
  is_active: number;
  created_at?: string;
}

export interface AccountHero {
  id: number;
  catalog_hero_slug: string | null;
  name: string;
  class: string;
  faction: string;
  rarity: string;
  star_rating: number;
  owned: number;
  gauge_level: number;
  display_order: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
}

export interface AccountArtifact {
  id: number;
  catalog_artifact_slug: string | null;
  name: string;
  class?: string | null;
  rarity: string;
  star_rating: number;
  owned: number;
  gauge_level: number;
  display_order: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
  exclusive_hero_slug?: string | null;
  exclusive_hero_name?: string | null;
  exclusive_hero_portrait?: string | null;
  is_universal?: number;
}

export interface AccountDemon {
  id: number;
  catalog_demon_slug: string | null;
  name: string;
  rarity: string;
  star_rating: number;
  owned: number;
  gauge_level: number;
  display_order: number;
  max_level: number;
  portrait_path?: string | null;
}

const heroClasses = HERO_CLASSES as readonly string[];
const factions = FACTIONS as readonly string[];

function isValidHeroGauge(level: number): boolean {
  return Number.isInteger(level) && level >= 0 && level <= HERO_AWAKENING_MAX;
}

function isValidArtifactGauge(level: number): boolean {
  return Number.isInteger(level) && level >= 0 && level <= ARTIFACT_PROMOTION_MAX;
}

export function getGameAccountsByUserId(db: Database.Database, clerkUserId: string): GameAccount[] {
  return db
    .prepare(
      'SELECT id, account_name, is_active, created_at FROM game_accounts WHERE clerk_user_id = ? ORDER BY is_active DESC, id ASC',
    )
    .all(clerkUserId) as GameAccount[];
}

export function getGameAccountByIdAndUser(
  db: Database.Database,
  accountId: number,
  clerkUserId: string,
): { id: number; account_name: string } | undefined {
  return db
    .prepare('SELECT id, account_name FROM game_accounts WHERE id = ? AND clerk_user_id = ?')
    .get(accountId, clerkUserId) as { id: number; account_name: string } | undefined;
}

export function setActiveAccount(
  db: Database.Database,
  clerkUserId: string,
  accountId: number,
): void {
  const transaction = db.transaction(() => {
    const exists = db
      .prepare('SELECT id FROM game_accounts WHERE id = ? AND clerk_user_id = ?')
      .get(accountId, clerkUserId);
    if (!exists) throw new Error('Account not found or does not belong to user');
    db.prepare('UPDATE game_accounts SET is_active = 0 WHERE clerk_user_id = ?').run(clerkUserId);
    const r = db
      .prepare('UPDATE game_accounts SET is_active = 1 WHERE id = ? AND clerk_user_id = ?')
      .run(accountId, clerkUserId);
    if (r.changes === 0) throw new Error('Failed to set active account');
  });
  transaction();
}

export function createGameAccount(
  db: Database.Database,
  clerkUserId: string,
  accountName: string,
  isFirst: boolean,
): number {
  const r = db
    .prepare('INSERT INTO game_accounts (clerk_user_id, account_name, is_active) VALUES (?, ?, ?)')
    .run(clerkUserId, accountName, isFirst ? 1 : 0);
  const accountId = Number(r.lastInsertRowid);
  seedAccountFromCatalog(db, accountId);
  return accountId;
}

export function getAccountByNameAndUser(
  db: Database.Database,
  clerkUserId: string,
  name: string,
): { id: number } | undefined {
  return db
    .prepare('SELECT id FROM game_accounts WHERE clerk_user_id = ? AND account_name = ?')
    .get(clerkUserId, name) as { id: number } | undefined;
}

export function deleteGameAccount(
  db: Database.Database,
  accountId: number,
  clerkUserId: string,
): boolean {
  const r = db
    .prepare('DELETE FROM game_accounts WHERE id = ? AND clerk_user_id = ?')
    .run(accountId, clerkUserId);
  return r.changes > 0;
}

export function updateGameAccountName(
  db: Database.Database,
  accountId: number,
  clerkUserId: string,
  accountName: string,
): boolean {
  const r = db
    .prepare('UPDATE game_accounts SET account_name = ? WHERE id = ? AND clerk_user_id = ?')
    .run(accountName, accountId, clerkUserId);
  return r.changes > 0;
}

export function getUserAccountsForApi(db: Database.Database, clerkUserId: string) {
  return db
    .prepare(
      'SELECT id, account_name, is_active, created_at FROM game_accounts WHERE clerk_user_id = ? ORDER BY created_at ASC',
    )
    .all(clerkUserId) as {
    id: number;
    account_name: string;
    is_active: number;
    created_at: string;
  }[];
}

export function seedAccountFromCatalog(db: Database.Database, accountId: number): void {
  db.prepare(
    `
    INSERT INTO account_heroes (account_id, catalog_hero_slug, name, class, faction, rarity, star_rating, owned, gauge_level, display_order)
    SELECT ?, slug, name, class, faction, rarity, star_rating, 0, 0, display_order FROM catalog_heroes
    WHERE active = 1 AND NOT EXISTS (
      SELECT 1 FROM account_heroes ah WHERE ah.account_id = ? AND ah.catalog_hero_slug = catalog_heroes.slug
    )
  `,
  ).run(accountId, accountId);

  db.prepare(
    `
    INSERT INTO account_artifacts (account_id, catalog_artifact_slug, name, rarity, star_rating, owned, gauge_level, display_order)
    SELECT ?, slug, name, rarity, star_rating, 0, 0, display_order FROM catalog_artifacts
    WHERE active = 1 AND NOT EXISTS (
      SELECT 1 FROM account_artifacts aa WHERE aa.account_id = ? AND aa.catalog_artifact_slug = catalog_artifacts.slug
    )
  `,
  ).run(accountId, accountId);

  db.prepare(
    `
    INSERT INTO account_demons (account_id, catalog_demon_slug, name, rarity, star_rating, owned, gauge_level, display_order)
    SELECT ?, slug, name, rarity, star_rating, 0, 0, display_order FROM catalog_demons
    WHERE active = 1 AND NOT EXISTS (
      SELECT 1 FROM account_demons ad WHERE ad.account_id = ? AND ad.catalog_demon_slug = catalog_demons.slug
    )
  `,
  ).run(accountId, accountId);
}

export function syncNewCatalogEntriesToAllAccounts(db: Database.Database): void {
  const accounts = db.prepare('SELECT id FROM game_accounts').all() as { id: number }[];
  const transaction = db.transaction(() => {
    for (const { id } of accounts) {
      seedAccountFromCatalog(db, id);
    }
  });
  transaction();
}

export function syncAccountCatalogMetadata(db: Database.Database): {
  heroes: number;
  artifacts: number;
  demons: number;
} {
  const heroes = db
    .prepare(
      `UPDATE account_heroes
       SET name = (SELECT ch.name FROM catalog_heroes ch WHERE ch.slug = account_heroes.catalog_hero_slug),
           class = (SELECT ch.class FROM catalog_heroes ch WHERE ch.slug = account_heroes.catalog_hero_slug),
           faction = (SELECT ch.faction FROM catalog_heroes ch WHERE ch.slug = account_heroes.catalog_hero_slug),
           rarity = (SELECT ch.rarity FROM catalog_heroes ch WHERE ch.slug = account_heroes.catalog_hero_slug),
           star_rating = (SELECT ch.star_rating FROM catalog_heroes ch WHERE ch.slug = account_heroes.catalog_hero_slug),
           display_order = (SELECT ch.display_order FROM catalog_heroes ch WHERE ch.slug = account_heroes.catalog_hero_slug)
       WHERE catalog_hero_slug IN (SELECT slug FROM catalog_heroes WHERE active = 1)`,
    )
    .run().changes;
  const artifacts = db
    .prepare(
      `UPDATE account_artifacts
       SET name = (SELECT ca.name FROM catalog_artifacts ca WHERE ca.slug = account_artifacts.catalog_artifact_slug),
           rarity = (SELECT ca.rarity FROM catalog_artifacts ca WHERE ca.slug = account_artifacts.catalog_artifact_slug),
           star_rating = (SELECT ca.star_rating FROM catalog_artifacts ca WHERE ca.slug = account_artifacts.catalog_artifact_slug),
           display_order = (SELECT ca.display_order FROM catalog_artifacts ca WHERE ca.slug = account_artifacts.catalog_artifact_slug)
       WHERE catalog_artifact_slug IN (SELECT slug FROM catalog_artifacts WHERE active = 1)`,
    )
    .run().changes;
  const demons = db
    .prepare(
      `UPDATE account_demons
       SET name = (SELECT cd.name FROM catalog_demons cd WHERE cd.slug = account_demons.catalog_demon_slug),
           rarity = (SELECT cd.rarity FROM catalog_demons cd WHERE cd.slug = account_demons.catalog_demon_slug),
           star_rating = (SELECT cd.star_rating FROM catalog_demons cd WHERE cd.slug = account_demons.catalog_demon_slug),
           display_order = (SELECT cd.display_order FROM catalog_demons cd WHERE cd.slug = account_demons.catalog_demon_slug)
       WHERE catalog_demon_slug IN (SELECT slug FROM catalog_demons WHERE active = 1)`,
    )
    .run().changes;
  return { heroes, artifacts, demons };
}

export function pruneInactiveCatalogAccountRows(db: Database.Database): {
  heroes: number;
  artifacts: number;
  demons: number;
} {
  const heroes = db
    .prepare(
      `DELETE FROM account_heroes
       WHERE catalog_hero_slug IN (SELECT slug FROM catalog_heroes WHERE active = 0)
          OR catalog_hero_slug NOT IN (SELECT slug FROM catalog_heroes)`,
    )
    .run().changes;
  const artifacts = db
    .prepare(
      `DELETE FROM account_artifacts
       WHERE catalog_artifact_slug IN (SELECT slug FROM catalog_artifacts WHERE active = 0)
          OR catalog_artifact_slug NOT IN (SELECT slug FROM catalog_artifacts)`,
    )
    .run().changes;
  const demons = db
    .prepare(
      `DELETE FROM account_demons
       WHERE catalog_demon_slug IN (SELECT slug FROM catalog_demons WHERE active = 0)
          OR catalog_demon_slug NOT IN (SELECT slug FROM catalog_demons)`,
    )
    .run().changes;
  return { heroes, artifacts, demons };
}

export function getHeroes(
  db: Database.Database,
  accountId: number,
  classFilter: string,
  factionFilter: string,
): AccountHero[] {
  let sql = `
    SELECT ah.id, ah.catalog_hero_slug, ah.name, ah.class, ah.faction, ah.rarity, ah.star_rating,
           ah.owned, ah.gauge_level, ah.display_order,
           ch.reference_tier, ch.portrait_path
    FROM account_heroes ah
    LEFT JOIN catalog_heroes ch ON ch.slug = ah.catalog_hero_slug
    WHERE ah.account_id = ?`;
  const params: (number | string)[] = [accountId];
  if (classFilter && heroClasses.includes(classFilter)) {
    sql += ' AND ah.class = ?';
    params.push(classFilter);
  }
  if (factionFilter && factions.includes(factionFilter)) {
    sql += ' AND ah.faction = ?';
    params.push(factionFilter);
  }
  sql += ' ORDER BY ah.display_order ASC, ah.name ASC';
  return db.prepare(sql).all(...params) as AccountHero[];
}

export function getHeroStats(
  db: Database.Database,
  accountId: number,
): { total: number; owned: number; maxed: number } {
  const row = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN owned = 1 THEN 1 ELSE 0 END) as owned,
      SUM(CASE WHEN owned = 1 AND gauge_level = ? THEN 1 ELSE 0 END) as maxed
    FROM account_heroes WHERE account_id = ?
  `,
    )
    .get(HERO_AWAKENING_MAX, accountId) as { total: number; owned: number; maxed: number };
  return {
    total: Number(row.total),
    owned: Number(row.owned ?? 0),
    maxed: Number(row.maxed ?? 0),
  };
}

export function getArtifacts(db: Database.Database, accountId: number): AccountArtifact[] {
  return db
    .prepare(
      `
    SELECT aa.id, aa.catalog_artifact_slug, aa.name, aa.rarity, aa.star_rating,
           aa.owned, aa.gauge_level, aa.display_order,
           ca.class, ca.exclusive_hero_slug, ca.is_universal,
           ca.reference_tier, ca.portrait_path,
           ch.name as exclusive_hero_name, ch.portrait_path as exclusive_hero_portrait
    FROM account_artifacts aa
    LEFT JOIN catalog_artifacts ca ON ca.slug = aa.catalog_artifact_slug
    LEFT JOIN catalog_heroes ch ON ch.slug = ca.exclusive_hero_slug
    WHERE aa.account_id = ?
    ORDER BY aa.display_order ASC, aa.name ASC
  `,
    )
    .all(accountId) as AccountArtifact[];
}

export function getArtifactStats(
  db: Database.Database,
  accountId: number,
): { total: number; owned: number; maxed: number } {
  const row = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN owned = 1 THEN 1 ELSE 0 END) as owned,
      SUM(CASE WHEN owned = 1 AND gauge_level = ? THEN 1 ELSE 0 END) as maxed
    FROM account_artifacts WHERE account_id = ?
  `,
    )
    .get(ARTIFACT_PROMOTION_MAX, accountId) as { total: number; owned: number; maxed: number };
  return {
    total: Number(row.total),
    owned: Number(row.owned ?? 0),
    maxed: Number(row.maxed ?? 0),
  };
}

export function getDemons(db: Database.Database, accountId: number): AccountDemon[] {
  return db
    .prepare(
      `
    SELECT ad.id, ad.catalog_demon_slug, ad.name, ad.rarity, ad.star_rating,
           ad.owned, ad.gauge_level, ad.display_order,
           COALESCE(cd.max_level, 5) as max_level, cd.portrait_path
    FROM account_demons ad
    LEFT JOIN catalog_demons cd ON cd.slug = ad.catalog_demon_slug
    WHERE ad.account_id = ?
    ORDER BY ad.display_order ASC, ad.name ASC
  `,
    )
    .all(accountId) as AccountDemon[];
}

export function getDemonStats(
  db: Database.Database,
  accountId: number,
): { total: number; owned: number; maxed: number } {
  const row = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ad.owned = 1 THEN 1 ELSE 0 END) as owned,
      SUM(CASE WHEN ad.owned = 1 AND ad.gauge_level = COALESCE(cd.max_level, 5) THEN 1 ELSE 0 END) as maxed
    FROM account_demons ad
    LEFT JOIN catalog_demons cd ON cd.slug = ad.catalog_demon_slug
    WHERE ad.account_id = ?
  `,
    )
    .get(accountId) as { total: number; owned: number; maxed: number };
  return {
    total: Number(row.total),
    owned: Number(row.owned ?? 0),
    maxed: Number(row.maxed ?? 0),
  };
}

export function getDemonMaxLevel(
  db: Database.Database,
  demonId: number,
  accountId: number,
): number | null {
  const row = db
    .prepare(
      `
    SELECT COALESCE(cd.max_level, 5) as max_level
    FROM account_demons ad
    LEFT JOIN catalog_demons cd ON cd.slug = ad.catalog_demon_slug
    WHERE ad.id = ? AND ad.account_id = ?
  `,
    )
    .get(demonId, accountId) as { max_level: number } | undefined;
  return row ? Number(row.max_level) : null;
}

export function updateHeroOwned(
  db: Database.Database,
  heroId: number,
  accountId: number,
  owned: number,
): boolean {
  const gaugeLevel = owned === 0 ? 0 : undefined;
  const sql =
    gaugeLevel === 0
      ? 'UPDATE account_heroes SET owned = 0, gauge_level = 0 WHERE id = ? AND account_id = ?'
      : 'UPDATE account_heroes SET owned = 1 WHERE id = ? AND account_id = ?';
  const r = db.prepare(sql).run(heroId, accountId);
  return r.changes > 0;
}

export function updateArtifactOwned(
  db: Database.Database,
  artifactId: number,
  accountId: number,
  owned: number,
): boolean {
  const sql =
    owned === 0
      ? 'UPDATE account_artifacts SET owned = 0, gauge_level = 0 WHERE id = ? AND account_id = ?'
      : 'UPDATE account_artifacts SET owned = 1 WHERE id = ? AND account_id = ?';
  const r = db.prepare(sql).run(artifactId, accountId);
  return r.changes > 0;
}

export function updateDemonOwned(
  db: Database.Database,
  demonId: number,
  accountId: number,
  owned: number,
): boolean {
  const sql =
    owned === 0
      ? 'UPDATE account_demons SET owned = 0, gauge_level = 0 WHERE id = ? AND account_id = ?'
      : 'UPDATE account_demons SET owned = 1 WHERE id = ? AND account_id = ?';
  const r = db.prepare(sql).run(demonId, accountId);
  return r.changes > 0;
}

export function updateHeroGauge(
  db: Database.Database,
  heroId: number,
  accountId: number,
  gaugeLevel: number,
): boolean {
  if (!isValidHeroGauge(gaugeLevel)) return false;
  const r = db
    .prepare(
      'UPDATE account_heroes SET gauge_level = ?, owned = 1 WHERE id = ? AND account_id = ? AND owned = 1',
    )
    .run(gaugeLevel, heroId, accountId);
  return r.changes > 0;
}

export function updateArtifactGauge(
  db: Database.Database,
  artifactId: number,
  accountId: number,
  gaugeLevel: number,
): boolean {
  if (!isValidArtifactGauge(gaugeLevel)) return false;
  const r = db
    .prepare(
      'UPDATE account_artifacts SET gauge_level = ?, owned = 1 WHERE id = ? AND account_id = ? AND owned = 1',
    )
    .run(gaugeLevel, artifactId, accountId);
  return r.changes > 0;
}

export function updateDemonGauge(
  db: Database.Database,
  demonId: number,
  accountId: number,
  gaugeLevel: number,
): boolean {
  const maxLevel = getDemonMaxLevel(db, demonId, accountId);
  if (
    maxLevel === null ||
    !Number.isInteger(gaugeLevel) ||
    gaugeLevel < 0 ||
    gaugeLevel > maxLevel
  ) {
    return false;
  }
  const r = db
    .prepare(
      'UPDATE account_demons SET gauge_level = ?, owned = 1 WHERE id = ? AND account_id = ? AND owned = 1',
    )
    .run(gaugeLevel, demonId, accountId);
  return r.changes > 0;
}

export function deleteHero(db: Database.Database, heroId: number, accountId: number): boolean {
  const r = db
    .prepare('DELETE FROM account_heroes WHERE id = ? AND account_id = ?')
    .run(heroId, accountId);
  return r.changes > 0;
}

export function deleteArtifact(
  db: Database.Database,
  artifactId: number,
  accountId: number,
): boolean {
  const r = db
    .prepare('DELETE FROM account_artifacts WHERE id = ? AND account_id = ?')
    .run(artifactId, accountId);
  return r.changes > 0;
}

export function deleteDemon(db: Database.Database, demonId: number, accountId: number): boolean {
  const r = db
    .prepare('DELETE FROM account_demons WHERE id = ? AND account_id = ?')
    .run(demonId, accountId);
  return r.changes > 0;
}

export function catalogHasEntries(db: Database.Database): boolean {
  const row = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM catalog_heroes WHERE active = 1) +
        (SELECT COUNT(*) FROM catalog_artifacts WHERE active = 1) +
        (SELECT COUNT(*) FROM catalog_demons WHERE active = 1) as total`,
    )
    .get() as { total: number };
  return Number(row.total) > 0;
}

export { heroClasses, factions, HERO_AWAKENING_MAX, ARTIFACT_PROMOTION_MAX };

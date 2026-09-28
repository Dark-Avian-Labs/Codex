import { log } from '@codex/core';
import type Database from 'better-sqlite3';

import { ensureCodexModularWeaponsPopulated } from '../codexModularWeapons.js';
import { ensureImportRunsSchema } from '../importRuns.js';
import { backfillArchonBuffArmoryKeys, backfillHelminthArmoryKeys } from './catalogKeys.js';
import { ensureCatalogKeyColumns } from './catalogMigrations.js';
import { getCatalogDb } from './connection.js';

const CATALOG_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS warframes (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      health REAL,
      shield REAL,
      armor REAL,
      power REAL,
      sprint_speed REAL,
      stamina REAL,
      passive_description TEXT,
      product_category TEXT,
      abilities TEXT,
      aura_polarity TEXT,
      exilus_polarity TEXT,
      polarities TEXT,
      mastery_req INTEGER DEFAULT 0,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0,
      artifact_slots TEXT,
      passive_description_wiki TEXT
    );

    CREATE TABLE IF NOT EXISTS abilities (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      warframe_unique_name TEXT,
      is_helminth_extractable INTEGER DEFAULT 0,
      image_path TEXT,
      ability_stats TEXT,
      wiki_stats TEXT,
      energy_cost INTEGER,
      armory_helminth_key TEXT,
      FOREIGN KEY (warframe_unique_name) REFERENCES warframes(unique_name)
    );

    CREATE TABLE IF NOT EXISTS weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      product_category TEXT,
      slot INTEGER,
      mastery_req INTEGER DEFAULT 0,
      total_damage REAL,
      damage_per_shot TEXT,
      critical_chance REAL,
      critical_multiplier REAL,
      proc_chance REAL,
      fire_rate REAL,
      accuracy REAL,
      magazine_size INTEGER,
      reload_time REAL,
      multishot INTEGER,
      noise TEXT,
      trigger_type TEXT,
      omega_attenuation REAL,
      riven_disposition REAL,
      max_level_cap INTEGER,
      sentinel INTEGER DEFAULT 0,
      blocking_angle INTEGER,
      combo_duration INTEGER,
      follow_through REAL,
      range REAL,
      slam_attack REAL,
      slam_radial_damage REAL,
      slam_radius REAL,
      slide_attack REAL,
      heavy_attack_damage REAL,
      heavy_slam_attack REAL,
      heavy_slam_radial_damage REAL,
      heavy_slam_radius REAL,
      wind_up REAL,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0,
      artifact_slots TEXT,
      fire_behaviors TEXT,
      has_incarnon INTEGER DEFAULT 0,
      incarnon_data TEXT
    );

    CREATE TABLE IF NOT EXISTS companions (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_name TEXT,
      health INTEGER,
      shield INTEGER,
      armor INTEGER,
      power INTEGER,
      stamina INTEGER,
      product_category TEXT,
      mastery_req INTEGER DEFAULT 0,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      artifact_slots TEXT
    );

    CREATE TABLE IF NOT EXISTS mod_sets (
      unique_name TEXT PRIMARY KEY,
      num_in_set INTEGER,
      stats TEXT
    );

    CREATE TABLE IF NOT EXISTS mods (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      polarity TEXT,
      rarity TEXT,
      type TEXT,
      compat_name TEXT,
      base_drain INTEGER,
      fusion_limit INTEGER,
      is_utility INTEGER DEFAULT 0,
      is_augment INTEGER DEFAULT 0,
      augment_for_ability TEXT,
      subtype TEXT,
      mod_set TEXT REFERENCES mod_sets(unique_name),
      description TEXT,
      upgrade_entries TEXT,
      image_path TEXT,
      atragraph_card_path TEXT,
      foil_overlay_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS mod_level_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mod_unique_name TEXT NOT NULL,
      rank INTEGER NOT NULL,
      stats TEXT NOT NULL,
      FOREIGN KEY (mod_unique_name) REFERENCES mods(unique_name),
      UNIQUE(mod_unique_name, rank)
    );

    CREATE TABLE IF NOT EXISTS mod_set_members (
      mod_unique_name TEXT NOT NULL,
      set_unique_name TEXT NOT NULL,
      PRIMARY KEY (mod_unique_name, set_unique_name),
      FOREIGN KEY (mod_unique_name) REFERENCES mods(unique_name),
      FOREIGN KEY (set_unique_name) REFERENCES mod_sets(unique_name)
    );

    CREATE TABLE IF NOT EXISTS arcanes (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rarity TEXT,
      level_stats TEXT,
      compat_tags TEXT,
      image_path TEXT,
      codex_secret INTEGER DEFAULT 0,
      exclude_from_codex INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS archon_shard_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon_path TEXT NOT NULL,
      tauforged_icon_path TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS archon_shard_buffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shard_type_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      base_value REAL NOT NULL,
      tauforged_value REAL NOT NULL,
      value_format TEXT DEFAULT '%',
      sort_order INTEGER DEFAULT 0,
      armory_key TEXT,
      FOREIGN KEY (shard_type_id) REFERENCES archon_shard_types(id)
    );

    CREATE TABLE IF NOT EXISTS warframe_market_links (
      canonical_key TEXT NOT NULL,
      worksheet_category TEXT NOT NULL,
      market_href TEXT,
      market_href_prime TEXT,
      link_kind TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (canonical_key, worksheet_category)
    );

    CREATE TABLE IF NOT EXISTS codex_modular_weapons (
      unique_name TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_mods_type ON mods(type);
    CREATE INDEX IF NOT EXISTS idx_mods_rarity ON mods(rarity);
    CREATE INDEX IF NOT EXISTS idx_mods_compat ON mods(compat_name);
    CREATE INDEX IF NOT EXISTS idx_weapons_category ON weapons(product_category);
    CREATE INDEX IF NOT EXISTS idx_weapons_slot ON weapons(slot);
    CREATE INDEX IF NOT EXISTS idx_abilities_warframe ON abilities(warframe_unique_name);
    CREATE INDEX IF NOT EXISTS idx_warframe_market_links_category ON warframe_market_links(worksheet_category);
    CREATE INDEX IF NOT EXISTS idx_codex_modular_weapons_order ON codex_modular_weapons(display_order);
  `;

export function ensureWarframeCatalogTables(db: Database.Database): void {
  db.exec(CATALOG_SCHEMA_SQL);
  ensureCatalogKeyColumns(db);
  ensureImportRunsSchema(db);
}

export function createCatalogSchema(): void {
  const db = getCatalogDb();
  ensureWarframeCatalogTables(db);
  const archonKeys = backfillArchonBuffArmoryKeys(db);
  const helminthKeys = backfillHelminthArmoryKeys(db);
  const codexModularCount = ensureCodexModularWeaponsPopulated(db);
  if (archonKeys > 0 || helminthKeys > 0) {
    log('info', 'Catalog armory keys backfilled', {
      archonBuffs: archonKeys,
      helminthAbilities: helminthKeys,
    });
  }
  if (codexModularCount > 0) {
    log('info', 'Codex modular weapons catalog ready', { activeRows: codexModularCount });
  }
  log('info', 'Catalog schema created/verified');
}

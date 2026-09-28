import fs from 'fs';
import path from 'path';

import { log } from '@codex/core';

import { helminthEntryByDePath } from '../../../../shared/warframeImport/helminthRegistry.js';
import { EXPORTS_DIR } from '../../../config.js';
import {
  isUnreleasedArcane,
  resolveArcaneImportRarity,
  UNRELEASED_ARCANE_UNIQUE_NAMES,
} from '../arcaneCatalog.js';
import { classifyArcaneCompatTags } from '../arcaneCompat.js';
import { syncCodexModularWeaponsTable } from '../codexModularWeapons.js';
import { restoreModAtragraphPaths, saveModAtragraphPaths } from '../scraping/atragraphModsWiki.js';
import { getCatalogDb } from './connection.js';

export function processExports(options?: { skipPreserve?: boolean }): {
  warframes: number;
  weapons: number;
  companions: number;
  mods: number;
  modSets: number;
  arcanes: number;
  abilities: number;
} {
  const counts = {
    warframes: 0,
    weapons: 0,
    companions: 0,
    mods: 0,
    modSets: 0,
    arcanes: 0,
    abilities: 0,
  };

  const skipPreserve = options?.skipPreserve === true;
  const savedImagePaths = skipPreserve ? new Map<string, string>() : saveImagePaths();
  const savedAtragraphPaths = skipPreserve ? new Map() : saveModAtragraphPaths();
  const savedScrapedData = skipPreserve
    ? { warframes: [], weapons: [], companions: [], abilities: [], mods: [] }
    : saveScrapedData();

  const warframesData = readExport('ExportWarframes_en');
  if (warframesData) {
    counts.warframes = processWarframes(warframesData);
    counts.abilities = processAbilities(warframesData);
  }

  const weaponsData = readExport('ExportWeapons_en');
  if (weaponsData) {
    counts.weapons = processWeapons(weaponsData);
  }

  const companionsData = readExport('ExportSentinels_en');
  if (companionsData) {
    counts.companions = processCompanions(companionsData);
  }

  const upgradesData = readExport('ExportUpgrades_en');
  if (upgradesData) {
    counts.modSets = processModSets(upgradesData);
    counts.mods = processMods(upgradesData);
    backfillModDescriptions();
  }

  const arcaneData = readExport('ExportRelicArcane_en');
  if (arcaneData) {
    counts.arcanes = processArcanes(arcaneData);
  }

  if (!skipPreserve) {
    restoreImagePaths(savedImagePaths);
    restoreModAtragraphPaths(savedAtragraphPaths);
    restoreScrapedData(savedScrapedData);
  }

  if (counts.weapons > 0) {
    const modular = syncCodexModularWeaponsTable(getCatalogDb());
    log('info', 'Codex modular weapons catalog synced', { upserted: modular.upserted });
  }

  return counts;
}

const IMAGE_PATH_TABLES = [
  'warframes',
  'weapons',
  'companions',
  'mods',
  'arcanes',
  'abilities',
] as const;

function saveImagePaths(): Map<string, string> {
  const db = getCatalogDb();
  const pathMap = new Map<string, string>();
  for (const table of IMAGE_PATH_TABLES) {
    const rows = db
      .prepare(`SELECT unique_name, image_path FROM ${table} WHERE image_path IS NOT NULL`)
      .all() as Array<{ unique_name: string; image_path: string }>;
    for (const row of rows) {
      pathMap.set(row.unique_name, row.image_path);
    }
  }
  if (pathMap.size > 0) {
    log('info', 'Saved image_path values before reprocessing', { count: pathMap.size });
  }
  return pathMap;
}

function restoreImagePaths(pathMap: Map<string, string>): void {
  if (pathMap.size === 0) return;
  const db = getCatalogDb();
  const stmts = IMAGE_PATH_TABLES.map((table) =>
    db.prepare(`UPDATE ${table} SET image_path = ? WHERE unique_name = ?`),
  );
  const tx = db.transaction(() => {
    for (const stmt of stmts) {
      for (const [uniqueName, imagePath] of pathMap) {
        stmt.run(imagePath, uniqueName);
      }
    }
  });
  tx();
  log('info', 'Restored image_path values after reprocessing', { count: pathMap.size });
}

interface ScrapedRow {
  unique_name: string;
  [key: string]: string | null;
}

function saveScrapedData(): {
  warframes: ScrapedRow[];
  weapons: ScrapedRow[];
  companions: ScrapedRow[];
  abilities: ScrapedRow[];
  mods: ScrapedRow[];
} {
  const db = getCatalogDb();
  const saved = {
    warframes: [] as ScrapedRow[],
    weapons: [] as ScrapedRow[],
    companions: [] as ScrapedRow[],
    abilities: [] as ScrapedRow[],
    mods: [] as ScrapedRow[],
  };

  saved.warframes = db
    .prepare(
      `SELECT unique_name, artifact_slots, passive_description_wiki FROM warframes
     WHERE artifact_slots IS NOT NULL OR passive_description_wiki IS NOT NULL`,
    )
    .all() as ScrapedRow[];

  saved.weapons = db
    .prepare(
      `SELECT unique_name, artifact_slots, fire_behaviors, has_incarnon, incarnon_data FROM weapons
     WHERE artifact_slots IS NOT NULL OR fire_behaviors IS NOT NULL
        OR has_incarnon = 1 OR incarnon_data IS NOT NULL`,
    )
    .all() as ScrapedRow[];

  saved.companions = db
    .prepare(`SELECT unique_name, artifact_slots FROM companions WHERE artifact_slots IS NOT NULL`)
    .all() as ScrapedRow[];

  saved.abilities = db
    .prepare(
      `SELECT unique_name, wiki_stats, energy_cost FROM abilities
     WHERE wiki_stats IS NOT NULL OR energy_cost IS NOT NULL`,
    )
    .all() as ScrapedRow[];

  saved.mods = db
    .prepare(
      `SELECT unique_name, mod_set, augment_for_ability FROM mods
     WHERE mod_set IS NOT NULL OR augment_for_ability IS NOT NULL`,
    )
    .all() as ScrapedRow[];

  const total =
    saved.warframes.length +
    saved.weapons.length +
    saved.companions.length +
    saved.abilities.length +
    saved.mods.length;
  if (total > 0) log('info', 'Saved scraped data rows before reprocessing', { count: total });
  return saved;
}

function restoreScrapedData(saved: ReturnType<typeof saveScrapedData>): void {
  const db = getCatalogDb();
  const total =
    saved.warframes.length +
    saved.weapons.length +
    saved.companions.length +
    saved.abilities.length +
    saved.mods.length;
  if (total === 0) return;

  const tx = db.transaction(() => {
    const wfStmt = db.prepare(
      'UPDATE warframes SET artifact_slots = ?, passive_description_wiki = ? WHERE unique_name = ?',
    );
    for (const row of saved.warframes) {
      wfStmt.run(row.artifact_slots, row.passive_description_wiki, row.unique_name);
    }

    const wpStmt = db.prepare(
      'UPDATE weapons SET artifact_slots = ?, fire_behaviors = ?, has_incarnon = ?, incarnon_data = ? WHERE unique_name = ?',
    );
    for (const row of saved.weapons) {
      wpStmt.run(
        row.artifact_slots,
        row.fire_behaviors,
        row.has_incarnon ?? 0,
        row.incarnon_data ?? null,
        row.unique_name,
      );
    }

    const cpStmt = db.prepare('UPDATE companions SET artifact_slots = ? WHERE unique_name = ?');
    for (const row of saved.companions) {
      cpStmt.run(row.artifact_slots, row.unique_name);
    }

    const abStmt = db.prepare(
      'UPDATE abilities SET wiki_stats = ?, energy_cost = ? WHERE unique_name = ?',
    );
    for (const row of saved.abilities) {
      abStmt.run(row.wiki_stats, row.energy_cost, row.unique_name);
    }

    const modStmt = db.prepare(
      'UPDATE mods SET mod_set = ?, augment_for_ability = ? WHERE unique_name = ?',
    );
    for (const row of saved.mods) {
      modStmt.run(row.mod_set, row.augment_for_ability, row.unique_name);
    }
  });

  tx();
  log('info', 'Restored scraped data rows after reprocessing', { count: total });
}

function readExport(category: string): Record<string, unknown[]> | null {
  const filePath = path.join(EXPORTS_DIR, `${category}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function processWarframes(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();
  const items = (data.ExportWarframes || []) as Record<string, unknown>[];

  const stmt = db.prepare(`
    INSERT INTO warframes
    (unique_name, name, description, health, shield, armor, power, sprint_speed, stamina,
     passive_description, product_category, abilities, aura_polarity, exilus_polarity,
     polarities, mastery_req, codex_secret, exclude_from_codex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      health = excluded.health,
      shield = excluded.shield,
      armor = excluded.armor,
      power = excluded.power,
      sprint_speed = excluded.sprint_speed,
      stamina = excluded.stamina,
      passive_description = excluded.passive_description,
      product_category = excluded.product_category,
      abilities = excluded.abilities,
      aura_polarity = excluded.aura_polarity,
      exilus_polarity = excluded.exilus_polarity,
      polarities = excluded.polarities,
      mastery_req = excluded.mastery_req,
      codex_secret = excluded.codex_secret,
      exclude_from_codex = excluded.exclude_from_codex
  `);

  const tx = db.transaction(() => {
    for (const item of items) {
      stmt.run(
        item.uniqueName,
        item.name,
        item.description ?? null,
        item.health ?? null,
        item.shield ?? null,
        item.armor ?? null,
        item.power ?? null,
        item.sprintSpeed ?? null,
        item.stamina ?? null,
        item.passiveDescription ?? null,
        item.productCategory ?? null,
        item.abilities ? JSON.stringify(item.abilities) : null,
        item.auraPolarity ?? null,
        item.exilusPolarity ?? null,
        item.polarities ? JSON.stringify(item.polarities) : null,
        item.masteryReq ?? 0,
        item.codexSecret ? 1 : 0,
        item.excludeFromCodex ? 1 : 0,
      );
    }
  });
  tx();
  return items.length;
}

function processAbilities(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();

  const stmt = db.prepare(`
    INSERT INTO abilities
    (unique_name, name, description, warframe_unique_name, is_helminth_extractable, armory_helminth_key)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      is_helminth_extractable = MAX(
        abilities.is_helminth_extractable,
        excluded.is_helminth_extractable
      ),
      armory_helminth_key = COALESCE(abilities.armory_helminth_key, excluded.armory_helminth_key)
  `);

  const helminthKeyFor = (uniqueName: string, extractable: number): string | null => {
    if (!extractable) return null;
    return helminthEntryByDePath(uniqueName)?.armory_key ?? null;
  };

  let count = 0;

  const tx = db.transaction(() => {
    const helminthAbilities = (data.ExportAbilities || []) as Record<string, unknown>[];
    for (const item of helminthAbilities) {
      const uniqueName = item.abilityUniqueName || item.uniqueName;
      stmt.run(
        uniqueName,
        item.abilityName || item.name,
        item.description ?? null,
        null,
        1,
        helminthKeyFor(String(uniqueName), 1),
      );
      count++;
    }

    const warframes = (data.ExportWarframes || []) as Record<string, unknown>[];
    for (const wf of warframes) {
      const abilities = wf.abilities as Array<Record<string, unknown>> | undefined;
      if (!abilities || !Array.isArray(abilities)) continue;

      for (const ab of abilities) {
        const uniqueName = (ab.abilityUniqueName || ab.uniqueName) as string | undefined;
        const name = (ab.abilityName || ab.name) as string | undefined;
        if (!uniqueName || !name) continue;

        stmt.run(uniqueName, name, ab.description ?? null, wf.uniqueName ?? null, 0, null);
        count++;
      }
    }
  });
  tx();

  log('info', 'Processed abilities', { count });
  return count;
}

function processWeapons(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();
  const items = (data.ExportWeapons || []) as Record<string, unknown>[];

  const stmt = db.prepare(`
    INSERT INTO weapons
    (unique_name, name, description, product_category, slot, mastery_req,
     total_damage, damage_per_shot, critical_chance, critical_multiplier,
     proc_chance, fire_rate, accuracy, magazine_size, reload_time, multishot,
     noise, trigger_type, omega_attenuation, riven_disposition, max_level_cap, sentinel,
     blocking_angle, combo_duration, follow_through, range,
     slam_attack, slam_radial_damage, slam_radius, slide_attack,
     heavy_attack_damage, heavy_slam_attack, heavy_slam_radial_damage,
     heavy_slam_radius, wind_up, codex_secret, exclude_from_codex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      product_category = excluded.product_category,
      slot = excluded.slot,
      mastery_req = excluded.mastery_req,
      total_damage = excluded.total_damage,
      damage_per_shot = excluded.damage_per_shot,
      critical_chance = excluded.critical_chance,
      critical_multiplier = excluded.critical_multiplier,
      proc_chance = excluded.proc_chance,
      fire_rate = excluded.fire_rate,
      accuracy = excluded.accuracy,
      magazine_size = excluded.magazine_size,
      reload_time = excluded.reload_time,
      multishot = excluded.multishot,
      noise = excluded.noise,
      trigger_type = excluded.trigger_type,
      omega_attenuation = excluded.omega_attenuation,
      riven_disposition = excluded.riven_disposition,
      max_level_cap = excluded.max_level_cap,
      sentinel = excluded.sentinel,
      blocking_angle = excluded.blocking_angle,
      combo_duration = excluded.combo_duration,
      follow_through = excluded.follow_through,
      range = excluded.range,
      slam_attack = excluded.slam_attack,
      slam_radial_damage = excluded.slam_radial_damage,
      slam_radius = excluded.slam_radius,
      slide_attack = excluded.slide_attack,
      heavy_attack_damage = excluded.heavy_attack_damage,
      heavy_slam_attack = excluded.heavy_slam_attack,
      heavy_slam_radial_damage = excluded.heavy_slam_radial_damage,
      heavy_slam_radius = excluded.heavy_slam_radius,
      wind_up = excluded.wind_up,
      codex_secret = excluded.codex_secret,
      exclude_from_codex = excluded.exclude_from_codex
  `);

  const tx = db.transaction(() => {
    for (const item of items) {
      stmt.run(
        item.uniqueName,
        item.name,
        item.description ?? null,
        item.productCategory ?? null,
        item.slot ?? null,
        item.masteryReq ?? 0,
        item.totalDamage ?? null,
        item.damagePerShot ? JSON.stringify(item.damagePerShot) : null,
        item.criticalChance ?? null,
        item.criticalMultiplier ?? null,
        item.procChance ?? null,
        item.fireRate ?? null,
        item.accuracy ?? null,
        item.magazineSize ?? null,
        item.reloadTime ?? null,
        item.multishot ?? null,
        item.noise ?? null,
        item.trigger ?? null,
        item.omegaAttenuation ?? null,
        item.rivenDisposition ?? null,
        item.maxLevelCap ?? null,
        item.sentinel ? 1 : 0,
        item.blockingAngle ?? null,
        item.comboDuration ?? null,
        item.followThrough ?? null,
        item.range ?? null,
        item.slamAttack ?? null,
        item.slamRadialDamage ?? null,
        item.slamRadius ?? null,
        item.slideAttack ?? null,
        item.heavyAttackDamage ?? null,
        item.heavySlamAttack ?? null,
        item.heavySlamRadialDamage ?? null,
        item.heavySlamRadius ?? null,
        item.windUp ?? null,
        item.codexSecret ? 1 : 0,
        item.excludeFromCodex ? 1 : 0,
      );
    }
  });
  tx();
  return items.length;
}

function processCompanions(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();
  const items = (data.ExportSentinels || []) as Record<string, unknown>[];

  const stmt = db.prepare(`
    INSERT INTO companions
    (unique_name, name, description, parent_name, health, shield, armor,
     power, stamina, product_category, mastery_req, codex_secret)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      parent_name = excluded.parent_name,
      health = excluded.health,
      shield = excluded.shield,
      armor = excluded.armor,
      power = excluded.power,
      stamina = excluded.stamina,
      product_category = excluded.product_category,
      mastery_req = excluded.mastery_req,
      codex_secret = excluded.codex_secret
  `);

  const tx = db.transaction(() => {
    for (const item of items) {
      stmt.run(
        item.uniqueName,
        item.name,
        item.description ?? null,
        item.parentName ?? null,
        item.health ?? null,
        item.shield ?? null,
        item.armor ?? null,
        item.power ?? null,
        item.stamina ?? null,
        item.productCategory ?? null,
        item.masteryReq ?? 0,
        item.codexSecret ? 1 : 0,
      );
    }
  });
  tx();
  return items.length;
}

const GENERIC_MOD_TYPE = '---';

const COMPAT_NAME_TO_WEAPON_TYPE: Record<string, string> = {
  SNIPER: 'SNIPER',
  RIFLE: 'RIFLE',
  SHOTGUN: 'SHOTGUN',
  BOW: 'BOW',
  LAUNCHER: 'LAUNCHER',
  'ASSAULT RIFLE': 'ASSAULT RIFLE',
  PISTOL: 'SECONDARY',
};

function resolveGenericModType(
  rawType: string | null,
  compatName: string | undefined,
): string | null {
  if (rawType !== GENERIC_MOD_TYPE) return rawType;
  if (!compatName) return rawType;
  return COMPAT_NAME_TO_WEAPON_TYPE[compatName.toUpperCase()] ?? rawType;
}

function processMods(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();
  const items = (data.ExportUpgrades || []) as Record<string, unknown>[];

  const modStmt = db.prepare(`
    INSERT INTO mods
    (unique_name, name, polarity, rarity, type, compat_name, base_drain,
     fusion_limit, is_utility, is_augment, subtype, description,
     mod_set, codex_secret, exclude_from_codex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      polarity = excluded.polarity,
      rarity = excluded.rarity,
      type = excluded.type,
      compat_name = excluded.compat_name,
      base_drain = excluded.base_drain,
      fusion_limit = excluded.fusion_limit,
      is_utility = excluded.is_utility,
      is_augment = excluded.is_augment,
      subtype = excluded.subtype,
      description = excluded.description,
      mod_set = excluded.mod_set,
      codex_secret = excluded.codex_secret,
      exclude_from_codex = excluded.exclude_from_codex
  `);

  const memberStmt = db.prepare(`
    INSERT OR REPLACE INTO mod_set_members (mod_unique_name, set_unique_name)
    VALUES (?, ?)
  `);

  const levelStmt = db.prepare(`
    INSERT OR REPLACE INTO mod_level_stats (mod_unique_name, rank, stats)
    VALUES (?, ?, ?)
  `);

  const modSetExistsStmt = db.prepare('SELECT 1 FROM mod_sets WHERE unique_name = ? LIMIT 1');

  const tx = db.transaction(() => {
    for (const item of items) {
      const isAugment = !!item.subtype;

      const rawType = (item.type as string) ?? null;
      const resolvedType = resolveGenericModType(rawType, item.compatName as string | undefined);

      let description: string | null = null;
      const baseDesc = item.description as string[] | undefined;
      const levelStats = item.levelStats as Array<{ stats?: string[] }> | undefined;
      if (levelStats) {
        const levelDescs = levelStats.map((ls) => {
          const stats = ls.stats;
          if (Array.isArray(stats) && stats.length > 0) {
            return stats.join('\n').replace(/\r\n/g, '\n').trim();
          }
          return '';
        });
        const hasLevelDescs = levelDescs.some((d) => d.length > 0);

        if (baseDesc && Array.isArray(baseDesc) && hasLevelDescs) {
          const prefix = baseDesc.join('\n').replace(/\r\n/g, '\n').trim();
          const descs = levelDescs.map((ld) => (ld ? `${prefix} ${ld}` : prefix));
          description = JSON.stringify(descs);
        } else if (hasLevelDescs) {
          description = JSON.stringify(levelDescs);
        } else if (baseDesc) {
          description = JSON.stringify(baseDesc);
        }
      } else if (baseDesc) {
        description = JSON.stringify(baseDesc);
      }

      const rawModSetRef = typeof item.modSet === 'string' ? (item.modSet as string) : null;
      const modSetRef =
        rawModSetRef && modSetExistsStmt.get(rawModSetRef) !== undefined ? rawModSetRef : null;

      modStmt.run(
        item.uniqueName,
        item.name,
        item.polarity ?? null,
        item.rarity ?? null,
        resolvedType,
        item.compatName ?? null,
        item.baseDrain ?? null,
        item.fusionLimit ?? null,
        item.isUtility ? 1 : 0,
        isAugment ? 1 : 0,
        item.subtype ?? null,
        description,
        modSetRef,
        item.codexSecret ? 1 : 0,
        item.excludeFromCodex ? 1 : 0,
      );

      if (levelStats) {
        for (let rank = 0; rank < levelStats.length; rank++) {
          levelStmt.run(item.uniqueName, rank, JSON.stringify(levelStats[rank]));
        }
      }

      if (modSetRef) {
        memberStmt.run(item.uniqueName, modSetRef);
      }
    }
  });
  tx();
  return items.length;
}

function processModSets(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();
  const items = (data.ExportModSet || []) as Record<string, unknown>[];

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO mod_sets (unique_name, num_in_set, stats)
    VALUES (?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const item of items) {
      stmt.run(
        item.uniqueName,
        item.numUpgradesInSet ?? null,
        item.stats ? JSON.stringify(item.stats) : null,
      );
    }
  });
  tx();
  return items.length;
}

function processArcanes(data: Record<string, unknown[]>): number {
  const db = getCatalogDb();
  const items = (data.ExportRelicArcane || []) as Record<string, unknown>[];

  const arcanes = items.filter(
    (item) =>
      typeof item.uniqueName === 'string' &&
      item.uniqueName.includes('CosmeticEnhancer') &&
      !isUnreleasedArcane(item.uniqueName),
  );

  const deleteUnreleased = db.prepare('DELETE FROM arcanes WHERE unique_name = ?');
  for (const uniqueName of UNRELEASED_ARCANE_UNIQUE_NAMES) {
    deleteUnreleased.run(uniqueName);
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO arcanes
    (unique_name, name, rarity, level_stats, compat_tags, codex_secret, exclude_from_codex)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const item of arcanes) {
      const compatTags = classifyArcaneCompatTags(item.uniqueName, item.name);
      stmt.run(
        item.uniqueName,
        item.name,
        resolveArcaneImportRarity(item.rarity),
        item.levelStats ? JSON.stringify(item.levelStats) : null,
        JSON.stringify(compatTags),
        item.codexSecret ? 1 : 0,
        item.excludeFromCodex ? 1 : 0,
      );
    }
  });
  tx();

  log('info', 'Processed arcanes', { count: arcanes.length, sourceCount: items.length });
  return arcanes.length;
}

export function backfillModDescriptions(): number {
  const db = getCatalogDb();

  const modsWithoutDesc = db
    .prepare(`SELECT unique_name FROM mods WHERE description IS NULL OR description = ''`)
    .all() as Array<{ unique_name: string }>;

  if (modsWithoutDesc.length === 0) return 0;

  const getLevelStats = db.prepare(
    `SELECT rank, stats FROM mod_level_stats WHERE mod_unique_name = ? ORDER BY rank`,
  );

  const updateDesc = db.prepare(`UPDATE mods SET description = ? WHERE unique_name = ?`);

  let count = 0;
  const tx = db.transaction(() => {
    for (const mod of modsWithoutDesc) {
      const rows = getLevelStats.all(mod.unique_name) as Array<{
        rank: number;
        stats: string;
      }>;
      if (rows.length === 0) continue;

      const descs = rows.map((row) => {
        try {
          const parsed = JSON.parse(row.stats);
          const stats = parsed.stats;
          if (Array.isArray(stats) && stats.length > 0) {
            return (stats as string[]).join('\n').replace(/\r\n/g, '\n').trim();
          }
        } catch {
          // ignore
        }
        return '';
      });

      if (descs.some((d) => d.length > 0)) {
        updateDesc.run(JSON.stringify(descs), mod.unique_name);
        count++;
      }
    }
  });
  tx();

  log('info', 'Backfilled mod descriptions', { count });
  return count;
}

import fs from 'fs';
import path from 'path';

import { getCatalogDb } from '../db/connection.js';
import { fetchOverframeBytes } from '../http/fetchOverframe.js';
import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS, isAbortError } from '../http/fetchWithTimeout.js';
import { safeImagePathUnderRoot } from '../safeImagePath.js';
import { fetchWikiImageForExaltedStanceMod } from './exaltedStanceWikiImages.js';
import { scrapeItemPageByPath } from './itemScraper.js';

const OVERFRAME_MEDIA_BASE_URL = 'https://media.overframe.gg/128x';
const ARMORY_WIKI_STANCE_IMAGE_SQL_PREFIX = '/ArmoryWiki/StanceMod';

interface ExaltedStanceSeed {
  id: number;
  slug: string;
  name: string;
  compatName: string;
  rarity: 'COMMON' | 'RARE';
  description: string;
  wikiPageTitle?: string;
  wikiModImageFile?: string;
}

const EXALTED_STANCE_SEEDS: ExaltedStanceSeed[] = [
  {
    id: 7447,
    slug: 'hysteria',
    name: 'Hysteria',
    compatName: 'Valkyr Talons',
    rarity: 'COMMON',
    description:
      'Stance: Valkyr is imbued with energy and becomes a ball of vicious rage, capable of unleashing a torrent of deadly claw attacks on unsuspecting foes.',
    wikiPageTitle: 'Hysteria (Ability)',
  },
  {
    id: 7444,
    slug: 'serene-storm',
    name: 'Serene Storm',
    compatName: 'Desert Wind',
    rarity: 'COMMON',
    description:
      'Stance: With his Restraint eroded, Baruuk commands the Desert Wind to deliver powerful radial strikes with his fists and feet. Each moment commanding the storm restores his Restraint.',
    wikiPageTitle: 'Serene Storm',
  },
  {
    id: 7440,
    slug: 'exalted-blade',
    name: 'Exalted Blade',
    compatName: 'Exalted Blade',
    rarity: 'COMMON',
    description: 'Stance: Summon a sword of pure light and immense power.',
    wikiPageTitle: 'Exalted Blade (Ability)',
  },
  {
    id: 7450,
    slug: 'ravenous-wraith',
    name: 'Ravenous Wraith',
    compatName: 'Shadow Claws',
    rarity: 'COMMON',
    description:
      "Stance: When the Death Well fills, Sevagoth's Shadow form is ready to be released. Tear the enemy asunder with a collection of melee-focused abilities.",
    wikiPageTitle: 'Ravenous Wraith',
  },
  {
    id: 7441,
    slug: 'primal-fury',
    name: 'Primal Fury',
    compatName: 'Iron Staff',
    rarity: 'RARE',
    description: 'Stance: Summon the iron staff and unleash fury.',
    wikiPageTitle: 'Primal Fury',
  },
  {
    id: 7356,
    slug: 'whipclaw',
    name: 'Whipclaw',
    compatName: 'Whipclaw',
    rarity: 'COMMON',
    description:
      'Stance: Khora lashes the ground with her whip, striking foes at range and lifting vulnerable targets.',
    wikiPageTitle: 'Whipclaw',
  },
  {
    id: 2403,
    slug: 'garuda-talons',
    name: 'Garuda Talons',
    compatName: 'Garuda Talons',
    rarity: 'COMMON',
    description: 'Stance: Garuda extends her talons when no melee weapon is equipped.',
    wikiPageTitle: 'Garuda Talons',
  },
  {
    id: 2273,
    slug: 'diwata',
    name: 'Razorwing',
    compatName: 'Diwata',
    rarity: 'COMMON',
    description:
      'Stance: While Razorwing is active, Titania wields the Diwata exalted heavy blade.',
    wikiPageTitle: 'Diwata',
    wikiModImageFile: 'DiwataModx256.png',
  },
  {
    id: 7358,
    slug: 'shattered-lash',
    name: 'Shattered Lash',
    compatName: 'Shattered Lash',
    rarity: 'COMMON',
    description: 'Stance: Gara extends a blade of hardened glass to slice through enemies.',
    wikiPageTitle: 'Shattered Lash',
  },
  {
    id: 7350,
    slug: 'shadow-clones',
    name: 'Shadow Clones',
    compatName: 'Shadow Clones',
    rarity: 'COMMON',
    description: 'Stance: Strike alongside manifested shadow clones.',
    wikiPageTitle: 'Shadow Clones',
  },
];

export function countMissingExaltedStanceSeeds(): number {
  const db = getCatalogDb();
  const hasRow = db.prepare(
    `SELECT 1 FROM mods WHERE name = ? AND upper(trim(type)) = 'STANCE' LIMIT 1`,
  );
  let missing = 0;
  for (const seed of EXALTED_STANCE_SEEDS) {
    const row = hasRow.get(seed.name);
    if (!row) missing += 1;
  }
  return missing;
}

function seedsNeedingOverframeSync(onlyMissing: boolean): ExaltedStanceSeed[] {
  if (!onlyMissing) return EXALTED_STANCE_SEEDS;
  const db = getCatalogDb();
  const hasRow = db.prepare(
    `SELECT 1 FROM mods WHERE name = ? AND upper(trim(type)) = 'STANCE' LIMIT 1`,
  );
  return EXALTED_STANCE_SEEDS.filter((seed) => !hasRow.get(seed.name));
}

interface OverframeStanceData {
  uniqueName: string;
  name: string;
  texturePath: string | null;
}

function extractOverframeStanceData(nextData: unknown): OverframeStanceData | null {
  if (!nextData || typeof nextData !== 'object') return null;
  const root = nextData as Record<string, unknown>;
  const item = (
    (root.props as Record<string, unknown> | undefined)?.pageProps as
      | Record<string, unknown>
      | undefined
  )?.item as Record<string, unknown> | undefined;
  if (!item || typeof item !== 'object') return null;

  const uniqueName = String(item.path ?? '').trim();
  const name = String(item.name ?? '').trim();
  const imagePathRaw = item.texture_new ?? item.texture;
  const texturePath =
    typeof imagePathRaw === 'string' && imagePathRaw.trim().length > 0 ? imagePathRaw.trim() : null;

  if (!uniqueName || !name) return null;
  return { uniqueName, name, texturePath };
}

async function ensureOverframeTextureInDataImages(texturePath: string): Promise<string | null> {
  const normalized = texturePath.startsWith('/') ? texturePath : `/${texturePath}`;
  const dbImagePath = `${normalized}.webp`;
  const relative = dbImagePath.replace(/^\/+/, '');
  let localFilePath: string;
  try {
    localFilePath = safeImagePathUnderRoot(relative);
  } catch {
    return null;
  }

  if (fs.existsSync(localFilePath)) {
    return dbImagePath;
  }

  const url = `${OVERFRAME_MEDIA_BASE_URL}${dbImagePath}`;
  let bytes: Buffer;
  try {
    bytes = await fetchOverframeBytes(url, FETCH_TIMEOUT_MS.binaryImage);
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return null;
    }
    throw error;
  }
  if (bytes.length === 0) return null;
  if (bytes.length > FETCH_BYTE_LIMITS.image) {
    return null;
  }

  fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
  fs.writeFileSync(localFilePath, bytes);
  return dbImagePath;
}

async function fetchOverframeStance(seed: ExaltedStanceSeed): Promise<OverframeStanceData | null> {
  const pagePath = `/items/arsenal/${seed.id}/${seed.slug}/`;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const scraped = await scrapeItemPageByPath(pagePath, seed.name);
      if (!scraped) return null;
      return extractOverframeStanceData(scraped.nextData);
    } catch (error) {
      console.warn(
        `[exaltedStanceMods] fetch attempt ${attempt}/${maxAttempts} failed for ${seed.id}/${seed.slug}:`,
        error,
      );
      if (attempt < maxAttempts) {
        const backoffMs = attempt * 400;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }
  return null;
}

async function applyExaltedStanceWikiImages(
  seed: ExaltedStanceSeed,
  uniqueNames: string[],
  updateImagePath: { run: (imagePath: string, uniqueName: string) => unknown },
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  if (!seed.wikiPageTitle || uniqueNames.length === 0) return false;

  onProgress?.(`Wiki infobox image: ${seed.name} (${seed.wikiPageTitle})`);
  try {
    const wikiImagePath = await fetchWikiImageForExaltedStanceMod(
      seed.wikiPageTitle,
      uniqueNames[0]!,
      seed.name,
      seed.wikiModImageFile ?? null,
      onProgress,
    );
    if (!wikiImagePath) return false;

    for (const uniqueName of uniqueNames) {
      updateImagePath.run(wikiImagePath, uniqueName);
    }
    return true;
  } catch (error) {
    onProgress?.(
      `[exaltedStanceMods] wiki image failed for ${seed.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

export async function syncExaltedStanceModsFromOverframe(
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<{ found: number; insertedOrUpdated: number; wikiImagesApplied: number }> {
  const db = getCatalogDb();
  const seeds = seedsNeedingOverframeSync(onlyMissing);
  if (seeds.length === 0) {
    onProgress?.('Overframe exalted stance sync: all stance rows already present; skipped.');
    return { found: 0, insertedOrUpdated: 0, wikiImagesApplied: 0 };
  }
  const upsert = db.prepare(`
    INSERT INTO mods (
      unique_name,
      name,
      polarity,
      rarity,
      type,
      compat_name,
      base_drain,
      fusion_limit,
      is_utility,
      is_augment,
      subtype,
      description,
      image_path,
      codex_secret,
      exclude_from_codex
    )
    VALUES (
      :unique_name,
      :name,
      :polarity,
      :rarity,
      :type,
      :compat_name,
      :base_drain,
      :fusion_limit,
      :is_utility,
      :is_augment,
      :subtype,
      :description,
      :image_path,
      :codex_secret,
      :exclude_from_codex
    )
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
      image_path = CASE
        WHEN mods.image_path LIKE '${ARMORY_WIKI_STANCE_IMAGE_SQL_PREFIX}%'
        THEN mods.image_path
        ELSE COALESCE(excluded.image_path, mods.image_path)
      END,
      codex_secret = excluded.codex_secret,
      exclude_from_codex = excluded.exclude_from_codex
  `);

  let found = 0;
  let insertedOrUpdated = 0;
  let wikiImagesApplied = 0;
  const updateImagePath = db.prepare(`UPDATE mods SET image_path = ? WHERE unique_name = ?`);

  for (const seed of seeds) {
    onProgress?.(`Overframe exalted stance sync: fetching ${seed.name} (${seed.id})`);
    const scraped = await fetchOverframeStance(seed);
    if (!scraped) continue;

    found += 1;
    let imagePath: string | null = null;
    if (scraped.texturePath) {
      try {
        imagePath = await ensureOverframeTextureInDataImages(scraped.texturePath);
      } catch (error) {
        console.warn(
          `[exaltedStanceMods] failed to cache image for ${seed.id}/${seed.slug}:`,
          error,
        );
      }
    }

    const result = upsert.run({
      unique_name: scraped.uniqueName,
      name: seed.name,
      polarity: 'AP_POWER',
      rarity: seed.rarity,
      type: 'STANCE',
      compat_name: seed.compatName,
      base_drain: -2,
      fusion_limit: 3,
      is_utility: 0,
      is_augment: 0,
      subtype: null,
      description: JSON.stringify([seed.description]),
      image_path: imagePath,
      codex_secret: 0,
      exclude_from_codex: 0,
    });
    if (result.changes > 0) {
      insertedOrUpdated += result.changes;
    }

    if (seed.wikiPageTitle) {
      const applied = await applyExaltedStanceWikiImages(
        seed,
        [scraped.uniqueName],
        updateImagePath,
        onProgress,
      );
      if (applied) wikiImagesApplied += 1;
    }
  }

  onProgress?.(
    `Overframe exalted stance sync complete: ${found} found, ${insertedOrUpdated} rows changed, wiki images ${wikiImagesApplied}`,
  );
  return { found, insertedOrUpdated, wikiImagesApplied };
}

export async function syncExaltedStanceWikiImagesOnly(
  onProgress?: (msg: string) => void,
): Promise<{ attempted: number; applied: number }> {
  const db = getCatalogDb();
  const selectUniques = db.prepare(
    `SELECT unique_name FROM mods WHERE name = ? AND upper(trim(type)) = 'STANCE'`,
  );
  const updateImagePath = db.prepare(`UPDATE mods SET image_path = ? WHERE unique_name = ?`);

  let attempted = 0;
  let applied = 0;

  for (const seed of EXALTED_STANCE_SEEDS) {
    if (!seed.wikiPageTitle) continue;

    const rows = selectUniques.all(seed.name) as Array<{ unique_name: string }>;
    if (!rows.length) {
      onProgress?.(`Wiki image skip (no STANCE row in DB): ${seed.name}`);
      continue;
    }

    attempted += 1;
    const imageApplied = await applyExaltedStanceWikiImages(
      seed,
      rows.map((row) => row.unique_name),
      updateImagePath,
      onProgress,
    );
    if (imageApplied) applied += 1;
  }

  onProgress?.(`Wiki-only exalted stance images complete: ${applied}/${attempted} applied`);
  return { attempted, applied };
}

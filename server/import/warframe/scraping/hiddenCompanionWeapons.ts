import fs from 'fs';
import path from 'path';

import { BEAST_CLAW_REGISTRY } from '../../../../shared/warframeImport/beastClawRegistry.js';
import { PROJECT_ROOT } from '../../../config.js';
import {
  beastClawsWikiRevisionChanged,
  writeStoredBeastClawsWikiRevision,
} from '../beastClawsWikiRevision.js';
import { getCatalogDb } from '../db/connection.js';
import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS, fetchBounded } from '../http/fetchWithTimeout.js';
import { safeImagePathUnderRoot } from '../safeImagePath.js';
import {
  BEAST_CLAWS_WIKI_PAGE,
  parseBeastClawsFromWikiHtml,
  serializeParsedBeastClawDamagePerShot,
} from './beastClawsWiki.js';
import { getWikiUserAgent } from './wikiUserAgent.js';

const WIKI_BASE = 'https://wiki.warframe.com';
const BEAST_CLAWS_ICON_PATH = '/icons/beast-claws.png';
const BEAST_CLAWS_ICON_FILE = 'beast-claws.png';

function ensureBeastClawsIconInDataImages(onProgress?: (msg: string) => void): void {
  const sourcePath = path.join(PROJECT_ROOT, 'icons', BEAST_CLAWS_ICON_FILE);
  const targetPath = safeImagePathUnderRoot(['icons', BEAST_CLAWS_ICON_FILE]);

  if (!fs.existsSync(sourcePath)) {
    onProgress?.(`Beast claws wiki sync: icon source not found at ${sourcePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  onProgress?.(`Beast claws wiki sync: icon copied to ${targetPath}`);
}

async function fetchBeastClawsWikiHtml(): Promise<string> {
  const { response, body } = await fetchBounded(
    `${WIKI_BASE}/w/${BEAST_CLAWS_WIKI_PAGE}`,
    {
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': getWikiUserAgent(),
      },
    },
    FETCH_TIMEOUT_MS.wikiFetch,
    FETCH_BYTE_LIMITS.html,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch beast claws wiki page: ${response.status} ${response.statusText}`,
    );
  }

  return body.toString('utf-8');
}

export function beastClawsNeedSync(onlyMissing: boolean): boolean {
  if (!onlyMissing) return true;

  const db = getCatalogDb();
  for (const entry of BEAST_CLAW_REGISTRY) {
    const row = db
      .prepare(`SELECT damage_per_shot FROM weapons WHERE unique_name = ?`)
      .get(entry.uniqueName) as { damage_per_shot: string | null } | undefined;

    if (!row?.damage_per_shot) {
      return true;
    }
  }

  return false;
}

export async function syncBeastClawsFromWiki(
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<{ insertedOrUpdated: number; found: number; revisionId: string | null }> {
  ensureBeastClawsIconInDataImages(onProgress);
  onProgress?.(`Beast claws wiki sync: fetching ${BEAST_CLAWS_WIKI_PAGE}`);

  const html = await fetchBeastClawsWikiHtml();
  const parsed = parseBeastClawsFromWikiHtml(html);

  if (
    onlyMissing &&
    parsed.revisionId &&
    !beastClawsWikiRevisionChanged(parsed.revisionId) &&
    !beastClawsNeedSync(true)
  ) {
    onProgress?.(`Beast claws wiki sync: wiki revision ${parsed.revisionId} unchanged; skipped.`);
    return { insertedOrUpdated: 0, found: parsed.rows.length, revisionId: parsed.revisionId };
  }

  if (parsed.rows.length === 0) {
    throw new Error('Beast claws wiki sync: no claw stat rows parsed from wiki page.');
  }

  const db = getCatalogDb();
  const upsert = db.prepare(`
    INSERT INTO weapons (
      unique_name,
      name,
      product_category,
      slot,
      mastery_req,
      total_damage,
      damage_per_shot,
      critical_chance,
      critical_multiplier,
      proc_chance,
      sentinel,
      image_path,
      artifact_slots
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_name) DO UPDATE SET
      name = excluded.name,
      product_category = excluded.product_category,
      slot = excluded.slot,
      total_damage = excluded.total_damage,
      damage_per_shot = excluded.damage_per_shot,
      critical_chance = excluded.critical_chance,
      critical_multiplier = excluded.critical_multiplier,
      proc_chance = excluded.proc_chance,
      sentinel = excluded.sentinel,
      image_path = excluded.image_path,
      artifact_slots = COALESCE(weapons.artifact_slots, excluded.artifact_slots)
  `);

  let insertedOrUpdated = 0;
  for (const row of parsed.rows) {
    const result = upsert.run(
      row.uniqueName,
      row.clawsName,
      'SentinelWeapons',
      5,
      0,
      row.totalDamage,
      serializeParsedBeastClawDamagePerShot(row),
      row.criticalChance,
      row.criticalMultiplier,
      row.procChance,
      1,
      BEAST_CLAWS_ICON_PATH,
      null,
    );
    if (result.changes > 0) insertedOrUpdated += result.changes;
  }

  if (parsed.revisionId) {
    writeStoredBeastClawsWikiRevision(parsed.revisionId);
  }

  onProgress?.(
    `Beast claws wiki sync complete: ${parsed.rows.length} parsed, ${insertedOrUpdated} rows changed` +
      (parsed.revisionId ? ` (revision ${parsed.revisionId})` : ''),
  );

  return {
    insertedOrUpdated,
    found: parsed.rows.length,
    revisionId: parsed.revisionId,
  };
}

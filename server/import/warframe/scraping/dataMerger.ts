import { getCatalogDb } from '../db/connection.js';
import type { ScrapedItemData } from './itemScraper.js';

interface AbilityTypeEntry {
  path?: string;
  LocalizeTag: string;
  IsHelminth?: number;
}

export interface MergeResult {
  warframesUpdated: number;
  weaponsUpdated: number;
  companionsUpdated: number;
  helminthUpdated: number;
}

export function mergeScrapedData(
  items: ScrapedItemData[],
  onProgress?: (msg: string) => void,
): MergeResult {
  const db = getCatalogDb();
  const result: MergeResult = {
    warframesUpdated: 0,
    weaponsUpdated: 0,
    companionsUpdated: 0,
    helminthUpdated: 0,
  };

  const updateWarframe = db.prepare(
    'UPDATE warframes SET artifact_slots = ? WHERE unique_name = ?',
  );
  const updateWeapon = db.prepare(
    'UPDATE weapons SET artifact_slots = ?, fire_behaviors = ? WHERE unique_name = ?',
  );
  const updateCompanion = db.prepare(
    'UPDATE companions SET artifact_slots = ? WHERE unique_name = ?',
  );
  const updateAbilityHelminth = db.prepare(
    'UPDATE abilities SET is_helminth_extractable = MAX(is_helminth_extractable, ?) WHERE unique_name = ?',
  );

  const findTable = db.prepare(
    `SELECT 'warframes' AS tbl FROM warframes WHERE unique_name = ?
     UNION ALL
     SELECT 'weapons' FROM weapons WHERE unique_name = ?
     UNION ALL
     SELECT 'companions' FROM companions WHERE unique_name = ?`,
  );

  const mergeAll = db.transaction(() => {
    for (const item of items) {
      const uniqueName = item.entry.dbUniqueName;
      if (!uniqueName) continue;

      const rows = findTable.all(uniqueName, uniqueName, uniqueName) as {
        tbl: string;
      }[];
      const table = rows[0]?.tbl;

      if (!table) {
        onProgress?.(`No DB row found for ${item.entry.name} (${uniqueName}), skipping`);
        continue;
      }

      const artifactSlotsJson = JSON.stringify(item.artifactSlots);

      if (table === 'warframes') {
        const changes = updateWarframe.run(artifactSlotsJson, uniqueName);
        if (changes.changes > 0) result.warframesUpdated++;
      } else if (table === 'weapons') {
        const fireBehaviorsJson = JSON.stringify(item.fireBehaviors);
        const changes = updateWeapon.run(artifactSlotsJson, fireBehaviorsJson, uniqueName);
        if (changes.changes > 0) result.weaponsUpdated++;
      } else if (table === 'companions') {
        const changes = updateCompanion.run(artifactSlotsJson, uniqueName);
        if (changes.changes > 0) result.companionsUpdated++;
      }

      if (item.itemData) {
        const abilityTypes = (item.itemData as Record<string, unknown>).AbilityTypes as
          | AbilityTypeEntry[]
          | undefined;

        if (abilityTypes) {
          for (const abilityType of abilityTypes) {
            const abilityPath = abilityType.path;
            if (!abilityPath) continue;

            const isHelminth = Number(abilityType.IsHelminth) === 1 ? 1 : 0;
            const helminthChanges = updateAbilityHelminth.run(isHelminth, abilityPath);
            if (helminthChanges.changes > 0) result.helminthUpdated++;
          }
        }
      }

      onProgress?.(`Merged ${item.entry.name} (${table})`);
    }
  });

  mergeAll();
  return result;
}

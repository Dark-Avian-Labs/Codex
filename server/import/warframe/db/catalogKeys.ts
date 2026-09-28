import type Database from 'better-sqlite3';

import {
  type ArchonColor,
  ARCHON_COLORS,
  archonSlugForSortOrder,
  buildArchonShardKey,
} from '../../../../shared/warframeImport/archonShardRegistry.js';
import { helminthEntryByDePath } from '../../../../shared/warframeImport/helminthRegistry.js';

export function backfillArchonBuffArmoryKeys(db: Database.Database): number {
  const types = db.prepare('SELECT id, name FROM archon_shard_types').all() as Array<{
    id: number;
    name: string;
  }>;
  const typeNameById = new Map(types.map((t) => [t.id, t.name]));

  const buffs = db
    .prepare('SELECT id, shard_type_id, sort_order FROM archon_shard_buffs')
    .all() as Array<{ id: number; shard_type_id: number; sort_order: number }>;

  const update = db.prepare('UPDATE archon_shard_buffs SET armory_key = ? WHERE id = ?');
  let updated = 0;

  const tx = db.transaction(() => {
    for (const buff of buffs) {
      const colorName = typeNameById.get(buff.shard_type_id);
      if (!colorName || !ARCHON_COLORS.includes(colorName as ArchonColor)) continue;
      const color = colorName as ArchonColor;
      const slug = archonSlugForSortOrder(color, buff.sort_order);
      if (!slug) continue;
      const armoryKey = buildArchonShardKey(color, 'Common', slug);
      update.run(armoryKey, buff.id);
      updated++;
    }
  });
  tx();
  return updated;
}

export function backfillHelminthArmoryKeys(db: Database.Database): number {
  const rows = db
    .prepare(
      `SELECT unique_name FROM abilities WHERE is_helminth_extractable = 1 AND armory_helminth_key IS NULL`,
    )
    .all() as Array<{ unique_name: string }>;

  const update = db.prepare('UPDATE abilities SET armory_helminth_key = ? WHERE unique_name = ?');
  let updated = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      const entry = helminthEntryByDePath(row.unique_name);
      if (!entry) continue;
      update.run(entry.armory_key, row.unique_name);
      updated++;
    }
  });
  tx();
  return updated;
}

export function catalogArmoryKeyForArchonBuff(typeName: string, sortOrder: number): string | null {
  if (!ARCHON_COLORS.includes(typeName as ArchonColor)) return null;
  const slug = archonSlugForSortOrder(typeName as ArchonColor, sortOrder);
  if (!slug) return null;
  return buildArchonShardKey(typeName as ArchonColor, 'Common', slug);
}

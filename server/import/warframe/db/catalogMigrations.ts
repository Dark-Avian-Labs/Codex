import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ? LIMIT 1`)
    .get(table, column);
  return row != null;
}

export function ensureCatalogKeyColumns(db: Database.Database): void {
  if (!hasColumn(db, 'archon_shard_buffs', 'armory_key')) {
    db.exec('ALTER TABLE archon_shard_buffs ADD COLUMN armory_key TEXT');
  }

  if (!hasColumn(db, 'abilities', 'armory_helminth_key')) {
    db.exec('ALTER TABLE abilities ADD COLUMN armory_helminth_key TEXT');
  }

  if (!hasColumn(db, 'mods', 'foil_overlay_path')) {
    db.exec('ALTER TABLE mods ADD COLUMN foil_overlay_path TEXT');
  }

  if (
    hasColumn(db, 'mods', 'atagraph_card_path') &&
    !hasColumn(db, 'mods', 'atragraph_card_path')
  ) {
    db.exec('ALTER TABLE mods RENAME COLUMN atagraph_card_path TO atragraph_card_path');
  } else if (!hasColumn(db, 'mods', 'atragraph_card_path')) {
    db.exec('ALTER TABLE mods ADD COLUMN atragraph_card_path TEXT');
  }

  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_archon_shard_buffs_armory_key ON archon_shard_buffs(armory_key)',
  );
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_abilities_armory_helminth_key ON abilities(armory_helminth_key)',
  );
}

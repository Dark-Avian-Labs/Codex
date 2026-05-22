import type Database from 'better-sqlite3';

export const LEGACY_USER_ID_TO_CLERK: Record<number, string> = {
  1: 'user_3E4yXj9u7Uoeqqoqmz4lK8iPJZ7',
  4: 'user_3E5AHLxJYueYPSDlgnc8uSDmV8O',
  5: 'user_3E589BCZwizVbtn5WTIx1GLvuPr',
};

const SQL_IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

type ClerkTableMigration = {
  migrationTable: string;
  createMigrationTable: string;
  copyRows: string;
  indexes: string[];
};

const CLERK_TABLE_MIGRATIONS: Record<string, ClerkTableMigration> = {
  worksheets: {
    migrationTable: 'worksheets_clerk_migration',
    createMigrationTable: `CREATE TABLE worksheets_clerk_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(clerk_user_id, name)
    )`,
    copyRows: `INSERT INTO worksheets_clerk_migration (id, clerk_user_id, name, display_order)
      SELECT id, clerk_user_id, name, display_order FROM worksheets
      WHERE clerk_user_id IS NOT NULL AND trim(clerk_user_id) <> ''`,
    indexes: ['CREATE INDEX IF NOT EXISTS idx_worksheets_clerk_user ON worksheets(clerk_user_id)'],
  },
  game_accounts: {
    migrationTable: 'game_accounts_clerk_migration',
    createMigrationTable: `CREATE TABLE game_accounts_clerk_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clerk_user_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(clerk_user_id, account_name)
    )`,
    copyRows: `INSERT INTO game_accounts_clerk_migration (id, clerk_user_id, account_name, is_active, created_at)
      SELECT id, clerk_user_id, account_name, is_active, created_at FROM game_accounts
      WHERE clerk_user_id IS NOT NULL AND trim(clerk_user_id) <> ''`,
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_game_accounts_clerk_user ON game_accounts(clerk_user_id)',
    ],
  },
};

function assertSqlIdentifier(value: string, label: string): void {
  if (!value || !SQL_IDENTIFIER_RE.test(value)) {
    throw new Error(`${label} must be a non-empty alphanumeric/underscore identifier`);
  }
}

function tableHasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return cols.some((c) => c.name === columnName);
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return row != null;
}

function backfillClerkUserIds(
  db: Database.Database,
  tableName: string,
  legacyUserIdColumn: string,
): void {
  const update = db.prepare(
    `UPDATE ${tableName}
     SET clerk_user_id = ?
     WHERE ${legacyUserIdColumn} = ?
       AND (clerk_user_id IS NULL OR trim(clerk_user_id) = '')`,
  );
  for (const [legacyId, clerkId] of Object.entries(LEGACY_USER_ID_TO_CLERK)) {
    update.run(clerkId, Number(legacyId));
  }
}

function rebuildTableWithoutLegacyUserId(
  db: Database.Database,
  tableName: string,
  spec: ClerkTableMigration,
): void {
  assertSqlIdentifier(spec.migrationTable, 'migrationTable');
  if (tableExists(db, spec.migrationTable)) {
    db.exec(`DROP TABLE ${spec.migrationTable}`);
  }

  const previousForeignKeys = db.pragma('foreign_keys', { simple: true }) as 0 | 1;
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.prepare(
      `DELETE FROM ${tableName} WHERE clerk_user_id IS NULL OR trim(clerk_user_id) = ''`,
    ).run();
    db.exec(spec.createMigrationTable);
    db.exec(spec.copyRows);
    db.exec(`DROP TABLE ${tableName}`);
    db.exec(`ALTER TABLE ${spec.migrationTable} RENAME TO ${tableName}`);
    for (const indexSql of spec.indexes) {
      db.exec(indexSql);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.pragma(`foreign_keys = ${previousForeignKeys ? 'ON' : 'OFF'}`);
  }
}

function completeClerkUserIdMigration(
  db: Database.Database,
  tableName: string,
  legacyUserIdColumn: string,
): void {
  if (!tableHasColumn(db, tableName, legacyUserIdColumn)) return;

  const spec = CLERK_TABLE_MIGRATIONS[tableName];
  if (spec) {
    rebuildTableWithoutLegacyUserId(db, tableName, spec);
    return;
  }

  db.prepare(
    `DELETE FROM ${tableName} WHERE clerk_user_id IS NULL OR trim(clerk_user_id) = ''`,
  ).run();
  db.exec(`ALTER TABLE ${tableName} DROP COLUMN ${legacyUserIdColumn}`);
}

export function ensureClerkUserIdColumn(
  db: Database.Database,
  tableName: string,
  legacyUserIdColumn = 'user_id',
): void {
  assertSqlIdentifier(tableName, 'tableName');
  assertSqlIdentifier(legacyUserIdColumn, 'legacyUserIdColumn');

  if (!tableHasColumn(db, tableName, legacyUserIdColumn)) {
    return;
  }

  if (!tableHasColumn(db, tableName, 'clerk_user_id')) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN clerk_user_id TEXT`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_clerk_user ON ${tableName}(clerk_user_id)`,
    );
  }

  backfillClerkUserIds(db, tableName, legacyUserIdColumn);
  completeClerkUserIdMigration(db, tableName, legacyUserIdColumn);
}

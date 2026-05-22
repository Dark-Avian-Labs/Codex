import type Database from 'better-sqlite3';

export const LEGACY_USER_ID_TO_CLERK: Record<number, string> = {
  1: 'user_3E4yXj9u7Uoeqqoqmz4lK8iPJZ7',
  4: 'user_3E5AHLxJYueYPSDlgnc8uSDmV8O',
  5: 'user_3E589BCZwizVbtn5WTIx1GLvuPr',
};

const SQL_IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

function assertSqlIdentifier(value: string, label: string): void {
  if (!value || !SQL_IDENTIFIER_RE.test(value)) {
    throw new Error(`${label} must be a non-empty alphanumeric/underscore identifier`);
  }
}

export function ensureClerkUserIdColumn(
  db: Database.Database,
  tableName: string,
  legacyUserIdColumn = 'user_id',
): void {
  assertSqlIdentifier(tableName, 'tableName');
  assertSqlIdentifier(legacyUserIdColumn, 'legacyUserIdColumn');

  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  const hasClerk = cols.some((c) => c.name === 'clerk_user_id');
  const hasLegacy = cols.some((c) => c.name === legacyUserIdColumn);
  if (hasClerk || !hasLegacy) return;

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN clerk_user_id TEXT`);
  const update = db.prepare(
    `UPDATE ${tableName} SET clerk_user_id = ? WHERE ${legacyUserIdColumn} = ?`,
  );
  for (const [legacyId, clerkId] of Object.entries(LEGACY_USER_ID_TO_CLERK)) {
    update.run(clerkId, Number(legacyId));
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_clerk_user ON ${tableName}(clerk_user_id)`);
}

import Database from 'better-sqlite3';

import { isHelminthValue, isValidStatus, VALID_STATUSES } from '../config.js';

export interface Worksheet {
  id: number;
  name: string;
}

export interface Column {
  id: number;
  name: string;
  worksheet_id?: number;
  display_order?: number;
}

export interface DataRow {
  id: number;
  name: string;
  values: Record<number, string>;
}

export interface WorksheetData {
  worksheet: Worksheet & { display_order?: number };
  columns: Column[];
  rows: DataRow[];
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export function getUserByUsername(
  db: Database.Database,
  username: string,
): User | undefined {
  const row = db
    .prepare(
      'SELECT id, username, password_hash, is_admin, created_at FROM users WHERE username = ?',
    )
    .get(username) as User | undefined;
  return row;
}

export function createUser(
  db: Database.Database,
  username: string,
  passwordHash: string,
  isAdmin: boolean,
): { id: number; inserted: boolean } {
  const r = db
    .prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
    )
    .run(username, passwordHash, isAdmin ? 1 : 0);

  if (r.changes > 0) {
    const id = Number(r.lastInsertRowid);
    return { id, inserted: true };
  }

  const row = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username) as { id: number } | undefined;
  if (row === undefined) {
    throw new Error(
      'createUser: INSERT OR IGNORE reported no new row but SELECT found no existing user; database may be inconsistent.',
    );
  }
  return { id: row.id, inserted: false };
}

export function getUserById(
  db: Database.Database,
  userId: number,
): User | undefined {
  return db
    .prepare(
      'SELECT id, username, password_hash, is_admin, created_at FROM users WHERE id = ?',
    )
    .get(userId) as User | undefined;
}

export function deleteUser(db: Database.Database, userId: number): boolean {
  const r = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return r.changes > 0;
}

export function updateUserPassword(
  db: Database.Database,
  userId: number,
  passwordHash: string,
): boolean {
  const r = db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(passwordHash, userId);
  return r.changes > 0;
}

export function getAllUsers(db: Database.Database): {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
  account_count: number;
}[] {
  return db
    .prepare(
      `
    SELECT u.id, u.username, u.is_admin, u.created_at, 0 as account_count
    FROM users u
    ORDER BY u.created_at ASC
  `,
    )
    .all() as {
    id: number;
    username: string;
    is_admin: number;
    created_at: string;
    account_count: number;
  }[];
}

export function userExists(db: Database.Database, username: string): boolean {
  const row = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username);
  return !!row;
}

export function getWorksheets(db: Database.Database): Worksheet[] {
  const stmt = db.prepare(
    'SELECT id, name FROM worksheets ORDER BY display_order',
  );
  return stmt.all() as Worksheet[];
}

export function getWorksheetById(
  db: Database.Database,
  id: number,
): (Worksheet & { display_order: number }) | undefined {
  const stmt = db.prepare(
    'SELECT id, name, display_order FROM worksheets WHERE id = ?',
  );
  return stmt.get(id) as (Worksheet & { display_order: number }) | undefined;
}

export function getFirstWorksheetId(db: Database.Database): number | null {
  const row = db
    .prepare('SELECT id FROM worksheets ORDER BY display_order LIMIT 1')
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function getColumnById(
  db: Database.Database,
  columnId: number,
): { id: number; name: string; worksheet_id: number } | undefined {
  return db
    .prepare('SELECT id, name, worksheet_id FROM columns WHERE id = ?')
    .get(columnId) as
    | { id: number; name: string; worksheet_id: number }
    | undefined;
}

export function getWorksheetColumns(
  db: Database.Database,
  worksheetId: number,
): { id: number; name: string }[] {
  return db
    .prepare(
      'SELECT id, name FROM columns WHERE worksheet_id = ? ORDER BY display_order',
    )
    .all(worksheetId) as { id: number; name: string }[];
}

export function getRowWorksheetId(
  db: Database.Database,
  rowId: number,
): number | null {
  const row = db
    .prepare('SELECT worksheet_id FROM rows WHERE id = ?')
    .get(rowId) as { worksheet_id: number } | undefined;
  return row?.worksheet_id ?? null;
}

const HELMINTH_COLUMN_NAME = 'Helminth';
const WARFRAMES_WORKSHEET_NAME = 'Warframes';

/** Ensures the Warframes worksheet has a "Helminth" column; creates it and backfills '' if missing. */
export function ensureHelminthColumn(
  db: Database.Database,
  worksheetId: number,
  worksheetName: string,
): void {
  if (worksheetName !== WARFRAMES_WORKSHEET_NAME) return;

  db.exec('BEGIN');
  try {
    const existing = db
      .prepare('SELECT id FROM columns WHERE worksheet_id = ? AND name = ?')
      .get(worksheetId, HELMINTH_COLUMN_NAME);
    if (existing) {
      db.exec('COMMIT');
      return;
    }

    const maxOrder = db
      .prepare(
        'SELECT MAX(display_order) as max_order FROM columns WHERE worksheet_id = ?',
      )
      .get(worksheetId) as { max_order: number | null };
    const displayOrder = (maxOrder?.max_order ?? -1) + 1;
    const insertCol = db.prepare(
      'INSERT INTO columns (worksheet_id, name, display_order) VALUES (?, ?, ?)',
    );
    const colResult = insertCol.run(
      worksheetId,
      HELMINTH_COLUMN_NAME,
      displayOrder,
    );
    const columnId = Number(colResult.lastInsertRowid);

    const rows = db
      .prepare('SELECT id FROM rows WHERE worksheet_id = ?')
      .all(worksheetId) as { id: number }[];
    const insertCell = db.prepare(
      'INSERT INTO cell_values (row_id, column_id, value) VALUES (?, ?, ?)',
    );
    for (const row of rows) {
      insertCell.run(row.id, columnId, '');
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getWorksheetData(
  db: Database.Database,
  worksheetId: number,
): WorksheetData | null {
  const worksheet = getWorksheetById(db, worksheetId);
  if (!worksheet) return null;

  const columns = db
    .prepare(
      'SELECT id, name FROM columns WHERE worksheet_id = ? ORDER BY display_order',
    )
    .all(worksheetId) as Column[];

  const rows = db
    .prepare(
      `
    SELECT id, item_name as name, display_order
    FROM rows
    WHERE worksheet_id = ?
    ORDER BY display_order
  `,
    )
    .all(worksheetId) as { id: number; name: string; display_order: number }[];

  const cellRows = db
    .prepare(
      `
    SELECT cv.row_id, cv.column_id, cv.value
    FROM cell_values cv
    JOIN rows r ON cv.row_id = r.id
    WHERE r.worksheet_id = ?
  `,
    )
    .all(worksheetId) as { row_id: number; column_id: number; value: string }[];

  const cellLookup: Record<number, Record<number, string>> = {};
  for (const c of cellRows) {
    if (!cellLookup[c.row_id]) cellLookup[c.row_id] = {};
    cellLookup[c.row_id][c.column_id] = c.value;
  }

  const dataRows: DataRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    values: columns.reduce<Record<number, string>>((acc, col) => {
      acc[col.id] = cellLookup[r.id]?.[col.id] ?? '';
      return acc;
    }, {}),
  }));

  return {
    worksheet: { ...worksheet, display_order: worksheet.display_order },
    columns,
    rows: dataRows,
  };
}

export function updateCell(
  db: Database.Database,
  rowId: number,
  columnId: number,
  value: string,
): void {
  const stmt = db.prepare(`
    INSERT INTO cell_values (row_id, column_id, value)
    VALUES (?, ?, ?)
    ON CONFLICT(row_id, column_id) DO UPDATE SET value = excluded.value
  `);
  stmt.run(rowId, columnId, value);
}

export function getCellValue(
  db: Database.Database,
  rowId: number,
  columnId: number,
): string | undefined {
  const row = db
    .prepare('SELECT value FROM cell_values WHERE row_id = ? AND column_id = ?')
    .get(rowId, columnId) as { value: string } | undefined;
  return row?.value;
}

export function addRow(
  db: Database.Database,
  worksheetId: number,
  itemName: string,
  values: Record<number, string>,
): number {
  const maxOrder = db
    .prepare(
      'SELECT MAX(display_order) as max_order FROM rows WHERE worksheet_id = ?',
    )
    .get(worksheetId) as { max_order: number | null };
  const displayOrder = (maxOrder?.max_order ?? -1) + 1;

  const insertRow = db.prepare(
    'INSERT INTO rows (worksheet_id, item_name, display_order) VALUES (?, ?, ?)',
  );
  const result = insertRow.run(worksheetId, itemName, displayOrder);
  const rowId = result.lastInsertRowid as number;

  const worksheetColumns = getWorksheetColumns(db, worksheetId);
  const insertCell = db.prepare(
    'INSERT INTO cell_values (row_id, column_id, value) VALUES (?, ?, ?)',
  );

  for (const col of worksheetColumns) {
    let v = values[col.id] ?? '';
    if (col.name === HELMINTH_COLUMN_NAME) {
      if (!isHelminthValue(v)) v = '';
    } else if (!isValidStatus(v)) {
      v = '';
    }
    insertCell.run(rowId, col.id, v);
  }

  return rowId;
}

export function editRow(
  db: Database.Database,
  rowId: number,
  itemName: string | null,
  values: Record<number, string>,
): boolean {
  const exists = db.prepare('SELECT id FROM rows WHERE id = ?').get(rowId);
  if (!exists) return false;

  if (itemName !== null && itemName.trim() !== '') {
    db.prepare('UPDATE rows SET item_name = ? WHERE id = ?').run(
      itemName.trim(),
      rowId,
    );
  }

  const upsert = db.prepare(`
    INSERT INTO cell_values (row_id, column_id, value)
    VALUES (?, ?, ?)
    ON CONFLICT(row_id, column_id) DO UPDATE SET value = excluded.value
  `);

  for (const [colIdStr, value] of Object.entries(values)) {
    const colId = parseInt(colIdStr, 10);
    const col = getColumnById(db, colId);
    const v =
      col?.name === HELMINTH_COLUMN_NAME
        ? isHelminthValue(value)
          ? value
          : ''
        : isValidStatus(value)
          ? value
          : '';
    upsert.run(rowId, colId, v);
  }

  return true;
}

export function deleteRow(db: Database.Database, rowId: number): boolean {
  db.prepare('DELETE FROM cell_values WHERE row_id = ?').run(rowId);
  const result = db.prepare('DELETE FROM rows WHERE id = ?').run(rowId);
  return result.changes > 0;
}

export function adminUpdateCell(
  db: Database.Database,
  rowId: number,
  columnId: number,
  value: string,
): void {
  const col = getColumnById(db, columnId);
  const valid =
    col?.name === HELMINTH_COLUMN_NAME
      ? isHelminthValue(value)
      : isValidStatus(value);
  if (!valid) throw new Error('Invalid status value');
  const stmt = db.prepare(`
    INSERT INTO cell_values (row_id, column_id, value)
    VALUES (?, ?, ?)
    ON CONFLICT(row_id, column_id) DO UPDATE SET value = excluded.value
  `);
  stmt.run(rowId, columnId, value);
}

export { VALID_STATUSES };

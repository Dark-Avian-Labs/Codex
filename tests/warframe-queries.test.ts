import { warframeQueries } from '@codex/game-warframe';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { describeWithSqlite } from './helpers/describeWithSqlite.js';
import {
  createTempDbDir,
  createWarframeTestDb,
  removeTempDbDir,
  seedMinimalWarframeFixture,
  type WarframeTestDb,
} from './helpers/sqliteTestHarness.js';

const { updateCell, addRow, deleteRow } = warframeQueries;

describeWithSqlite('warframeQueries', () => {
  let harness: WarframeTestDb;
  let fixture: ReturnType<typeof seedMinimalWarframeFixture>;

  beforeEach(() => {
    const { dbPath } = createTempDbDir('codex-queries-');
    harness = createWarframeTestDb(dbPath);
    fixture = seedMinimalWarframeFixture(harness.db);
  });

  afterEach(() => {
    harness.closeDb();
    removeTempDbDir(harness.tmpDir);
  });

  it('updateCell writes a valid status value', () => {
    const changes = updateCell(harness.db, fixture.rowId, fixture.columnId, 'Obtained', fixture.clerkUserId);
    expect(changes).toBeGreaterThan(0);
    const value = harness.db
      .prepare('SELECT value FROM cell_values WHERE row_id = ? AND column_id = ?')
      .get(fixture.rowId, fixture.columnId) as { value: string } | undefined;
    expect(value?.value).toBe('Obtained');
  });

  it('updateCell throws for wrong clerk_user_id', () => {
    expect(() => updateCell(harness.db, fixture.rowId, fixture.columnId, 'Obtained', 'other_user')).toThrow(
      /Row not found/,
    );
  });

  it('addRow creates row and default cells', () => {
    const rowId = addRow(harness.db, fixture.worksheetId, fixture.clerkUserId, 'Mag', {});
    expect(rowId).toBeGreaterThan(0);
    const count = harness.db.prepare('SELECT COUNT(*) as count FROM cell_values WHERE row_id = ?').get(rowId) as {
      count: number;
    };
    expect(count.count).toBeGreaterThan(0);
  });

  it('deleteRow removes only owner rows', () => {
    expect(deleteRow(harness.db, fixture.rowId, 'other_user')).toBe(false);
    const existingRow = harness.db.prepare('SELECT id FROM rows WHERE id = ?').get(fixture.rowId);
    expect(existingRow).toBeDefined();

    expect(deleteRow(harness.db, fixture.rowId, fixture.clerkUserId)).toBe(true);
    const deletedRow = harness.db.prepare('SELECT id FROM rows WHERE id = ?').get(fixture.rowId);
    expect(deletedRow).toBeUndefined();
  });
});

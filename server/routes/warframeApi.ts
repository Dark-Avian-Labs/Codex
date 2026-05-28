import fs from 'fs';

import { log, requireCodexAdmin } from '@codex/core';
import { validateBody } from '@codex/core/validation';
import {
  HELMINTH_VALUES,
  VALID_STATUSES,
  WARFRAME_DB_PATH,
  getWarframeDb,
  isHelminthValue,
  isValidHelminthCellValue,
  isValidStatus,
  warframeAddRowSchema,
  warframeAdminUpdateSchema,
  warframeDeleteRowSchema,
  warframeEditRowSchema,
  warframeUpdateAdvancedProgressSchema,
  warframeQueries as q,
  warframeUpdateSchema,
} from '@codex/game-warframe';
import { Router, type Response } from 'express';

import { requireClerkUserId } from '../auth/clerkUser.js';
import { provisionWarframeUserIfNeeded } from '../services/warframeProvision.js';
import { runWarframeSync } from '../services/warframeSync.js';
import { runWarframeSyncGuarded, SyncAlreadyRunningError } from '../services/warframeSyncState.js';

export const warframeApiRouter = Router();

function ensureWarframeUserSettingsTable(db: ReturnType<typeof getWarframeDb>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      clerk_user_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (clerk_user_id, setting_key)
    );
  `);
}

async function getDbOrFail(res: Response): Promise<ReturnType<typeof getWarframeDb> | null> {
  try {
    await fs.promises.access(WARFRAME_DB_PATH);
  } catch {
    res.status(500).json({ error: 'Database not found.' });
    return null;
  }
  try {
    return getWarframeDb();
  } catch (error) {
    console.error('Failed to open Warframe database connection:', error);
    res.status(500).json({ error: 'Database connection failed.' });
    return null;
  }
}

const CELL_PATCH_ALLOWED_STATUSES = VALID_STATUSES.filter((status) => status !== 'Unavailable');
const SETTING_HIDE_COMPLETED = 'hide_completed';
const SETTING_MARKET_LINKS = 'market_links';
const SETTING_ADVANCED_MODE = 'advanced_mode';
const SETTING_SHOW_ALL_VARIANTS = 'show_all_variants';

type ValidateColumnValuesInvalidEntry = {
  column_id: string;
  value: string;
  reason: string;
  allowed: readonly string[];
};

function validateColumnValues(
  valuesRaw: Record<string, string>,
  columns: { id: number; name: string }[],
  itemNameForHelminth?: string,
): {
  valid: Record<number, string>;
  invalid: ValidateColumnValuesInvalidEntry[];
} {
  const valid: Record<number, string> = {};
  const invalid: ValidateColumnValuesInvalidEntry[] = [];
  for (const [key, value] of Object.entries(valuesRaw)) {
    const id = parseInt(key, 10);
    if (Number.isNaN(id)) {
      invalid.push({
        column_id: key,
        value,
        reason: 'invalid column_id (must be a number)',
        allowed: [],
      });
      continue;
    }
    const col = columns.find((column) => column.id === id);
    if (!col) {
      invalid.push({
        column_id: key,
        value,
        reason: 'unknown column for this worksheet',
        allowed: columns.map((column) => String(column.id)),
      });
      continue;
    }
    const validValue =
      col.name === 'Helminth'
        ? itemNameForHelminth !== undefined
          ? isValidHelminthCellValue(itemNameForHelminth, value)
          : isHelminthValue(value)
        : isValidStatus(value);
    if (!validValue) {
      invalid.push({
        column_id: key,
        value,
        reason:
          col.name === 'Helminth' ? 'invalid value for Helminth column' : 'invalid status value',
        allowed:
          col.name === 'Helminth' ? [...HELMINTH_VALUES, 'Unavailable'] : [...VALID_STATUSES],
      });
    } else {
      valid[id] = value;
    }
  }
  return { valid, invalid };
}

warframeApiRouter.get('/worksheets', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      provisionWarframeUserIfNeeded(db, clerkUserId);
      const worksheets = await q.getWorksheets(db, clerkUserId);
      res.status(200).json({ worksheets });
    } catch (error) {
      console.error('Failed to fetch worksheets:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  })();
});

warframeApiRouter.get('/settings', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      ensureWarframeUserSettingsTable(db);
      const sel = db.prepare(
        `SELECT setting_value FROM user_settings
         WHERE clerk_user_id = ? AND setting_key = ?`,
      );
      const hideRow = sel.get(clerkUserId, SETTING_HIDE_COMPLETED) as
        | { setting_value: string }
        | undefined;
      const marketRow = sel.get(clerkUserId, SETTING_MARKET_LINKS) as
        | { setting_value: string }
        | undefined;
      const advancedRow = sel.get(clerkUserId, SETTING_ADVANCED_MODE) as
        | { setting_value: string }
        | undefined;
      const showAllVariantsRow = sel.get(clerkUserId, SETTING_SHOW_ALL_VARIANTS) as
        | { setting_value: string }
        | undefined;
      res.status(200).json({
        hide_completed: hideRow?.setting_value === '1',
        market_links: marketRow?.setting_value === '1',
        advanced_mode: advancedRow?.setting_value === '1',
        show_all_variants: showAllVariantsRow?.setting_value === '1',
      });
    } catch (error) {
      console.error('Failed to load Warframe settings:', error);
      res.status(500).json({ error: 'Failed to load settings.' });
    }
  })();
});

warframeApiRouter.patch('/settings', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const hideProvided = typeof req.body?.hide_completed === 'boolean';
    const marketProvided = typeof req.body?.market_links === 'boolean';
    const advancedProvided = typeof req.body?.advanced_mode === 'boolean';
    const showAllVariantsProvided = typeof req.body?.show_all_variants === 'boolean';
    if (!hideProvided && !marketProvided && !advancedProvided && !showAllVariantsProvided) {
      res.status(400).json({
        error:
          'Provide at least one of hide_completed, market_links, advanced_mode, show_all_variants as a boolean.',
      });
      return;
    }
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      ensureWarframeUserSettingsTable(db);
      const upsert = db.prepare(
        `INSERT INTO user_settings (clerk_user_id, setting_key, setting_value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(clerk_user_id, setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = datetime('now')`,
      );
      if (hideProvided) {
        upsert.run(
          clerkUserId,
          SETTING_HIDE_COMPLETED,
          (req.body.hide_completed as boolean) ? '1' : '0',
        );
      }
      if (marketProvided) {
        upsert.run(
          clerkUserId,
          SETTING_MARKET_LINKS,
          (req.body.market_links as boolean) ? '1' : '0',
        );
      }
      if (advancedProvided) {
        upsert.run(
          clerkUserId,
          SETTING_ADVANCED_MODE,
          (req.body.advanced_mode as boolean) ? '1' : '0',
        );
      }
      if (showAllVariantsProvided) {
        upsert.run(
          clerkUserId,
          SETTING_SHOW_ALL_VARIANTS,
          (req.body.show_all_variants as boolean) ? '1' : '0',
        );
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to save Warframe settings:', error);
      res.status(500).json({ error: 'Failed to save settings.' });
    }
  })();
});

warframeApiRouter.get('/worksheets/:worksheetId', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const worksheetId = Number(req.params.worksheetId);
    if (!Number.isInteger(worksheetId) || worksheetId <= 0) {
      res.status(400).json({ error: 'Invalid worksheet id.' });
      return;
    }
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const data = await q.getWorksheetData(db, worksheetId, clerkUserId);
      if (!data) {
        res.status(404).json({ error: 'Worksheet not found.' });
        return;
      }
      res.status(200).json({
        worksheet: data.worksheet,
        columns: data.columns,
        rows: data.rows,
      });
    } catch (error) {
      console.error('Failed to fetch worksheet data:', error);
      res.status(500).json({ error: 'Failed to fetch worksheet.' });
    }
  })();
});

warframeApiRouter.patch('/cells', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const data = validateBody(warframeUpdateSchema, req.body, res);
    if (!data) return;
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const col = q.getColumnById(db, data.column_id, clerkUserId);
      if (!col) {
        res.status(400).json({ error: 'Column not found or access denied.' });
        return;
      }
      const isHelminth = col.name === 'Helminth';
      const current = q.getCellValue(db, data.row_id, data.column_id, clerkUserId);
      if (current === data.value) {
        res.status(200).json({ success: true, value: data.value });
        return;
      }
      if (isHelminth) {
        const itemName = q.getRowItemName(db, data.row_id, clerkUserId);
        if (!itemName) {
          res.status(400).json({ error: 'Row not found.' });
          return;
        }
        if (!isValidHelminthCellValue(itemName, data.value)) {
          res.status(400).json({ error: 'Invalid value for Helminth.' });
          return;
        }
      } else {
        if (!(CELL_PATCH_ALLOWED_STATUSES as readonly string[]).includes(data.value)) {
          res.status(400).json({ error: 'Invalid status value.' });
          return;
        }
        if (current === 'Unavailable') {
          res.status(400).json({ error: 'Cannot modify unavailable items.' });
          return;
        }
      }
      const changes = q.updateCell(db, data.row_id, data.column_id, data.value, clerkUserId);
      if (changes <= 0) {
        res.status(404).json({ error: 'Update failed: row or column not updated.' });
        return;
      }
      res.status(200).json({ success: true, value: data.value });
    } catch {
      res.status(400).json({
        error: 'Failed to update cell.',
      });
    }
  })();
});

warframeApiRouter.patch('/advanced-progress', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const data = validateBody(warframeUpdateAdvancedProgressSchema, req.body, res);
    if (!data) return;
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const next = q.updateRowAdvancedProgress(db, data.row_id, clerkUserId, {
        level: data.level,
        level_prime: data.level_prime,
        valence_percent: data.valence_percent,
        valence_percent_prime: data.valence_percent_prime,
        has_element: data.has_element,
        has_element_prime: data.has_element_prime,
        has_orokin: data.has_orokin,
        has_orokin_prime: data.has_orokin_prime,
        has_arcane: data.has_arcane,
        has_arcane_prime: data.has_arcane_prime,
        has_exilus: data.has_exilus,
        has_exilus_prime: data.has_exilus_prime,
      });
      res.status(200).json({ success: true, advanced_progress: next });
    } catch {
      res.status(400).json({
        error: 'Failed to update advanced progress.',
      });
    }
  })();
});

warframeApiRouter.post('/rows', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const data = validateBody(warframeAddRowSchema, req.body, res);
    if (!data) return;
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const columns = q.getWorksheetColumns(db, data.worksheet_id, clerkUserId);
      if (columns.length === 0) {
        res.status(403).json({ error: 'Worksheet not found or access denied.' });
        return;
      }
      const { valid, invalid } = validateColumnValues(data.values, columns, data.item_name);
      if (invalid.length > 0) {
        res.status(400).json({ error: 'Invalid column/value(s).', invalid });
        return;
      }
      try {
        const rowId = q.addRow(db, data.worksheet_id, clerkUserId, data.item_name, valid);
        res.status(201).json({ success: true, row_id: rowId });
      } catch (error) {
        console.error('Failed to add row:', error);
        res.status(500).json({
          error: 'Failed to add row.',
        });
      }
    } catch (error) {
      console.error('Failed to add row:', error);
      res.status(500).json({ error: 'Failed to add row.' });
    }
  })();
});

warframeApiRouter.patch('/rows/:rowId', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const data = validateBody(
      warframeEditRowSchema,
      { ...req.body, row_id: Number(req.params.rowId) },
      res,
    );
    if (!data) return;
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const worksheetId = q.getRowWorksheetId(db, data.row_id, clerkUserId);
      if (worksheetId === null) {
        res.status(404).json({ error: 'Row not found.' });
        return;
      }
      const columns = q.getWorksheetColumns(db, worksheetId, clerkUserId);
      const existingName = q.getRowItemName(db, data.row_id, clerkUserId) ?? '';
      const itemNameForHelminth =
        data.item_name !== null && data.item_name.trim() !== ''
          ? data.item_name.trim()
          : existingName;
      const { valid, invalid } = validateColumnValues(data.values, columns, itemNameForHelminth);
      if (invalid.length > 0) {
        res.status(400).json({ error: 'Invalid column/value(s).', invalid });
        return;
      }
      const ok = q.editRow(db, data.row_id, clerkUserId, data.item_name, valid);
      if (!ok) {
        res.status(404).json({ error: 'Row not found.' });
        return;
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to edit row:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  })();
});

warframeApiRouter.delete('/rows/:rowId', (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const data = validateBody(warframeDeleteRowSchema, { row_id: Number(req.params.rowId) }, res);
    if (!data) return;
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const ok = q.deleteRow(db, data.row_id, clerkUserId);
      if (!ok) {
        res.status(404).json({ error: 'Row not found.' });
        return;
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to delete row:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  })();
});

warframeApiRouter.patch('/admin/cells', requireCodexAdmin, (req, res) => {
  void (async () => {
    const data = validateBody(warframeAdminUpdateSchema, req.body, res);
    if (!data) return;
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const result = q.adminUpdateCell(
        db,
        data.row_id,
        data.column_id,
        data.value,
        requireClerkUserId(req),
      );
      if (result <= 0) {
        res.status(404).json({ error: 'Row or column not updated.' });
        return;
      }
      res.status(200).json({ success: true, value: data.value });
    } catch {
      res.status(400).json({
        error: 'Invalid status value.',
      });
    }
  })();
});

warframeApiRouter.get('/admin/sync-preview', requireCodexAdmin, (req, res) => {
  void (async () => {
    const clerkUserId = requireClerkUserId(req);
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      const result = await runWarframeSyncGuarded(() =>
        runWarframeSync(db, {
          execute: false,
          clerkUserIds: [clerkUserId],
        }),
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof SyncAlreadyRunningError) {
        res.status(409).json({ error: error.message });
        return;
      }
      log('error', 'Failed to build Warframe sync preview', {
        err: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to build Warframe sync preview.' });
    }
  })();
});

warframeApiRouter.post('/admin/sync-source', requireCodexAdmin, (req, res) => {
  void (async () => {
    const adminUserId = requireClerkUserId(req);
    if (!adminUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const db = await getDbOrFail(res);
    if (!db) return;
    try {
      log('info', 'Starting Warframe sync execution', { clerkUserId: adminUserId });
      const result = await runWarframeSyncGuarded(() =>
        runWarframeSync(db, {
          execute: true,
          initiatedByClerkUserId: adminUserId,
        }),
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof SyncAlreadyRunningError) {
        res.status(409).json({ error: error.message });
        return;
      }
      log('error', 'Failed to execute Warframe sync', {
        clerkUserId: adminUserId,
        err: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to execute Warframe sync.' });
    }
  })();
});

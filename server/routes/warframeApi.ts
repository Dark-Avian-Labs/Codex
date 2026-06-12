import { log, requireCodexAdmin } from '@codex/core';
import { validateBody } from '@codex/core/validation';
import {
  HELMINTH_VALUES,
  VALID_STATUSES,
  isHelminthValue,
  isValidHelminthCellValue,
  isValidStatus,
  warframeAddRowSchema,
  warframeAdminUpdateSchema,
  warframeDeleteRowSchema,
  warframeEditRowSchema,
  warframePatchSettingsSchema,
  warframeUpdateAdvancedProgressSchema,
  warframeQueries as q,
  warframeUpdateSchema,
} from '@codex/game-warframe';
import { Router } from 'express';

import { requireClerkUserId } from '../auth/clerkUser.js';
import { provisionWarframeUserIfNeeded } from '../services/warframeProvision.js';
import { runWarframeSync } from '../services/warframeSync.js';
import {
  createWarframeSyncRun,
  getWarframeSyncRunRow,
  toWarframeSyncRunResponse,
  updateWarframeSyncRun,
} from '../services/warframeSyncJobs.js';
import {
  acquireWarframeSyncSlot,
  isWarframeSyncRunning,
  releaseWarframeSyncSlot,
  runWarframeSyncGuarded,
  SyncAlreadyRunningError,
} from '../services/warframeSyncState.js';
import { openWarframeDbOrFail, runWithWarframeDb } from './routeHelpers.js';

export const warframeApiRouter = Router();

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
  runWithWarframeDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    provisionWarframeUserIfNeeded(db, clerkUserId);
    const worksheets = q.getWorksheets(db, clerkUserId);
    res.status(200).json({ worksheets });
  });
});

warframeApiRouter.get('/settings', (req, res) => {
  runWithWarframeDb(res, async (db) => {
    const clerkUserId = requireClerkUserId(req);
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
  });
});

warframeApiRouter.patch('/settings', (req, res) => {
  runWithWarframeDb(res, async (db) => {
    const clerkUserId = requireClerkUserId(req);
    const data = validateBody(warframePatchSettingsSchema, req.body, res);
    if (!data) return;
    const upsert = db.prepare(
      `INSERT INTO user_settings (clerk_user_id, setting_key, setting_value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(clerk_user_id, setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = datetime('now')`,
    );
    if (data.hide_completed !== undefined) {
      upsert.run(clerkUserId, SETTING_HIDE_COMPLETED, data.hide_completed ? '1' : '0');
    }
    if (data.market_links !== undefined) {
      upsert.run(clerkUserId, SETTING_MARKET_LINKS, data.market_links ? '1' : '0');
    }
    if (data.advanced_mode !== undefined) {
      upsert.run(clerkUserId, SETTING_ADVANCED_MODE, data.advanced_mode ? '1' : '0');
    }
    if (data.show_all_variants !== undefined) {
      upsert.run(clerkUserId, SETTING_SHOW_ALL_VARIANTS, data.show_all_variants ? '1' : '0');
    }
    res.status(200).json({ success: true });
  });
});

warframeApiRouter.get('/worksheets/:worksheetId', (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  const worksheetId = Number(req.params.worksheetId);
  if (!Number.isInteger(worksheetId) || worksheetId <= 0) {
    res.status(400).json({ error: 'Invalid worksheet id.' });
    return;
  }
  runWithWarframeDb(res, async (db) => {
    const data = await q.getWorksheetData(db, worksheetId, clerkUserId);
    if (!data) {
      res.status(404).json({ error: 'Worksheet not found.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-cache');
    res.status(200).json({
      worksheet: data.worksheet,
      columns: data.columns,
      rows: data.rows,
    });
  });
});

warframeApiRouter.patch('/cells', (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  const data = validateBody(warframeUpdateSchema, req.body, res);
  if (!data) return;
  runWithWarframeDb(res, async (db) => {
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
  });
});

warframeApiRouter.patch('/advanced-progress', (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  const data = validateBody(warframeUpdateAdvancedProgressSchema, req.body, res);
  if (!data) return;
  runWithWarframeDb(res, async (db) => {
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
  });
});

warframeApiRouter.post('/rows', (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  const data = validateBody(warframeAddRowSchema, req.body, res);
  if (!data) return;
  runWithWarframeDb(res, async (db) => {
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
    const rowId = q.addRow(db, data.worksheet_id, clerkUserId, data.item_name, valid);
    res.status(201).json({ success: true, row_id: rowId });
  });
});

warframeApiRouter.patch('/rows/:rowId', (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  const data = validateBody(
    warframeEditRowSchema,
    { ...req.body, row_id: Number(req.params.rowId) },
    res,
  );
  if (!data) return;
  runWithWarframeDb(res, async (db) => {
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
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});

warframeApiRouter.delete('/rows/:rowId', (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  const data = validateBody(warframeDeleteRowSchema, { row_id: Number(req.params.rowId) }, res);
  if (!data) return;
  runWithWarframeDb(res, async (db) => {
    const ok = q.deleteRow(db, data.row_id, clerkUserId);
    if (!ok) {
      res.status(404).json({ error: 'Row not found.' });
      return;
    }
    res.status(200).json({ success: true });
  });
});

warframeApiRouter.patch('/admin/cells', requireCodexAdmin, (req, res) => {
  const data = validateBody(warframeAdminUpdateSchema, req.body, res);
  if (!data) return;
  runWithWarframeDb(res, async (db) => {
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
  });
});

warframeApiRouter.get('/admin/sync-preview', requireCodexAdmin, (req, res) => {
  const clerkUserId = requireClerkUserId(req);
  runWithWarframeDb(res, async (db) => {
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
  });
});

warframeApiRouter.get('/admin/sync/runs/:id', requireCodexAdmin, (req, res) => {
  const runId = Number(req.params.id);
  if (!Number.isInteger(runId) || runId < 1) {
    res.status(400).json({ error: 'Invalid sync run id.' });
    return;
  }
  const row = getWarframeSyncRunRow(runId);
  if (!row) {
    res.status(404).json({ error: 'Sync run not found.' });
    return;
  }
  res.status(200).json(toWarframeSyncRunResponse(row));
});

warframeApiRouter.post('/admin/sync-source', requireCodexAdmin, (req, res) => {
  void (async () => {
    let adminUserId: string;
    let db;
    try {
      adminUserId = requireClerkUserId(req);
      db = await openWarframeDbOrFail(res);
    } catch (error) {
      log('error', 'Failed to start Warframe sync', {
        err: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to queue Warframe sync.' });
      }
      return;
    }
    if (!db) return;
    if (isWarframeSyncRunning()) {
      res.status(409).json({ error: 'A Warframe sync is already running.' });
      return;
    }

    let run;
    try {
      run = createWarframeSyncRun(adminUserId);
    } catch (error) {
      log('error', 'Failed to create Warframe sync run', {
        err: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to queue Warframe sync.' });
      return;
    }

    let lockToken: string;
    try {
      lockToken = acquireWarframeSyncSlot(run.id);
    } catch (error) {
      const message =
        error instanceof SyncAlreadyRunningError ? error.message : 'Failed to queue Warframe sync.';
      updateWarframeSyncRun(run.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_text: message,
      });
      if (error instanceof SyncAlreadyRunningError) {
        res.status(409).json({ error: message });
      } else {
        log('error', 'Failed to acquire Warframe sync slot', {
          err: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: message });
      }
      return;
    }

    res.status(202).json({
      runId: run.id,
      status: run.status,
      pollUrl: `/api/warframe/admin/sync/runs/${run.id}`,
    });

    void (async () => {
      const finishedAt = () => new Date().toISOString();
      try {
        updateWarframeSyncRun(run.id, { status: 'running' });
        log('info', 'Starting Warframe sync execution', { runId: run.id });
        const result = runWarframeSync(db, {
          execute: true,
          initiatedByClerkUserId: adminUserId,
        });
        const pendingMeta = getWarframeSyncRunRow(run.id)?.summary_json;
        let initiatorMasked: string | undefined;
        if (pendingMeta) {
          try {
            const meta = JSON.parse(pendingMeta) as { _initiatorMasked?: string };
            initiatorMasked = meta._initiatorMasked;
          } catch {
            initiatorMasked = undefined;
          }
        }
        updateWarframeSyncRun(run.id, {
          status: 'succeeded',
          finished_at: finishedAt(),
          summary_json: JSON.stringify(
            initiatorMasked ? { ...result, _initiatorMasked: initiatorMasked } : result,
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log('error', 'Failed to execute Warframe sync', {
          runId: run.id,
          err: message,
        });
        updateWarframeSyncRun(run.id, {
          status: 'failed',
          finished_at: finishedAt(),
          error_text: message,
        });
      } finally {
        releaseWarframeSyncSlot(lockToken);
      }
    })();
  })();
});

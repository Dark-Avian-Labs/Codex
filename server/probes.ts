import fs from 'node:fs';

import { getSessionDb } from '@codex/core';
import { getEpic7Db } from '@codex/game-epic7';
import { getWarframeDb } from '@codex/game-warframe';
import { getWorDb } from '@codex/game-wor';
import Database from 'better-sqlite3';
import type { Request, Response } from 'express';

import { APP_NAME, WARFRAME_CATALOG_DB_PATH, WOR_CATALOG_DB_PATH } from './config.js';
import { isEpic7DbAvailable, refreshEpic7DbAvailability } from './epic7DbState.js';
import { isWorDbAvailable, refreshWorDbAvailability } from './worDbState.js';

export function healthzHandler(_req: Request, res: Response): void {
  res.json({ status: 'ok', app: APP_NAME });
}

function assertCatalogTablesReadable(dbPath: string, requiredTables: string[]): void {
  if (!dbPath.trim()) return;
  fs.accessSync(dbPath, fs.constants.R_OK);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    db.pragma('busy_timeout = 1000');
    for (const table of requiredTables) {
      const row = db
        .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get(table) as { ok: number } | undefined;
      if (!row) {
        throw new Error(`Catalog DB missing required table ${table}: ${dbPath}`);
      }
    }
  } finally {
    db.close();
  }
}

export async function readyzHandler(_req: Request, res: Response): Promise<void> {
  try {
    getSessionDb().prepare('SELECT 1').get();
    getWarframeDb().prepare('SELECT 1').get();
    await refreshEpic7DbAvailability();
    if (!isEpic7DbAvailable()) {
      throw new Error('Epic7 database unavailable');
    }
    getEpic7Db().prepare('SELECT 1').get();
    await refreshWorDbAvailability();
    if (!isWorDbAvailable()) {
      throw new Error('WoR database unavailable');
    }
    getWorDb().prepare('SELECT 1').get();
    assertCatalogTablesReadable(WARFRAME_CATALOG_DB_PATH, ['warframes', 'weapons', 'mods']);
    assertCatalogTablesReadable(WOR_CATALOG_DB_PATH, [
      'catalog_heroes',
      'catalog_artifacts',
      'catalog_demons',
      'catalog_meta',
    ]);
    res.json({ status: 'ready', app: APP_NAME });
  } catch {
    res.status(503).json({ status: 'not_ready', app: APP_NAME });
  }
}

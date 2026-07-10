import fs from 'node:fs';

import { getSessionDb } from '@codex/core';
import { getEpic7Db } from '@codex/game-epic7';
import { getWarframeDb } from '@codex/game-warframe';
import { getWorDb } from '@codex/game-wor';
import type { Request, Response } from 'express';

import { APP_NAME, ARMORY_DB_PATH } from './config.js';
import { isEpic7DbAvailable, refreshEpic7DbAvailability } from './epic7DbState.js';
import { isWorDbAvailable, refreshWorDbAvailability } from './worDbState.js';

export function healthzHandler(_req: Request, res: Response): void {
  res.json({ status: 'ok', app: APP_NAME });
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
    if (ARMORY_DB_PATH.trim()) {
      await fs.promises.access(ARMORY_DB_PATH, fs.constants.R_OK);
    }
    res.json({ status: 'ready', app: APP_NAME });
  } catch {
    res.status(503).json({ status: 'not_ready', app: APP_NAME });
  }
}

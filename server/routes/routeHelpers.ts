import fs from 'fs';

import { log } from '@codex/core';
import { WARFRAME_DB_PATH, getWarframeDb } from '@codex/game-warframe';
import type { Response } from 'express';

export type WarframeDatabase = ReturnType<typeof getWarframeDb>;

export async function openWarframeDbOrFail(res: Response): Promise<WarframeDatabase | null> {
  try {
    await fs.promises.access(WARFRAME_DB_PATH);
  } catch {
    res.status(500).json({ error: 'Database not found.' });
    return null;
  }
  try {
    return getWarframeDb();
  } catch (error) {
    log('error', 'Failed to open Warframe database connection', {
      err: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Database connection failed.' });
    return null;
  }
}

export function runWithWarframeDb(
  res: Response,
  fn: (db: WarframeDatabase) => void | Promise<void>,
): void {
  void (async () => {
    const db = await openWarframeDbOrFail(res);
    if (!db) return;
    try {
      await fn(db);
    } catch (error) {
      if (res.headersSent) {
        log('error', 'Warframe handler failed after response started', {
          err: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      const status =
        error instanceof Error && typeof (error as { status?: unknown }).status === 'number'
          ? (error as unknown as { status: number }).status
          : 500;
      if (status >= 400 && status < 500) {
        res.status(status).json({ error: (error as Error).message || 'Request failed' });
        return;
      }
      log('error', 'Warframe request failed', {
        err: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  })();
}

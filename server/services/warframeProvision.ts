import { log } from '@codex/core';
import { warframeQueries as q } from '@codex/game-warframe';
import type Database from 'better-sqlite3';

import { ensureWarframeWorksheetsForUser, provisionUserFromCatalogMaster } from './warframeSync.js';

export function provisionWarframeUserIfNeeded(
  codexDb: Database.Database,
  clerkUserId: string,
): void {
  if (q.getWorksheets(codexDb, clerkUserId).length > 0) {
    return;
  }

  const provision = codexDb.transaction(() => {
    if (q.getWorksheets(codexDb, clerkUserId).length > 0) {
      return;
    }
    const provisionedFromMaster = provisionUserFromCatalogMaster(codexDb, clerkUserId);
    if (!provisionedFromMaster) {
      log('info', 'Warframe master catalog empty; created worksheet shells only', { clerkUserId });
      ensureWarframeWorksheetsForUser(codexDb, clerkUserId);
    }
  });
  provision.immediate();
}

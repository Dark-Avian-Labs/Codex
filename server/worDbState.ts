import fs from 'fs/promises';

import { WOR_DB_PATH } from '@codex/game-wor';

let worDbAvailable = false;
let refreshWorDbPromise: Promise<void> | null = null;

async function runRefreshWorDbAvailability(): Promise<void> {
  try {
    await fs.access(WOR_DB_PATH);
    worDbAvailable = true;
  } catch {
    worDbAvailable = false;
  }
}

export async function refreshWorDbAvailability(): Promise<void> {
  if (!refreshWorDbPromise) {
    refreshWorDbPromise = runRefreshWorDbAvailability().finally(() => {
      refreshWorDbPromise = null;
    });
  }
  await refreshWorDbPromise;
}

export function isWorDbAvailable(): boolean {
  return worDbAvailable;
}

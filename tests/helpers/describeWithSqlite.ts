import { describe } from 'vitest';

import { getSqliteSkipReason, isSqliteNativeAvailable } from './sqliteNative.js';

export function describeWithSqlite(name: string, fn: () => void): void {
  const available = isSqliteNativeAvailable();
  if (!available) {
    const reason = getSqliteSkipReason();
    if (reason) {
      console.warn(`Skipping SQLite tests (${name}): ${reason}`);
    }
  }
  describe.skipIf(!available)(name, fn);
}

import { createRequire } from 'node:module';

export type SqliteNativeProbe = {
  available: boolean;
  reason?: string;
};

const require = createRequire(import.meta.url);

export function probeSqliteNative(): SqliteNativeProbe {
  try {
    const mod = require('better-sqlite3') as new (path: string) => { close(): void };
    const Database = mod;
    const db = new Database(':memory:');
    db.close();
    return { available: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = message.includes('NODE_MODULE_VERSION')
      ? ' Run pnpm rebuild better-sqlite3 after changing Node versions.'
      : '';
    return { available: false, reason: `${message}${hint}` };
  }
}

export function isSqliteNativeAvailable(): boolean {
  if (process.env.CODEX_SQLITE_NATIVE_AVAILABLE === '1') return true;
  if (process.env.CODEX_SQLITE_NATIVE_AVAILABLE === '0') return false;
  return probeSqliteNative().available;
}

export function getSqliteSkipReason(): string | undefined {
  return process.env.CODEX_SQLITE_SKIP_REASON;
}

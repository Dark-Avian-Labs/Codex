import { probeSqliteNative } from './helpers/sqliteNative.js';

export default function globalSetup(): void {
  const probe = probeSqliteNative();
  process.env.CODEX_SQLITE_NATIVE_AVAILABLE = probe.available ? '1' : '0';
  if (probe.reason) {
    process.env.CODEX_SQLITE_SKIP_REASON = probe.reason;
  } else {
    delete process.env.CODEX_SQLITE_SKIP_REASON;
  }

  if (process.env.CI === 'true' && !probe.available) {
    throw new Error(`SQLite native module unavailable in CI: ${probe.reason ?? 'unknown error'}`);
  }
}

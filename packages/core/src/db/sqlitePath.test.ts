import { describe, expect, it } from 'vitest';

import { requireAbsoluteSqlitePath } from './sqlitePath.js';

describe('requireAbsoluteSqlitePath', () => {
  it('returns trimmed absolute paths', () => {
    expect(requireAbsoluteSqlitePath('SESSION_DB_PATH', ' /tmp/session.db ')).toBe('/tmp/session.db');
  });

  it('rejects missing values', () => {
    expect(() => requireAbsoluteSqlitePath('SESSION_DB_PATH', undefined)).toThrow(
      'SESSION_DB_PATH must be set to an absolute SQLite path.',
    );
  });

  it('rejects relative paths', () => {
    expect(() => requireAbsoluteSqlitePath('ARMORY_DB_PATH', './data/armory.db')).toThrow(
      'ARMORY_DB_PATH must be absolute; relative paths are not supported.',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { isAppAdmin } from '../auth/clerk.js';

describe('isAppAdmin', () => {
  it('returns true when app role is admin', () => {
    expect(isAppAdmin({ apps: { codex: 'admin' } }, 'codex')).toBe(true);
  });

  it('returns false for missing app key', () => {
    expect(isAppAdmin({ apps: {} }, 'codex')).toBe(false);
    expect(isAppAdmin(undefined, 'codex')).toBe(false);
  });

  it('returns false for non-admin values', () => {
    expect(isAppAdmin({ apps: { codex: 'user' } }, 'codex')).toBe(false);
  });

  it('does not treat other apps as codex admin', () => {
    expect(isAppAdmin({ apps: { armory: 'admin' } }, 'codex')).toBe(false);
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import { isEncryptedEnvValue, normalizeClerkEnv } from './clerkEnv.js';

const ENV_KEYS = ['CLERK_PUBLISHABLE_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'NODE_ENV'] as const;

describe('clerkEnv', () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('maps VITE_CLERK_PUBLISHABLE_KEY to CLERK_PUBLISHABLE_KEY for Clerk Express', () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    process.env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_example';
    process.env.CLERK_SECRET_KEY = 'sk_live_example';
    process.env.NODE_ENV = 'production';

    normalizeClerkEnv();

    expect(process.env.CLERK_PUBLISHABLE_KEY).toBe('pk_live_example');
  });

  it('throws when clerk values are still encrypted', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'encrypted:abc';
    process.env.CLERK_SECRET_KEY = 'sk_live_example';
    process.env.NODE_ENV = 'production';

    expect(() => normalizeClerkEnv()).toThrow(/still encrypted/i);
  });

  it('detects encrypted dotenvx values', () => {
    expect(isEncryptedEnvValue('encrypted:abc')).toBe(true);
    expect(isEncryptedEnvValue('pk_live_example')).toBe(false);
  });
});

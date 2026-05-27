import { afterEach, describe, expect, it } from 'vitest';

import { getClerkAuthorizedParties } from './clerkAuthorizedParties.js';

const ENV_KEYS = [
  'NODE_ENV',
  'APP_PUBLIC_BASE_URL',
  'BASE_DOMAIN',
  'BASE_PROTOCOL',
  'APP_SUBDOMAIN',
  'ALLOWED_APP_ORIGINS',
] as const;

describe('getClerkAuthorizedParties', () => {
  const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previousEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('includes app public URL and configured sibling origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_PUBLIC_BASE_URL = 'https://codex.example.com/';
    process.env.ALLOWED_APP_ORIGINS = 'https://codex.example.com,https://armory.example.com';

    expect(getClerkAuthorizedParties()).toEqual(['https://codex.example.com', 'https://armory.example.com']);
  });

  it('includes localhost origins in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_PUBLIC_BASE_URL = 'http://localhost:3001';
    delete process.env.ALLOWED_APP_ORIGINS;

    const parties = getClerkAuthorizedParties();
    expect(parties).toContain('http://localhost:3001');
    expect(parties).toContain('http://localhost:5173');
  });
});

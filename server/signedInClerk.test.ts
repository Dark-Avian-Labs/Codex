import { describe, expect, it } from 'vitest';

import { clerkFrontendApiOrigin, isSignedInClerkConfigured } from './signedInClerk.js';

describe('isSignedInClerkConfigured', () => {
  it('rejects an empty email', () => {
    expect(isSignedInClerkConfigured('', 'pk_test_abc', 'sk_test_abc')).toBe(false);
  });

  it('rejects live keys', () => {
    expect(isSignedInClerkConfigured('user@example.com', 'pk_live_abc', 'sk_test_abc')).toBe(false);
  });

  it('rejects a bare test prefix', () => {
    expect(isSignedInClerkConfigured('user@example.com', 'pk_test_', 'sk_test_abc')).toBe(false);
    expect(isSignedInClerkConfigured('user@example.com', 'pk_test_abc', 'sk_test_')).toBe(false);
  });

  it('accepts development test keys', () => {
    expect(isSignedInClerkConfigured('user@example.com', 'pk_test_abc', 'sk_test_abc')).toBe(true);
  });

  it('reads the frontend API host from a test publishable key', () => {
    const key = `pk_test_${Buffer.from('example.clerk.accounts.dev$').toString('base64')}`;
    expect(clerkFrontendApiOrigin(key)).toBe('https://example.clerk.accounts.dev');
  });
});

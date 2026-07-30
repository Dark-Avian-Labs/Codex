import { describe, expect, it } from 'vitest';

import { sanitizeRequestId } from './requestId.js';

describe('sanitizeRequestId', () => {
  it('accepts valid ids', () => {
    expect(sanitizeRequestId('abcdef12')).toBe('abcdef12');
    expect(sanitizeRequestId('a'.repeat(64))).toBe('a'.repeat(64));
    expect(sanitizeRequestId('req-1234-ABCD')).toBe('req-1234-ABCD');
  });

  it('rejects short, long, or unsafe ids and returns a UUID', () => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(sanitizeRequestId('short')).toMatch(uuidRe);
    expect(sanitizeRequestId('a'.repeat(65))).toMatch(uuidRe);
    expect(sanitizeRequestId('../etc/passwd')).toMatch(uuidRe);
    expect(sanitizeRequestId('has spaces!')).toMatch(uuidRe);
    expect(sanitizeRequestId(undefined)).toMatch(uuidRe);
  });
});

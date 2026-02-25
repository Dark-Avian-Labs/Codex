import { describe, expect, it } from 'vitest';

import { getAppPublicBaseUrl } from '../packages/core/src/middleware/auth.js';

describe('getAppPublicBaseUrl', () => {
  it('prefers explicit APP_PUBLIC_BASE_URL', () => {
    const original = process.env.APP_PUBLIC_BASE_URL;
    process.env.APP_PUBLIC_BASE_URL = 'https://corpus.example.com/';
    try {
      expect(getAppPublicBaseUrl()).toBe('https://corpus.example.com');
    } finally {
      process.env.APP_PUBLIC_BASE_URL = original;
    }
  });
});

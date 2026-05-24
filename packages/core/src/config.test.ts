import { afterEach, describe, expect, it } from 'vitest';

import { getCodexAppId } from './config.js';

describe('getCodexAppId', () => {
  const originalAppId = process.env.APP_ID;

  afterEach(() => {
    if (originalAppId === undefined) {
      delete process.env.APP_ID;
    } else {
      process.env.APP_ID = originalAppId;
    }
  });

  it('defaults to codex when APP_ID is unset', () => {
    delete process.env.APP_ID;
    expect(getCodexAppId()).toBe('codex');
  });

  it('reads APP_ID at call time', () => {
    process.env.APP_ID = 'Codex';
    expect(getCodexAppId()).toBe('codex');
  });

  it('falls back when APP_ID is still encrypted', () => {
    process.env.APP_ID = 'encrypted:bkmgizxogipnovixrybd5kaf7cktxstv75e3nn7xbdj';
    expect(getCodexAppId()).toBe('codex');
  });
});

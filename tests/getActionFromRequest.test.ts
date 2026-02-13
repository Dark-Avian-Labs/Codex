import { describe, expect, it } from 'vitest';

import { getActionFromRequest } from '../packages/core/src/api/helpers.js';

/** Minimal Express-like Request stub. */
function fakeReq(
  query: Record<string, unknown> = {},
  body: Record<string, unknown> = {},
) {
  return { query, body } as unknown as import('express').Request;
}

describe('getActionFromRequest', () => {
  it('reads action from query string', () => {
    expect(getActionFromRequest(fakeReq({ action: 'heroes' }))).toBe('heroes');
  });

  it('reads action from body when query is absent', () => {
    expect(getActionFromRequest(fakeReq({}, { action: 'update' }))).toBe(
      'update',
    );
  });

  it('prefers query over body', () => {
    expect(
      getActionFromRequest(
        fakeReq({ action: 'fromQuery' }, { action: 'fromBody' }),
      ),
    ).toBe('fromQuery');
  });

  it('handles array query param (takes first)', () => {
    expect(getActionFromRequest(fakeReq({ action: ['first', 'second'] }))).toBe(
      'first',
    );
  });

  it('returns empty string when no action provided', () => {
    expect(getActionFromRequest(fakeReq())).toBe('');
  });

  it('trims whitespace', () => {
    expect(getActionFromRequest(fakeReq({ action: '  heroes  ' }))).toBe(
      'heroes',
    );
  });

  it('handles numeric query value gracefully', () => {
    expect(getActionFromRequest(fakeReq({ action: 42 }))).toBe('');
  });
});

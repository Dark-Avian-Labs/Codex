import { describe, expect, it } from 'vitest';

import { appIdsMatch, parseDalAppNavDocument } from './dalAppNav.js';

describe('parseDalAppNavDocument', () => {
  it('accepts a valid catalog', () => {
    const parsed = parseDalAppNavDocument({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      apps: [
        {
          id: 'codex',
          name: 'Codex',
          icon: 'menu_book',
          href: 'https://codex.darkavianlabs.com',
        },
      ],
    });

    expect(parsed).toEqual({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      apps: [
        {
          id: 'codex',
          name: 'Codex',
          icon: 'menu_book',
          href: 'https://codex.darkavianlabs.com',
        },
      ],
    });
  });

  it('rejects missing version, bad href, or non-array apps', () => {
    expect(parseDalAppNavDocument({ version: 2, updatedAt: 'x', apps: [] })).toBeNull();
    expect(
      parseDalAppNavDocument({
        version: 1,
        updatedAt: 'x',
        apps: [{ id: 'a', name: 'A', icon: 'home', href: 'javascript:alert(1)' }],
      }),
    ).toBeNull();
    expect(parseDalAppNavDocument({ version: 1, updatedAt: 'x', apps: 'nope' })).toBeNull();
  });
});

describe('appIdsMatch', () => {
  it('ignores hyphens and case', () => {
    expect(appIdsMatch('budget-planner', 'budgetplanner')).toBe(true);
    expect(appIdsMatch('Codex', 'codex')).toBe(true);
    expect(appIdsMatch('armory', 'codex')).toBe(false);
  });
});

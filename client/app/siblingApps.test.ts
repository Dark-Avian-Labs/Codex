import { describe, expect, it, vi } from 'vitest';

import { getSiblingAppLinks } from './siblingApps';

describe('getSiblingAppLinks', () => {
  it('returns the default Armory link for Codex', () => {
    vi.stubEnv('VITE_SIBLING_APPS', '');
    expect(getSiblingAppLinks('codex')).toEqual([
      { id: 'armory', label: 'Armory', href: 'https://armory.darkavianlabs.com' },
    ]);
  });

  it('parses configured sibling apps from env', () => {
    vi.stubEnv('VITE_SIBLING_APPS', 'codex|Codex|https://codex.example.test,armory|Armory|https://armory.example.test');
    expect(getSiblingAppLinks('codex')).toEqual([
      { id: 'armory', label: 'Armory', href: 'https://armory.example.test' },
    ]);
  });

  it('ignores invalid env entries', () => {
    vi.stubEnv('VITE_SIBLING_APPS', 'bad-entry,armory|Armory|javascript:alert(1)');
    expect(getSiblingAppLinks('codex')).toEqual([
      { id: 'armory', label: 'Armory', href: 'https://armory.darkavianlabs.com' },
    ]);
  });
});

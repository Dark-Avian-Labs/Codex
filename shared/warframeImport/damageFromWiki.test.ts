import { describe, expect, it } from 'vitest';

import { damagePerShotFromWikiEntries, parseWikiDamageCellText } from './damageFromWiki.js';

describe('damageFromWiki', () => {
  it('parses multiple damage types from wiki cell text', () => {
    const entries = parseWikiDamageCellText('Slash 45 Toxin 45');
    expect(entries).toEqual([
      { type: 'Slash', value: 45 },
      { type: 'Toxin', value: 45 },
    ]);

    const damage = damagePerShotFromWikiEntries(entries);
    expect(damage?.[2]).toBe(45);
    expect(damage?.[6]).toBe(45);
  });
});

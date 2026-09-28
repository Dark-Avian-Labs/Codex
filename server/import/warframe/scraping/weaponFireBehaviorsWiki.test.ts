import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { parseWeaponFireBehaviorsFromWikiHtml } from './weaponFireBehaviorsWiki.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__tests__', 'fixtures');

describe('parseWeaponFireBehaviorsFromWikiHtml', () => {
  it('parses trigger modes and attack fire rates from Felarx infobox', () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'felarx-intrinsic.html'), 'utf8');
    const behaviors = parseWeaponFireBehaviorsFromWikiHtml(html);
    expect(behaviors.length).toBeGreaterThan(0);
    const names = behaviors.map((b) => b.name);
    expect(names.some((n) => /attack|auto|semi/i.test(n))).toBe(true);
    expect(behaviors.every((b) => b.ammoRequirement === 1)).toBe(true);
    const withRate = behaviors.filter((b) => b.fireRate != null);
    expect(withRate.length).toBeGreaterThan(0);
  });
});

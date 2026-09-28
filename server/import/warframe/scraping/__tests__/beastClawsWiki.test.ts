import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { parseBeastClawsFromWikiHtml } from '../beastClawsWiki.js';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'claws-beast.html');

describe('parseBeastClawsFromWikiHtml', () => {
  it('parses all beast claw rows from the wiki fixture', () => {
    const html = fs.readFileSync(fixturePath, 'utf8');
    const parsed = parseBeastClawsFromWikiHtml(html);

    expect(parsed.revisionId).toBe('2743179');
    expect(parsed.rows).toHaveLength(17);

    const panzer = parsed.rows.find((row) => row.clawsName === 'Panzer Claws');
    expect(panzer).toMatchObject({
      companionName: 'Panzer Vulpaphyla',
      totalDamage: 90,
      criticalChance: 0.25,
      criticalMultiplier: 2,
      procChance: 0.125,
    });
    expect(panzer?.damagePerShot[2]).toBe(45);
    expect(panzer?.damagePerShot[6]).toBe(45);

    const helminth = parsed.rows.find((row) => row.clawsName === 'Helminth Claws');
    expect(helminth?.damagePerShot[2]).toBe(200);
    expect(helminth?.damagePerShot[6]).toBe(50);

    const adarza = parsed.rows.find((row) => row.clawsName === 'Adarza Claws');
    expect(adarza?.damagePerShot[1]).toBe(45);
    expect(adarza?.damagePerShot[2]).toBe(45);
  });
});

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  applyHelminthFlagsFromWikiNames,
  parseSubsumableAbilitiesFromWarframeAbilitiesHtml,
  warframeNamesNeedingHelminthWikiScrape,
} from './warframeHelminthAbilityWiki.js';

describe('parseSubsumableAbilitiesFromWarframeAbilitiesHtml', () => {
  it('detects subsumable abilities from ability table rows', () => {
    const html = `
      <table>
        <tr>
          <td><a data-param-source="Ability" href="/w/Elemental_Ward" title="Elemental Ward (Ability)">Elemental Ward</a></td>
          <td><a href="/w/Helminth">Subsumable to Helminth</a></td>
        </tr>
        <tr>
          <td><a data-param-source="Ability" href="/w/Effigy" title="Effigy (Ability)">Effigy</a></td>
          <td></td>
        </tr>
      </table>
    `;
    const names = parseSubsumableAbilitiesFromWarframeAbilitiesHtml(html);
    expect(names).toContain('elemental ward');
    expect(names).not.toContain('effigy');
  });
});

describe('warframeNamesNeedingHelminthWikiScrape', () => {
  it('omits warframes that already have a helminth-flagged ability', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE warframes (unique_name TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE abilities (
        unique_name TEXT PRIMARY KEY,
        name TEXT,
        warframe_unique_name TEXT,
        is_helminth_extractable INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO warframes VALUES ('/Lotus/Excalibur', 'Excalibur');
      INSERT INTO warframes VALUES ('/Lotus/Ash', 'Ash');
      INSERT INTO abilities VALUES (
        '/Lotus/Excalibur/SlashDash', 'Slash Dash', '/Lotus/Excalibur', 1
      );
    `);
    expect(warframeNamesNeedingHelminthWikiScrape(db)).toEqual(['Ash']);
  });
});

describe('applyHelminthFlagsFromWikiNames', () => {
  it('does not clear existing flags when the wiki name set is empty', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE abilities (
        unique_name TEXT PRIMARY KEY,
        name TEXT,
        is_helminth_extractable INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO abilities (unique_name, name, is_helminth_extractable)
      VALUES ('/Lotus/Powersuits/Excalibur/SlashDash', 'Slash Dash', 1);
    `);

    const updated = applyHelminthFlagsFromWikiNames(db, new Set());
    expect(updated).toBe(0);
    const row = db
      .prepare('SELECT is_helminth_extractable FROM abilities WHERE unique_name = ?')
      .get('/Lotus/Powersuits/Excalibur/SlashDash') as { is_helminth_extractable: number };
    expect(row.is_helminth_extractable).toBe(1);
  });
});

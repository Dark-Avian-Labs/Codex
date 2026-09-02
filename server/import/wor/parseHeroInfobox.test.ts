import { describe, expect, it } from 'vitest';

import { parseHeroInfobox } from './parseHeroInfobox.js';

const DEIMOS_WIKITEXT = `{{HeroNavigation|Deimos}}
{{Hero
 | name         =Deimos
 | title        =Bloodhunter
 | hp           =15,485
 | atk          =3,333
 | def          =2,113
 | mdef         =499
 | block        =2
 | cost         =18
 | atkinterval  =2.6
 | rr_auto      =12
 | rr_attack    =10
 | rr_attacked  =8
 | hero_excl           =
}}

==Skills==
{{Talent
|name           =Talent
|description    =Basic ATK deals additional DMG equal to 2% of the hero's Max HP.
}}`;

describe('parseHeroInfobox', () => {
  it('reads Lv.60 attributes from the Hero infobox', () => {
    expect(parseHeroInfobox(DEIMOS_WIKITEXT)).toEqual({
      hp: 15485,
      atk: 3333,
      def: 2113,
      mdef: 499,
      block: 2,
      cost: 18,
      atkInterval: 2.6,
      rrAuto: 12,
      rrAttack: 10,
      rrAttacked: 8,
    });
  });

  it('returns null when the Hero template is missing', () => {
    expect(parseHeroInfobox('==Skills==\nno infobox')).toBeNull();
  });
});

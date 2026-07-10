import { describe, expect, it } from 'vitest';

import { parseInertiaHtml } from './fastidiousClient.js';
import { decodeHtmlEntities } from './htmlEntities.js';
import {
  normalizeArtifactRarity,
  normalizeDemonRarity,
  normalizeFactionName,
  normalizeHeroClass,
  normalizeHeroRarity,
  slugifyName,
  wikiPageTitleFromName,
} from './normalize.js';

describe('wor normalize', () => {
  it('slugifies artifact names', () => {
    expect(slugifyName("Warden's Shield")).toBe('wardens-shield');
    expect(slugifyName('The Sutra of Caprice')).toBe('the-sutra-of-caprice');
  });

  it('maps faction and class labels', () => {
    expect(normalizeFactionName('North Throne')).toBe('north_throne');
    expect(normalizeHeroClass('tactician')).toBe('tactician');
  });

  it('maps rarities', () => {
    expect(normalizeHeroRarity('Legendary')).toBe('legendary');
    expect(normalizeArtifactRarity('Mythic')).toBe('mythic');
    expect(normalizeDemonRarity('captain')).toBe('captain');
  });

  it('builds wiki page titles', () => {
    expect(wikiPageTitleFromName('Gul Drak')).toBe('Gul_Drak');
  });
});

describe('wor html entities', () => {
  it('decodes apostrophe entities without chained ampersand substitution', () => {
    expect(decodeHtmlEntities('Blightcaller&#x27;s Claw')).toBe("Blightcaller's Claw");
    expect(decodeHtmlEntities('city&#039;s gates')).toBe("city's gates");
  });

  it('decodes only one entity layer per pass', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
    expect(decodeHtmlEntities('&lt;')).toBe('<');
  });
});

describe('fastidious inertia parser', () => {
  it('parses encoded data-page payloads', () => {
    const html =
      '<div id="app" data-page="{&quot;component&quot;:&quot;heroes/index&quot;,&quot;props&quot;:{&quot;heroes&quot;:[{&quot;slug&quot;:&quot;spring&quot;}]}}"></div>';
    const page = parseInertiaHtml<{ heroes: { slug: string }[] }>(html);
    expect(page.component).toBe('heroes/index');
    expect(page.props.heroes[0]?.slug).toBe('spring');
  });
});

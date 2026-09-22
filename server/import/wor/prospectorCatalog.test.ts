import { describe, expect, it } from 'vitest';

import type { CatalogBundle } from './catalogQueries.js';
import {
  mergeProspectorCatalog,
  slimArtifactFromWp,
  slimHeroFromWp,
  statsFromProspectorAcf,
  type ProspectorSnapshot,
} from './prospectorCatalog.js';

function snapshot(partial: Partial<ProspectorSnapshot> = {}): ProspectorSnapshot {
  return {
    heroes: [],
    artifacts: [],
    terms: {
      class: [
        { id: 58, slug: 'mage', name: 'Mage' },
        { id: 61, slug: 'fighter', name: 'Fighter' },
        { id: 360, slug: 'generic', name: 'Generic' },
      ],
      faction: [
        { id: 362, slug: 'cursed-cult', name: 'Cursed Cult' },
        { id: 38, slug: 'chaos-dominion', name: 'Chaos Dominion' },
        { id: 40, slug: 'star-piercers', name: 'Star Piercers' },
      ],
      rarity: [
        { id: 173, slug: 'legendary', name: 'Legendary' },
        { id: 175, slug: 'rare', name: 'Rare' },
      ],
      damage: [
        { id: 170, slug: 'magic', name: 'Magic' },
        { id: 171, slug: 'normal', name: 'Normal' },
      ],
      artifactRarity: [
        { id: 256, slug: 'mythic', name: 'Mythic' },
        { id: 254, slug: 'generic', name: 'Generic' },
      ],
      summon: [
        { id: 204, slug: 'normal-summon', name: 'Normal Summon' },
        { id: 203, slug: 'ancient-exclusive', name: 'Ancient Exclusive' },
      ],
    },
    media: {
      '10047': 'https://prospector.gg/wp-content/uploads/aurelius-gale.webp',
      '10836': 'https://prospector.gg/wp-content/uploads/ironbloom.webp',
    },
    ...partial,
  };
}

function baseBundle(): CatalogBundle {
  return {
    heroes: [
      {
        slug: 'idyl',
        name: 'Idyl',
        class: 'mage',
        faction: 'watchguard',
        rarity: 'legendary',
        display_order: 1,
        active: 1,
      },
    ],
    artifacts: [
      {
        slug: 'idrils-gaze',
        name: "Idril's Gaze",
        rarity: 'legendary',
        display_order: 4,
        active: 1,
      },
      {
        slug: 'blade-of-talkiel',
        name: 'Blade of Talkiel',
        rarity: 'mythic',
        display_order: 5,
        active: 1,
      },
    ],
    demons: [],
  };
}

describe('slim Prospector posts', () => {
  it('reads hero identity, dual faction order, and the portrait attachment', () => {
    const hero = slimHeroFromWp({
      id: 10828,
      slug: 'aurelius-gale',
      title: { rendered: 'Aurelius Gale' },
      featured_media: 10052,
      class: [58],
      faction: [362],
      rarity: [173],
      'dmg-type': [170],
      'summoning-requirement': [204],
      acf: {
        portrait_image: 10047,
        identity_group_1: {
          hero_rarity: 173,
          hero_class: 58,
          hero_dmg_type: 170,
          hero_faction: [38, 40],
          hero_summoning_requirement: 204,
          is_this_hero_a_lord: false,
        },
        basic_attributes: {
          hero_attribute_hp: 10720,
          hero_attribute_atk: 4171,
          hero_attribute_def: 768,
          hero_attribute_m_res: 2581,
          hero_attribute_cost: 22,
          hero_attribute_block: 1,
        },
        advanced_attributes: {
          hero_attribute_atk_interval: 3.5,
          hero_attribute_rage_regen_auto: 14,
          hero_attribute_rage_regen_basic_atk: 10,
          hero_attribute_rage_regen_attacked: 6,
        },
      },
    });
    expect(hero).toMatchObject({
      slug: 'aurelius-gale',
      name: 'Aurelius Gale',
      classId: 58,
      factionIds: [38, 40],
      mediaId: 10047,
      isLord: false,
      stats: {
        hp: 10720,
        atk: 4171,
        def: 768,
        mdef: 2581,
        block: 1,
        cost: 22,
        atkInterval: 3.5,
        rrAuto: 14,
        rrAttack: 10,
        rrAttacked: 6,
      },
    });
  });

  it('treats a missing faction and an empty exclusive hero as unset', () => {
    const hero = slimHeroFromWp({
      id: 5,
      slug: 'gnash',
      title: { rendered: 'Gnash' },
      featured_media: 5153,
      class: [61],
      faction: [],
      rarity: [175],
      'dmg-type': [171],
      'summoning-requirement': [],
      acf: {
        portrait_image: 5153,
        identity_group_1: {
          hero_rarity: 175,
          hero_class: 61,
          hero_dmg_type: 171,
          hero_faction: false,
          hero_summoning_requirement: false,
          is_this_hero_a_lord: false,
        },
      },
    });
    expect(hero).toMatchObject({ factionIds: [], summonId: null, mediaId: 5153 });

    const artifact = slimArtifactFromWp({
      id: 13,
      slug: 'strings-of-sorrow',
      title: { rendered: 'Strings of Sorrow' },
      featured_media: 10823,
      acf: {
        artifact_rarity: 256,
        artifact_exclusive: true,
        artifact_exclusive_heroes: 10828,
        artifact_class: 58,
      },
    });
    expect(artifact).toMatchObject({ exclusiveHeroId: 10828, classId: 58 });
  });

  it('decodes artifact titles and ignores an empty exclusive-hero field', () => {
    const artifact = slimArtifactFromWp({
      id: 10842,
      slug: 'amenhoteps-bow',
      title: { rendered: 'Amenhotep&#8217;s Bow' },
      featured_media: 10821,
      class: [59],
      artifact_rarity: [256],
      acf: {
        artifact_rarity: 256,
        artifact_exclusive: true,
        artifact_exclusive_heroes: '',
        artifact_class: 59,
      },
    });
    expect(artifact).toMatchObject({
      name: 'Amenhotep’s Bow',
      exclusive: true,
      exclusiveHeroId: null,
      rarityId: 256,
    });
  });

  it('strips HTML markup from titles and leaves no angle brackets', () => {
    const italic = slimHeroFromWp({
      id: 1,
      slug: 'safe-name',
      title: { rendered: '<em>Safe Name</em>' },
      featured_media: 1,
      class: [58],
      faction: [362],
      rarity: [173],
      'dmg-type': [170],
      'summoning-requirement': [204],
      acf: null,
    });
    expect(italic?.name).toBe('Safe Name');

    const nested = slimHeroFromWp({
      id: 2,
      slug: 'nested-name',
      title: { rendered: '<<script>script>Nested</script>' },
      featured_media: 1,
      class: [58],
      faction: [362],
      rarity: [173],
      'dmg-type': [170],
      'summoning-requirement': [204],
      acf: null,
    });
    expect(nested?.name.includes('<')).toBe(false);
    expect(nested?.name.includes('>')).toBe(false);
  });
});

describe('mergeProspectorCatalog', () => {
  it('appends missing heroes and artifacts and keeps Fastidious rows', () => {
    const merged = mergeProspectorCatalog(
      baseBundle(),
      snapshot({
        heroes: [
          {
            id: 1,
            slug: 'idyl',
            name: 'Idyl',
            classId: 58,
            factionIds: [362],
            rarityId: 173,
            damageId: 170,
            summonId: 204,
            isLord: false,
            mediaId: null,
            stats: null,
          },
          {
            id: 2,
            slug: 'aurelius-gale',
            name: 'Aurelius Gale',
            classId: 58,
            factionIds: [38, 40],
            rarityId: 173,
            damageId: 170,
            summonId: 203,
            isLord: true,
            mediaId: 10047,
            stats: null,
          },
          {
            id: 3,
            slug: 'gnash',
            name: 'Gnash',
            classId: 61,
            factionIds: [],
            rarityId: 175,
            damageId: 171,
            summonId: 204,
            isLord: false,
            mediaId: null,
            stats: null,
          },
        ],
        artifacts: [
          {
            id: 10,
            slug: 'idrils-gaze',
            name: "Idril's Gaze",
            classId: 58,
            rarityId: 256,
            exclusive: false,
            exclusiveHeroId: null,
            mediaId: null,
          },
          {
            id: 11,
            slug: 'blaze-of-talkiel',
            name: 'Blaze of Talkiel',
            classId: 61,
            rarityId: 256,
            exclusive: true,
            exclusiveHeroId: null,
            mediaId: null,
          },
          {
            id: 12,
            slug: 'ironbloom-of-mercy',
            name: 'Ironbloom of Mercy',
            classId: 360,
            rarityId: 254,
            exclusive: false,
            exclusiveHeroId: null,
            mediaId: 10836,
          },
          {
            id: 13,
            slug: 'strings-of-sorrow',
            name: 'Strings of Sorrow',
            classId: 58,
            rarityId: 256,
            exclusive: true,
            exclusiveHeroId: 2,
            mediaId: null,
          },
        ],
      }),
    );

    expect(merged.addedHeroes).toEqual(['aurelius-gale', 'gnash']);
    expect(merged.bundle.heroes.map((hero) => hero.slug)).toEqual(['idyl', 'aurelius-gale', 'gnash']);
    const aurelius = merged.bundle.heroes.find((hero) => hero.slug === 'aurelius-gale');
    expect(aurelius).toMatchObject({
      class: 'mage',
      faction: 'chaos_dominion',
      faction_secondary: 'star_piercers',
      rarity: 'legendary',
      damage_type: 'Magic',
      is_lord: 1,
      is_ancient: 1,
      is_regular: 0,
      display_order: 2,
    });
    expect(merged.bundle.heroes.find((hero) => hero.slug === 'gnash')).toMatchObject({
      faction: 'unaffiliated',
      faction_secondary: null,
      damage_type: 'Physical',
      is_regular: 1,
    });
    expect(merged.addedArtifacts).toEqual(['ironbloom-of-mercy', 'strings-of-sorrow']);
    expect(merged.bundle.artifacts.find((artifact) => artifact.slug === 'ironbloom-of-mercy')).toMatchObject({
      class: null,
      rarity: 'epic',
      is_universal: 1,
    });
    expect(merged.bundle.artifacts.find((artifact) => artifact.slug === 'strings-of-sorrow')).toMatchObject({
      exclusive_hero_slug: 'aurelius-gale',
      is_universal: 0,
      rarity: 'mythic',
    });
    expect(merged.portraits).toEqual({
      heroes: { 'aurelius-gale': 'https://prospector.gg/wp-content/uploads/aurelius-gale.webp' },
      artifacts: { 'ironbloom-of-mercy': 'https://prospector.gg/wp-content/uploads/ironbloom.webp' },
    });
    expect(merged.bundle.heroes[0]).toMatchObject({ slug: 'idyl', faction: 'watchguard' });
  });

  it('skips a hero whose class is not in the Codex list', () => {
    const merged = mergeProspectorCatalog(
      baseBundle(),
      snapshot({
        heroes: [
          {
            id: 9,
            slug: 'mystery',
            name: 'Mystery',
            classId: 999,
            factionIds: [362],
            rarityId: 173,
            damageId: null,
            summonId: null,
            isLord: false,
            mediaId: null,
            stats: null,
          },
        ],
      }),
    );
    expect(merged.addedHeroes).toEqual([]);
    expect(merged.skipped).toEqual(['Skipped hero mystery: unknown class.']);
  });
});

describe('statsFromProspectorAcf', () => {
  it('maps ACF combat attributes and rejects rows without hp/atk', () => {
    expect(
      statsFromProspectorAcf({
        basic_attributes: {
          hero_attribute_hp: 1000,
          hero_attribute_atk: 200,
          hero_attribute_def: 50,
          hero_attribute_m_res: 10,
          hero_attribute_block: 1,
          hero_attribute_cost: 15,
        },
        advanced_attributes: {
          hero_attribute_atk_interval: 1.5,
          hero_attribute_rage_regen_auto: 8,
          hero_attribute_rage_regen_basic_atk: 5,
          hero_attribute_rage_regen_attacked: 3,
        },
      }),
    ).toEqual({
      hp: 1000,
      atk: 200,
      def: 50,
      mdef: 10,
      block: 1,
      cost: 15,
      atkInterval: 1.5,
      rrAuto: 8,
      rrAttack: 5,
      rrAttacked: 3,
    });
    expect(
      statsFromProspectorAcf({
        basic_attributes: { hero_attribute_def: 10 },
      }),
    ).toBeNull();
  });
});

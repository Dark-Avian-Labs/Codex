import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { CatalogBundle } from './catalogQueries.js';
import { applyWorOverrides } from './overrides.js';

const tempFiles: string[] = [];

function writeOverrides(contents: unknown): string {
  const filePath = path.join(os.tmpdir(), `wor-overrides-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(contents, null, 2)}\n`, 'utf8');
  tempFiles.push(filePath);
  return filePath;
}

afterEach(() => {
  for (const filePath of tempFiles.splice(0)) {
    fs.rmSync(filePath, { force: true });
  }
});

function baseBundle(): CatalogBundle {
  return {
    heroes: [
      {
        slug: 'idyl',
        name: 'Idyl',
        class: 'mage',
        faction: 'watchguard',
        rarity: 'legendary',
        damage_type: 'Magic',
        is_lord: 0,
        is_regular: 1,
        is_ancient: 0,
        is_limited: 0,
        display_order: 0,
        active: 1,
      },
    ],
    artifacts: [
      {
        slug: 'test-blade',
        name: 'Test Blade',
        rarity: 'epic',
        is_universal: 1,
        display_order: 0,
        active: 1,
      },
    ],
    demons: [
      {
        slug: 'test-demon',
        name: 'Test Demon',
        rarity: 'epic',
        max_level: 5,
        display_order: 0,
        active: 1,
      },
    ],
  };
}

describe('applyWorOverrides', () => {
  it('returns the bundle unchanged when the overrides file is missing', () => {
    const bundle = baseBundle();
    const result = applyWorOverrides(bundle, path.join(os.tmpdir(), 'missing-wor-overrides.json'));
    expect(result).toEqual(bundle);
  });

  it('patches existing heroes by slug', () => {
    const overridesPath = writeOverrides({
      heroes: {
        idyl: { reference_tier: 'S', is_lord: 1, is_limited: 1 },
      },
    });
    const result = applyWorOverrides(baseBundle(), overridesPath);
    expect(result.heroes).toHaveLength(1);
    expect(result.heroes[0]).toMatchObject({
      slug: 'idyl',
      name: 'Idyl',
      reference_tier: 'S',
      is_lord: 1,
      is_limited: 1,
    });
  });

  it('adds heroes missing from Fastidious when required fields are present', () => {
    const overridesPath = writeOverrides({
      heroes: {
        xasny: {
          name: 'Xasny',
          class: 'fighter',
          faction: 'esoteria_order',
          rarity: 'epic',
          damage_type: 'Magic',
        },
      },
    });
    const result = applyWorOverrides(baseBundle(), overridesPath);
    expect(result.heroes).toHaveLength(2);
    expect(result.heroes[1]).toEqual({
      slug: 'xasny',
      name: 'Xasny',
      class: 'fighter',
      faction: 'esoteria_order',
      faction_secondary: null,
      rarity: 'epic',
      damage_type: 'Magic',
      is_lord: 0,
      is_regular: 0,
      is_ancient: 0,
      is_limited: 0,
      reference_tier: null,
      portrait_path: null,
      display_order: 1,
      active: 1,
    });
  });

  it('throws when adding a hero without required identity fields', () => {
    const overridesPath = writeOverrides({
      heroes: {
        xasny: { name: 'Xasny' },
      },
    });
    expect(() => applyWorOverrides(baseBundle(), overridesPath)).toThrow(
      /requires class \(hero is missing from Fastidious catalog\)/,
    );
  });

  it('skips patch-only hero overrides when the slug is not in the catalog', () => {
    const overridesPath = writeOverrides({
      heroes: {
        'ezio-auditore': { is_ancient: 1 },
      },
    });
    const result = applyWorOverrides(baseBundle(), overridesPath);
    expect(result.heroes).toHaveLength(1);
    expect(result.heroes[0]?.slug).toBe('idyl');
  });
});

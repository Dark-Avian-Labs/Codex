import fs from 'node:fs';

import type { CatalogBundle } from './catalogQueries.js';
import { WOR_OVERRIDES_PATH } from './paths.js';

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export function applyWorOverrides(
  bundle: CatalogBundle,
  overridesPath = WOR_OVERRIDES_PATH,
): CatalogBundle {
  if (!fs.existsSync(overridesPath)) return bundle;
  const overrides = readJsonFile<{
    heroes?: Record<string, Partial<CatalogBundle['heroes'][number]>>;
    artifacts?: Record<string, Partial<CatalogBundle['artifacts'][number]>>;
    demons?: Record<string, Partial<CatalogBundle['demons'][number]>>;
  }>(overridesPath);

  const heroes = bundle.heroes.map((hero) => ({
    ...hero,
    ...overrides.heroes?.[hero.slug],
  }));
  const artifacts = bundle.artifacts.map((artifact) => ({
    ...artifact,
    ...overrides.artifacts?.[artifact.slug],
  }));
  const demons = bundle.demons.map((demon) => ({
    ...demon,
    ...overrides.demons?.[demon.slug],
  }));
  return { heroes, artifacts, demons };
}

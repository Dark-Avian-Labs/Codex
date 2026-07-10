import fs from 'node:fs';

import type { CatalogBundle } from './catalogQueries.js';
import { isValidFactionKey, isValidHeroClassKey } from './normalize.js';

export type WorValidationIssue = {
  level: 'error' | 'warning';
  message: string;
};

export type WorValidationResult = {
  ok: boolean;
  issues: WorValidationIssue[];
};

const MIN_HEROES = 200;
const MIN_ARTIFACTS = 150;
const MIN_DEMONS = 40;

function duplicateSlugs(rows: { slug: string }[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const row of rows) {
    if (seen.has(row.slug)) dupes.push(row.slug);
    seen.add(row.slug);
  }
  return dupes;
}

export function validateWorCatalogBundle(bundle: CatalogBundle): WorValidationResult {
  const issues: WorValidationIssue[] = [];

  if (bundle.heroes.length < MIN_HEROES) {
    issues.push({
      level: 'warning',
      message: `Expected at least ${MIN_HEROES} heroes, found ${bundle.heroes.length}.`,
    });
  }
  if (bundle.artifacts.length < MIN_ARTIFACTS) {
    issues.push({
      level: 'warning',
      message: `Expected at least ${MIN_ARTIFACTS} artifacts, found ${bundle.artifacts.length}.`,
    });
  }
  if (bundle.demons.length < MIN_DEMONS) {
    issues.push({
      level: 'warning',
      message: `Expected at least ${MIN_DEMONS} demons, found ${bundle.demons.length}.`,
    });
  }

  for (const slug of duplicateSlugs(bundle.heroes)) {
    issues.push({ level: 'error', message: `Duplicate hero slug: ${slug}` });
  }
  for (const slug of duplicateSlugs(bundle.artifacts)) {
    issues.push({ level: 'error', message: `Duplicate artifact slug: ${slug}` });
  }
  for (const slug of duplicateSlugs(bundle.demons)) {
    issues.push({ level: 'error', message: `Duplicate demon slug: ${slug}` });
  }

  for (const hero of bundle.heroes) {
    if (!isValidHeroClassKey(hero.class)) {
      issues.push({ level: 'error', message: `Hero ${hero.slug} has invalid class ${hero.class}` });
    }
    if (!isValidFactionKey(hero.faction)) {
      issues.push({
        level: 'error',
        message: `Hero ${hero.slug} has invalid faction ${hero.faction}`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.level === 'error');
  return { ok: errors.length === 0, issues };
}

export function listMissingStarAssets(assetsDir: string): string[] {
  const required = ['star1.png', 'star2.png', 'star3.png', 'star4.png', 'star5.png', 'star6.png'];
  return required.filter((file) => !fs.existsSync(`${assetsDir}/${file}`));
}

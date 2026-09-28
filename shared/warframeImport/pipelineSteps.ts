export const PIPELINE_STEPS = [
  {
    key: 'schema',
    label: 'Schema',
    description: 'Create or migrate SQLite tables.',
  },
  {
    key: 'officialExports',
    label: 'Exports',
    description: 'Download DE manifest and export JSON files.',
  },
  {
    key: 'sqliteFromExports',
    label: 'Database',
    description: 'Rebuild game tables when export hashes change.',
  },
  {
    key: 'warframeRankExceptions',
    label: 'Rank Exceptions',
    description:
      'Regenerate warframe rank-30 bonus exceptions when scripts/data/warframe-rank-exceptions.json changes; force step to refresh manually.',
  },
  {
    key: 'exaltedStanceMods',
    label: 'Exalted Stances',
    description:
      'Exalted stance mods: Overframe only when forced; otherwise wiki stance images when exports are unchanged.',
  },
  {
    key: 'atragraphMods',
    label: 'Atragraph Mods',
    description:
      'Atragraph foil mod art from wiki when ExportUpgrades changes; force step to refresh manually.',
  },
  {
    key: 'images',
    label: 'Images',
    description: 'Download new or changed item images.',
  },
  {
    key: 'hiddenCompanionWeapons',
    label: 'Companion Weapons',
    description:
      'Beast claw stats from the Claws (Beast) wiki page when exports change or data is missing.',
  },
  {
    key: 'overframe',
    label: 'Overframe',
    description:
      'Overframe artifact slots (manual force only). Use Admin slot editor for polarity fixes.',
  },
  {
    key: 'wiki',
    label: 'Wiki',
    description:
      'Wiki: abilities, shards, riven dispositions, projectile speeds, and weapon fire behaviors.',
  },
  {
    key: 'helminthWiki',
    label: 'Helminth',
    description: 'Helminth subsumable flags from wiki (Helminth page + each warframe /Abilities).',
  },
  {
    key: 'incarnonWiki',
    label: 'Incarnon',
    description: 'Sync incarnon evolution data when weapons export changes.',
  },
  {
    key: 'warframeMarketLinks',
    label: 'Warframe Market',
    description: 'Refresh trade link index when catalog changes.',
  },
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]['key'];

export const PIPELINE_STEP_KEYS: PipelineStepKey[] = PIPELINE_STEPS.map((step) => step.key);

export function isPipelineStepKey(value: unknown): value is PipelineStepKey {
  return typeof value === 'string' && PIPELINE_STEP_KEYS.includes(value as PipelineStepKey);
}

export function parseForceSteps(value: unknown): PipelineStepKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value.filter(isPipelineStepKey);
  return steps.length > 0 ? steps : undefined;
}

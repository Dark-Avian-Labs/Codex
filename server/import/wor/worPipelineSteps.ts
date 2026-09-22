export const WOR_PIPELINE_STEPS = [
  'schema',
  'fastidiousCatalog',
  'prospectorCatalog',
  'fandomImages',
  'fandomHeroStats',
  'manualOverrides',
  'seedValidation',
  'sync_accounts',
] as const;

export type WorPipelineStepKey = (typeof WOR_PIPELINE_STEPS)[number];

export const WOR_PIPELINE_STEP_LABELS: Record<WorPipelineStepKey, string> = {
  schema: 'Schema',
  fastidiousCatalog: 'Fastidious catalog',
  prospectorCatalog: 'Prospector catalog',
  fandomImages: 'Wiki images',
  fandomHeroStats: 'Wiki hero stats',
  manualOverrides: 'Manual overrides',
  seedValidation: 'Validation',
  sync_accounts: 'Sync accounts',
};

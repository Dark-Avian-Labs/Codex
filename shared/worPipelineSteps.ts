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

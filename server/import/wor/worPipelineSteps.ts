export const WOR_PIPELINE_STEPS = [
  'schema',
  'fastidiousCatalog',
  'fandomImages',
  'manualOverrides',
  'seedValidation',
  'sync_accounts',
] as const;

export type WorPipelineStepKey = (typeof WOR_PIPELINE_STEPS)[number];

export const WOR_PIPELINE_STEP_LABELS: Record<WorPipelineStepKey, string> = {
  schema: 'Schema',
  fastidiousCatalog: 'Fastidious catalog',
  fandomImages: 'Wiki images',
  manualOverrides: 'Manual overrides',
  seedValidation: 'Validation',
  sync_accounts: 'Sync accounts',
};

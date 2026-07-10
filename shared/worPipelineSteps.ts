export const WOR_PIPELINE_STEPS = ['load_catalog', 'apply_overrides', 'sync_accounts'] as const;
export type WorPipelineStepKey = (typeof WOR_PIPELINE_STEPS)[number];

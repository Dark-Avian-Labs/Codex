import { PIPELINE_STEPS } from './pipelineSteps.js';
import type { StartupPipelineSummary, StepSummaryBase } from './pipelineSummaryTypes.js';

export type PipelineSummaryStepKey = Exclude<
  keyof StartupPipelineSummary,
  'durationMs' | 'blockingIssues'
>;

export const MISSING_PIPELINE_STEP_SUMMARY: StepSummaryBase = {
  outcome: 'skipped',
  detail: 'No result recorded for this step.',
};

export function resolvePipelineStepSummary(
  summary: StartupPipelineSummary | null | undefined,
  key: PipelineSummaryStepKey,
): StepSummaryBase {
  const step = summary?.[key];
  if (step && typeof step === 'object' && 'outcome' in step && typeof step.outcome === 'string') {
    return step as StepSummaryBase;
  }
  return MISSING_PIPELINE_STEP_SUMMARY;
}

export function normalizeStartupPipelineSummary(
  summary: Partial<StartupPipelineSummary> | null | undefined,
): StartupPipelineSummary | null {
  if (!summary) return null;

  const normalized = { ...summary } as StartupPipelineSummary;
  for (const { key } of PIPELINE_STEPS) {
    const stepKey = key as PipelineSummaryStepKey;
    const existing = normalized[stepKey];
    if (
      !existing ||
      typeof existing !== 'object' ||
      !('outcome' in existing) ||
      typeof existing.outcome !== 'string'
    ) {
      (normalized as Record<PipelineSummaryStepKey, StepSummaryBase>)[stepKey] =
        MISSING_PIPELINE_STEP_SUMMARY;
    }
  }

  if (!Array.isArray(normalized.blockingIssues)) {
    normalized.blockingIssues = [];
  }
  if (typeof normalized.durationMs !== 'number' || Number.isNaN(normalized.durationMs)) {
    normalized.durationMs = 0;
  }

  return normalized;
}

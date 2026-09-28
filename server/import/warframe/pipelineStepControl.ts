import type { PipelineStepKey } from '../../../shared/warframeImport/pipelineSteps.js';

export interface PipelineStepControlOptions {
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: PipelineStepKey[];
}

export function isStepForced(step: PipelineStepKey, options: PipelineStepControlOptions): boolean {
  if (options.forceImport === true) return true;
  if (step === 'images' && options.forceImages === true) return true;
  return options.forceSteps?.includes(step) ?? false;
}

export function shouldRunStep(
  step: PipelineStepKey,
  wouldRun: boolean,
  options: PipelineStepControlOptions,
): boolean {
  if (isStepForced(step, options)) return true;
  return wouldRun;
}

export function usesOnlyMissingMode(
  step: PipelineStepKey,
  options: PipelineStepControlOptions,
): boolean {
  if (options.forceImport === true) return false;
  if (isStepForced(step, options)) return false;
  return true;
}

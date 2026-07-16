import type { WorPipelineStepKey } from './worPipelineSteps.js';

export type WorPipelineStepOptions = {
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: WorPipelineStepKey[];
};

export function shouldRunWorStep(
  step: WorPipelineStepKey,
  wouldRun: boolean,
  options: WorPipelineStepOptions,
): boolean {
  if (options.forceSteps?.includes(step)) return true;
  if (step === 'fastidiousCatalog' && options.forceImport) return true;
  if (step === 'fandomImages' && options.forceImages) return true;
  return wouldRun;
}

export function shouldFetchFastidiousCatalog(options: {
  live: boolean;
  sourcesChanged: boolean;
  forceImport?: boolean;
}): boolean {
  return Boolean(options.forceImport) || options.live || options.sourcesChanged;
}

export function worImagesOnlyMissing(options: WorPipelineStepOptions): boolean {
  return !options.forceImages && !options.forceSteps?.includes('fandomImages');
}

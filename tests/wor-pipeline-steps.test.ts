import { describe, expect, it } from 'vitest';

import { WOR_PIPELINE_STEPS as sharedSteps } from '../shared/worPipelineSteps.js';
import { WOR_PIPELINE_STEPS as serverSteps } from '../server/import/wor/worPipelineSteps.js';

describe('WoR pipeline step lists', () => {
  it('keeps shared and server step keys identical', () => {
    expect(serverSteps).toEqual(sharedSteps);
  });
});

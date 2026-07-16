import { describe, expect, it } from 'vitest';

import { shouldFetchFastidiousCatalog } from './pipelineStepControl.js';

describe('shouldFetchFastidiousCatalog', () => {
  it('always refreshes when live import is enabled', () => {
    expect(shouldFetchFastidiousCatalog({ live: true, sourcesChanged: false, forceImport: false })).toBe(true);
  });

  it('skips offline fetch when local cache hashes match the last processed import', () => {
    expect(shouldFetchFastidiousCatalog({ live: false, sourcesChanged: false, forceImport: false })).toBe(false);
  });

  it('refreshes offline when local cache hashes changed or forceImport is set', () => {
    expect(shouldFetchFastidiousCatalog({ live: false, sourcesChanged: true, forceImport: false })).toBe(true);
    expect(shouldFetchFastidiousCatalog({ live: false, sourcesChanged: false, forceImport: true })).toBe(true);
  });
});

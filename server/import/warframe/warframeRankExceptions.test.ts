import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { PROJECT_ROOT } from '../../config.js';
import {
  generateWarframeRankExceptions,
  hashWarframeRankExceptionsSource,
  isWarframeRankExceptionsSourceAvailable,
  warframeRankExceptionsSourceChanged,
} from './warframeRankExceptions.js';

const OUT_PATH = path.join(PROJECT_ROOT, 'shared/warframeImport/warframeRankExceptions.generated.ts');

describe('warframeRankExceptions', () => {
  it('has a committed source JSON in the repo', () => {
    expect(isWarframeRankExceptionsSourceAvailable()).toBe(true);
  });

  it('hashes the source JSON deterministically', () => {
    const first = hashWarframeRankExceptionsSource();
    const second = hashWarframeRankExceptionsSource();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it('regenerates the TypeScript registry from source JSON', () => {
    const before = fs.readFileSync(OUT_PATH, 'utf8');
    const result = generateWarframeRankExceptions();
    expect(result.entryCount).toBeGreaterThan(0);
    expect(warframeRankExceptionsSourceChanged()).toBe(false);
    expect(fs.readFileSync(OUT_PATH, 'utf8')).toBe(before);
  });
});

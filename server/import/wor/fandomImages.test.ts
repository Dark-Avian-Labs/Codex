import { describe, expect, it } from 'vitest';

import { isFastidiousFallbackPortrait, shouldAttemptPortraitDownload } from './fandomImages.js';

describe('isFastidiousFallbackPortrait', () => {
  it('detects Fastidious card webp paths', () => {
    expect(isFastidiousFallbackPortrait('/wor-images/heroes/cainan.webp')).toBe(true);
    expect(isFastidiousFallbackPortrait('/wor-images/artifacts/foo.WEBP')).toBe(true);
  });

  it('treats wiki-style extensions as non-fallback', () => {
    expect(isFastidiousFallbackPortrait('/wor-images/heroes/cainan.png')).toBe(false);
    expect(isFastidiousFallbackPortrait('/wor-images/heroes/cainan.jpg')).toBe(false);
    expect(isFastidiousFallbackPortrait(null)).toBe(false);
  });
});

describe('shouldAttemptPortraitDownload', () => {
  it('always attempts when forced or when onlyMissing is disabled', () => {
    expect(
      shouldAttemptPortraitDownload({
        existingPath: '/wor-images/heroes/a.png',
        fileExists: true,
        onlyMissing: true,
        forceDownload: true,
      }),
    ).toBe(true);
    expect(
      shouldAttemptPortraitDownload({
        existingPath: '/wor-images/heroes/a.png',
        fileExists: true,
        onlyMissing: false,
        forceDownload: false,
      }),
    ).toBe(true);
  });

  it('attempts when missing on disk', () => {
    expect(
      shouldAttemptPortraitDownload({
        existingPath: null,
        fileExists: false,
        onlyMissing: true,
        forceDownload: false,
      }),
    ).toBe(true);
    expect(
      shouldAttemptPortraitDownload({
        existingPath: '/wor-images/heroes/a.png',
        fileExists: false,
        onlyMissing: true,
        forceDownload: false,
      }),
    ).toBe(true);
  });

  it('attempts when only a Fastidious fallback card exists', () => {
    expect(
      shouldAttemptPortraitDownload({
        existingPath: '/wor-images/heroes/a.webp',
        fileExists: true,
        onlyMissing: true,
        forceDownload: false,
      }),
    ).toBe(true);
  });

  it('skips when a non-fallback portrait already exists', () => {
    expect(
      shouldAttemptPortraitDownload({
        existingPath: '/wor-images/heroes/a.png',
        fileExists: true,
        onlyMissing: true,
        forceDownload: false,
      }),
    ).toBe(false);
  });
});

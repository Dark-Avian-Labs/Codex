import { isPrimeVariantName, normalizeDisplayName, resolveCanonicalKey, stripPrimeSuffix } from '@codex/game-warframe';
import { describe, expect, it } from 'vitest';

describe('warframe sync canonicalization', () => {
  it('normalizes messy display strings from exports (prefixes, modes, primes)', () => {
    expect(normalizeDisplayName('<ARCHWING> Odonata Prime')).toBe('Odonata Prime');
    expect(normalizeDisplayName('Hate (Heavy Scythe)')).toBe('Hate');
    expect(stripPrimeSuffix('Braton Prime')).toBe('Braton');
    expect(stripPrimeSuffix('Excalibur Umbra Prime')).toBe('Excalibur Umbra');
    expect(resolveCanonicalKey('<ARCHWING> Odonata Prime')).toBe('odonata');
    expect(resolveCanonicalKey('Excalibur Umbra')).toBe('excalibur umbra');
  });

  it('normalizes empty or whitespace-only labels to an empty string', () => {
    expect(resolveCanonicalKey('')).toBe('');
    expect(normalizeDisplayName('   ')).toBe('');
  });

  it('classifies prime variants for dedup rules', () => {
    expect(isPrimeVariantName('Gotva Prime')).toBe(true);
    expect(isPrimeVariantName('Gotva')).toBe(false);
  });
});

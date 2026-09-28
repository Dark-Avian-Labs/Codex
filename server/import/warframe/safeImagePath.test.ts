import path from 'path';

import { describe, expect, it } from 'vitest';

import { IMAGES_DIR } from '../../config.js';
import { assertUnderImagesRoot, safeImagePathUnderRoot, sanitizeUniqueNameSegments } from './safeImagePath.js';

describe('safeImagePath', () => {
  it('sanitizes uniqueName segments and resolves under images root', () => {
    const segments = sanitizeUniqueNameSegments('/Lotus/Types/Weapons/Foo');
    expect(segments).toEqual(['Lotus', 'Types', 'Weapons', 'Foo']);
    const resolved = safeImagePathUnderRoot([...segments.slice(0, -1), `${segments.at(-1)}.png`]);
    expect(resolved.startsWith(path.resolve(IMAGES_DIR) + path.sep)).toBe(true);
  });

  it('rejects absolute and parent segments', () => {
    expect(() => sanitizeUniqueNameSegments('..')).toThrow();
    expect(() => sanitizeUniqueNameSegments('.')).toThrow();
    expect(() => sanitizeUniqueNameSegments('/Lotus/Types/../Weapons/Foo')).toThrow();
    expect(() => safeImagePathUnderRoot(['..', 'etc', 'passwd'])).toThrow();
    const escapeAttempt = path.join(IMAGES_DIR, '..', 'outside.png');
    expect(() => assertUnderImagesRoot(escapeAttempt)).toThrow();
  });
});

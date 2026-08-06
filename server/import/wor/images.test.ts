import { describe, expect, it } from 'vitest';

import {
  assertTrustedImageUrl,
  detectImageType,
  isAllowedImageHost,
  relativeImagePathWithExtension,
} from './images.js';

describe('isAllowedImageHost', () => {
  it('allows Fastidious and Fandom CDN hosts', () => {
    expect(isAllowedImageHost('fastidious.gg')).toBe(true);
    expect(isAllowedImageHost('www.fastidious.gg')).toBe(true);
    expect(isAllowedImageHost('static.wikia.nocookie.net')).toBe(true);
    expect(isAllowedImageHost('vignette.wikia.nocookie.net')).toBe(true);
    expect(isAllowedImageHost('images.wikia.com')).toBe(true);
    expect(isAllowedImageHost('foo.wikia.nocookie.net')).toBe(true);
  });

  it('rejects unrelated hosts', () => {
    expect(isAllowedImageHost('evil.example.com')).toBe(false);
    expect(isAllowedImageHost('wikia.nocookie.net.evil.com')).toBe(false);
    expect(isAllowedImageHost('localhost')).toBe(false);
  });
});

describe('assertTrustedImageUrl', () => {
  it('requires https and allowed host', () => {
    expect(() => assertTrustedImageUrl('https://fastidious.gg/storage/a.webp')).not.toThrow();
    expect(() => assertTrustedImageUrl('http://fastidious.gg/storage/a.webp')).toThrow(/HTTPS/);
    expect(() => assertTrustedImageUrl('https://evil.example/a.png')).toThrow(/not allowed/);
  });
});

describe('detectImageType', () => {
  it('detects png/jpeg/webp/gif/svg and rejects html', () => {
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('.png');
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('.jpg');
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.write('WEBP', 8);
    expect(detectImageType(webp)?.ext).toBe('.webp');
    expect(detectImageType(Buffer.from('GIF89a'))?.ext).toBe('.gif');
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))?.ext).toBe('.svg');
    expect(detectImageType(Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>'))?.ext).toBe('.svg');
    expect(detectImageType(Buffer.from('<!DOCTYPE html><html><body>x</body></html>'))).toBeNull();
    expect(detectImageType(Buffer.from('<html><body>x</body></html>'))).toBeNull();
  });
});

describe('relativeImagePathWithExtension', () => {
  it('never derives executable extensions from the URL', () => {
    expect(relativeImagePathWithExtension('heroes/cainan.html', 'https://evil/x.js', 'text/html')).toBe(
      'heroes/cainan.png',
    );
    expect(relativeImagePathWithExtension('heroes/cainan', 'https://fastidious.gg/a.webp', 'image/webp')).toBe(
      'heroes/cainan.webp',
    );
  });
});

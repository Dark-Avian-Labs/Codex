import path from 'path';

import { IMAGES_DIR } from '../../config.js';

const FORBIDDEN_SEGMENT_CHARS = new Set(['<', '>', ':', '"', '|', '?', '*']);

export function sanitizePathSegment(segment: string): string {
  let out = '';
  for (const ch of segment) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || FORBIDDEN_SEGMENT_CHARS.has(ch)) {
      out += '_';
    } else {
      out += ch;
    }
  }
  return out;
}

export function assertUnderImagesRoot(candidatePath: string, imagesRoot = IMAGES_DIR): string {
  const root = path.resolve(imagesRoot);
  const resolved = path.resolve(candidatePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes images directory: ${candidatePath}`);
  }
  return resolved;
}

function assertSafeSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    throw new Error(`Invalid path segment: ${segment}`);
  }
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.includes('\0')) {
    throw new Error(`Invalid path segment: ${segment}`);
  }
  return sanitizePathSegment(trimmed);
}

export function sanitizeUniqueNameSegments(uniqueName: string): string[] {
  const withoutLeading = uniqueName.replace(/^[/\\]+/, '');
  const raw = withoutLeading.split(/[/\\]+/).filter(Boolean);
  if (raw.length === 0) {
    throw new Error('Empty image path');
  }
  return raw.map(assertSafeSegment);
}

export function safeImagePathUnderRoot(
  relativeParts: string | string[],
  imagesRoot = IMAGES_DIR,
): string {
  const parts = Array.isArray(relativeParts) ? relativeParts : [relativeParts];
  const segments = parts.flatMap((part) => sanitizeUniqueNameSegments(part));
  const joined = path.join(imagesRoot, ...segments);
  return assertUnderImagesRoot(joined, imagesRoot);
}

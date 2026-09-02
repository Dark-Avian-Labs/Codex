import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { WOR_IMAGES_DIR } from '../../config.js';
import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../http/fetchWithTimeout.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg'] as const;
export type AllowedImageExtension = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

const ALLOWED_IMAGE_EXT_SET = new Set<string>(ALLOWED_IMAGE_EXTENSIONS);

const IMAGE_CONTENT_TYPES: Record<AllowedImageExtension, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const ALLOWED_IMAGE_HOSTS = new Set([
  'fastidious.gg',
  'www.fastidious.gg',
  'static.wikia.nocookie.net',
  'vignette.wikia.nocookie.net',
  'images.wikia.com',
]);

type DetectedImage = {
  ext: AllowedImageExtension;
  mime: string;
};

export type ImageDownloadResult = {
  relativePath: string;
  status: 'downloaded' | 'skipped' | 'failed';
  error?: string;
};

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (ALLOWED_IMAGE_HOSTS.has(host)) return true;
  return host.endsWith('.wikia.nocookie.net');
}

export function assertTrustedImageUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('invalid image URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('image URL must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('image URL must not include credentials');
  }
  if (!isAllowedImageHost(url.hostname)) {
    throw new Error(`image host not allowed: ${url.hostname}`);
  }
  return url;
}

function detectSvgImage(buffer: Buffer): DetectedImage | null {
  const head = buffer
    .subarray(0, Math.min(buffer.length, 512))
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (/^<!DOCTYPE\s+html/i.test(head) || /^<html[\s>]/i.test(head)) {
    return null;
  }
  const stripped = head
    .replace(/^<\?xml\b[^>]*\?>\s*/i, '')
    .replace(/^(?:<!--[\s\S]*?-->\s*)+/g, '');
  if (/^<svg[\s>]/i.test(stripped)) {
    return { ext: '.svg', mime: 'image/svg+xml' };
  }
  return null;
}

export function detectImageType(buffer: Buffer): DetectedImage | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  if (buffer.length >= 6) {
    const gifHeader = buffer.toString('ascii', 0, 6);
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return { ext: '.gif', mime: 'image/gif' };
    }
  }
  return detectSvgImage(buffer);
}

function contentTypeLooksLikeImage(contentType: string | null): boolean {
  if (!contentType) return true;
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!mime || mime === 'application/octet-stream') return true;
  return (
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/webp' ||
    mime === 'image/gif' ||
    mime === 'image/svg+xml' ||
    mime === 'text/xml' ||
    mime === 'application/xml'
  );
}

export async function readResponseBodyCapped(
  response: Response,
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<Buffer> {
  if (!response.body) {
    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`response exceeds ${maxBytes} bytes`);
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`response exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel failures
    }
    throw error;
  }
  return Buffer.concat(chunks);
}

function stripExtension(relativePath: string): string {
  return relativePath.replace(/\.[a-z0-9]+$/i, '');
}

export function resolveWorImagePath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (path.isAbsolute(normalized) || normalized.includes('..')) {
    return null;
  }
  const ext = path.extname(normalized).toLowerCase();
  if (!ALLOWED_IMAGE_EXT_SET.has(ext)) {
    return null;
  }
  const imagesRoot = path.resolve(WOR_IMAGES_DIR);
  const localPath = path.resolve(imagesRoot, normalized);
  if (localPath !== imagesRoot && !localPath.startsWith(`${imagesRoot}${path.sep}`)) {
    return null;
  }
  return localPath;
}

export function contentTypeForImagePath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase() as AllowedImageExtension;
  return IMAGE_CONTENT_TYPES[ext] ?? null;
}

export function isAllowedImageExtension(ext: string): boolean {
  return ALLOWED_IMAGE_EXT_SET.has(ext.toLowerCase());
}

export async function downloadImageToWorDir(options: {
  url: string;
  relativePath: string;
  forceDownload?: boolean;
  requireExactExtension?: boolean;
  headers?: Record<string, string>;
}): Promise<ImageDownloadResult> {
  let trustedUrl: URL;
  try {
    trustedUrl = assertTrustedImageUrl(options.url);
  } catch (error) {
    return {
      relativePath: options.relativePath,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const baseRelative = stripExtension(options.relativePath);
  if (
    !baseRelative ||
    baseRelative.includes('..') ||
    path.isAbsolute(baseRelative) ||
    path.normalize(baseRelative).startsWith('..')
  ) {
    return {
      relativePath: options.relativePath,
      status: 'failed',
      error: 'invalid relative path',
    };
  }

  if (!options.forceDownload) {
    if (options.requireExactExtension) {
      const hintedExt = path.extname(options.relativePath).toLowerCase();
      const exactRelative = isAllowedImageExtension(hintedExt)
        ? `${baseRelative}${hintedExt}`
        : options.relativePath;
      const exactLocal = resolveWorImagePath(exactRelative);
      if (exactLocal && fs.existsSync(exactLocal)) {
        return { relativePath: exactRelative, status: 'skipped' };
      }
    } else {
      for (const ext of ALLOWED_IMAGE_EXTENSIONS) {
        const candidateRelative = `${baseRelative}${ext}`;
        const candidateLocal = resolveWorImagePath(candidateRelative);
        if (candidateLocal && fs.existsSync(candidateLocal)) {
          return { relativePath: candidateRelative, status: 'skipped' };
        }
      }
    }
  }

  try {
    const response = await fetchWithTimeout(
      trustedUrl,
      {
        headers: options.headers,
        redirect: 'error',
      },
      FETCH_TIMEOUT_MS.binaryImage,
    );
    if (!response.ok) {
      return {
        relativePath: options.relativePath,
        status: 'failed',
        error: `HTTP ${response.status}`,
      };
    }

    const headerType = response.headers.get('content-type');
    if (!contentTypeLooksLikeImage(headerType)) {
      return {
        relativePath: options.relativePath,
        status: 'failed',
        error: `unexpected content-type: ${headerType}`,
      };
    }

    const buffer = await readResponseBodyCapped(response, MAX_IMAGE_BYTES);
    if (buffer.length === 0) {
      return { relativePath: options.relativePath, status: 'failed', error: 'empty body' };
    }

    const detected = detectImageType(buffer);
    if (!detected) {
      return {
        relativePath: options.relativePath,
        status: 'failed',
        error: 'unrecognized image magic bytes',
      };
    }

    const relativePath = `${baseRelative}${detected.ext}`;
    const localPath = resolveWorImagePath(relativePath);
    if (!localPath) {
      return {
        relativePath,
        status: 'failed',
        error: 'invalid relative path',
      };
    }

    const hashPath = `${localPath}.hash`;
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const nextHash = hashBuffer(buffer);
    fs.writeFileSync(localPath, buffer);
    fs.writeFileSync(hashPath, `${nextHash}\n`, 'utf8');
    return { relativePath, status: 'downloaded' };
  } catch (error) {
    return {
      relativePath: options.relativePath,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function writeTacticianClassIconSvg(): void {
  const dest = path.join(WOR_IMAGES_DIR, 'icons', 'classes', 'tactician.svg');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(
    dest,
    `<svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path fill="white" fill-rule="evenodd" clip-rule="evenodd" d="M6 4h5v3.2h3.2V4h3.6v3.2H21V4h5v6.2h-2.4v8.6h2.2v3.4H6.2v-3.4h2.2V10.2H6V4zm3.4 20.4h13.2v2.2H9.4v-2.2zm-2.2 3.2h17.6V30H7.2v-2.4z"/>
</svg>
`,
  );
}

export function worImageWebPath(relativePath: string): string {
  return `/wor-images/${relativePath.replace(/\\/g, '/')}`;
}

export function buildFastidiousStorageUrl(
  storageUrl: string,
  storageVersion: string,
  fileName: string,
): string {
  const base = storageUrl.endsWith('/') ? storageUrl : `${storageUrl}/`;
  return `${base}${fileName}?v=${storageVersion}`;
}

export function relativeImagePathWithExtension(
  baseRelativePath: string,
  _url: string,
  contentType: string | null,
): string {
  const withoutExt = stripExtension(baseRelativePath);
  if (contentType?.includes('svg')) return `${withoutExt}.svg`;
  if (contentType?.includes('webp')) return `${withoutExt}.webp`;
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return `${withoutExt}.jpg`;
  if (contentType?.includes('gif')) return `${withoutExt}.gif`;
  if (contentType?.includes('png')) return `${withoutExt}.png`;
  return `${withoutExt}.png`;
}

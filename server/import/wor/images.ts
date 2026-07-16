import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { WOR_IMAGES_DIR } from '../../config.js';
import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../http/fetchWithTimeout.js';

export type ImageDownloadResult = {
  relativePath: string;
  status: 'downloaded' | 'skipped' | 'failed';
  error?: string;
};

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function extensionFromUrl(url: string, contentType: string | null): string {
  const fromUrl = path.extname(new URL(url).pathname);
  if (fromUrl) return fromUrl;
  if (contentType?.includes('svg')) return '.svg';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('png')) return '.png';
  return '.png';
}

function resolveWorImagePath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (path.isAbsolute(normalized) || normalized.includes('..')) {
    return null;
  }
  const imagesRoot = path.resolve(WOR_IMAGES_DIR);
  const localPath = path.resolve(imagesRoot, normalized);
  if (localPath !== imagesRoot && !localPath.startsWith(`${imagesRoot}${path.sep}`)) {
    return null;
  }
  return localPath;
}

export async function downloadImageToWorDir(options: {
  url: string;
  relativePath: string;
  forceDownload?: boolean;
  headers?: Record<string, string>;
}): Promise<ImageDownloadResult> {
  const localPath = resolveWorImagePath(options.relativePath);
  if (!localPath) {
    return {
      relativePath: options.relativePath,
      status: 'failed',
      error: 'invalid relative path',
    };
  }
  const hashPath = `${localPath}.hash`;
  fs.mkdirSync(path.dirname(localPath), { recursive: true });

  if (!options.forceDownload && fs.existsSync(localPath)) {
    return { relativePath: options.relativePath, status: 'skipped' };
  }

  try {
    const response = await fetchWithTimeout(
      options.url,
      { headers: options.headers },
      FETCH_TIMEOUT_MS.binaryImage,
    );
    if (!response.ok) {
      return {
        relativePath: options.relativePath,
        status: 'failed',
        error: `HTTP ${response.status}`,
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      return { relativePath: options.relativePath, status: 'failed', error: 'empty body' };
    }
    const nextHash = hashBuffer(buffer);
    fs.writeFileSync(localPath, buffer);
    fs.writeFileSync(hashPath, `${nextHash}\n`, 'utf8');
    return { relativePath: options.relativePath, status: 'downloaded' };
  } catch (error) {
    return {
      relativePath: options.relativePath,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
  url: string,
  contentType: string | null,
): string {
  const ext = extensionFromUrl(url, contentType);
  const withoutExt = baseRelativePath.replace(/\.[a-z0-9]+$/i, '');
  return `${withoutExt}${ext}`;
}

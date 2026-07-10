import fs from 'node:fs';
import path from 'node:path';

import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../http/fetchWithTimeout.js';
import { FASTIDIOUS_BASE_URL } from './paths.js';

export type FastidiousInertiaPage<TProps> = {
  component: string;
  props: TProps;
};

function decodeInertiaPayload(encoded: string): string {
  return encoded
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'");
}

export function parseInertiaHtml<TProps>(html: string): FastidiousInertiaPage<TProps> {
  const match = html.match(/data-page="([^"]+)"/);
  if (!match) {
    throw new Error('Fastidious page missing Inertia data-page payload');
  }
  return JSON.parse(decodeInertiaPayload(match[1])) as FastidiousInertiaPage<TProps>;
}

function fastidiousUserAgent(): string {
  return process.env.WOR_FASTIDIOUS_USER_AGENT?.trim() || 'CodexWoRImport/1.0';
}

export async function fetchFastidiousInertiaPage<TProps>(routePath: string): Promise<{
  page: FastidiousInertiaPage<TProps>;
  rawHtml: string;
}> {
  const url = `${FASTIDIOUS_BASE_URL}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
  const response = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': fastidiousUserAgent(), Accept: 'text/html' } },
    FETCH_TIMEOUT_MS.htmlPage,
  );
  if (!response.ok) {
    throw new Error(`Fastidious fetch failed (${response.status}) for ${url}`);
  }
  const rawHtml = await response.text();
  return { page: parseInertiaHtml<TProps>(rawHtml), rawHtml };
}

export function sanitizeCacheSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    return null;
  }
  return trimmed;
}

export function readCachedJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeCachedJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function loadOrFetchJsonCache<T>(
  cachePath: string,
  live: boolean,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!live && fs.existsSync(cachePath)) {
    return readCachedJson<T>(cachePath);
  }
  const value = await fetcher();
  writeCachedJson(cachePath, value);
  return value;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

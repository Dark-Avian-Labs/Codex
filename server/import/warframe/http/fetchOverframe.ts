import {
  Cuimp,
  createCuimpHttp,
  type CuimpDescriptorInput,
  type CuimpHttp,
  type CuimpOptions,
} from 'cuimp';

import { FETCH_BYTE_LIMITS, FETCH_TIMEOUT_MS } from './fetchWithTimeout.js';

const OVERFRAME_BASE_URL = 'https://overframe.gg';
const BUILD_ID_BOOTSTRAP_PATH = '/build/new/warframes/';

const OVERFRAME_DESCRIPTOR_FALLBACKS: CuimpDescriptorInput[] = [
  { browser: 'chrome', version: '146' },
  { browser: 'chrome', version: '131' },
  { browser: 'chrome', version: '120' },
  { browser: 'firefox', version: '133' },
];

const silentLogger: CuimpOptions['logger'] = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

function overframeCuimpOptions(descriptor: CuimpDescriptorInput): CuimpOptions {
  const proxy = process.env.OVERFRAME_PROXY?.trim();
  const path = process.env.OVERFRAME_CUIMP_BINARY_PATH?.trim();
  return {
    descriptor,
    path: path || undefined,
    proxy: proxy || undefined,
    logger: silentLogger,
  };
}

const overframeClients: CuimpHttp[] = OVERFRAME_DESCRIPTOR_FALLBACKS.map((descriptor) =>
  createCuimpHttp(overframeCuimpOptions(descriptor)),
);

let activeClientIndex = 0;
let cachedBuildId: string | null = null;
let warmUpPromise: Promise<void> | null = null;

function descriptorLabel(descriptor: CuimpDescriptorInput): string {
  if (typeof descriptor === 'string') return descriptor;
  const browser = descriptor.browser ?? 'chrome';
  const version = descriptor.version ?? '?';
  return `${browser}${version}`;
}

export function resetOverframeSession(): void {
  cachedBuildId = null;
  warmUpPromise = null;
}

export function getOverframeBuildId(): string | null {
  return cachedBuildId;
}

export function extractBuildIdFromHtml(html: string): string | null {
  const nextData = extractFullNextDataFromHtml(html);
  return typeof nextData?.buildId === 'string' && nextData.buildId.length > 0
    ? nextData.buildId
    : null;
}

export function extractFullNextDataFromHtml(html: string): Record<string, unknown> | null {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const end = html.indexOf('</script>', start);
  if (end < 0) return null;

  try {
    const parsed = JSON.parse(html.slice(start + marker.length, end)) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toAbsoluteOverframeUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    let parsed: URL;
    try {
      parsed = new URL(pathOrUrl);
    } catch {
      throw new Error(`Invalid Overframe URL: ${pathOrUrl}`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`Overframe URL must be HTTPS: ${pathOrUrl}`);
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== 'overframe.gg' && host !== 'media.overframe.gg') {
      throw new Error(`Overframe URL host not allowed: ${host}`);
    }
    return parsed.toString();
  }
  return `${OVERFRAME_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function responseBodyText(rawBody: Buffer, data: unknown): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (rawBody.length > 0) return rawBody.toString('utf-8');
  if (data !== null && data !== undefined) return JSON.stringify(data);
  return '';
}

type OverframeHttpFailureKind =
  | 'cloudflare-bot-block'
  | 'cloudflare-challenge'
  | 'origin-forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'service-unavailable'
  | 'unknown';

interface OverframeHttpFailureDetails {
  kind: OverframeHttpFailureKind;
  status: number;
  url: string;
  cfRay?: string;
  server?: string;
  bodySnippet?: string;
}

export class OverframeFetchError extends Error {
  readonly details: OverframeHttpFailureDetails;

  constructor(details: OverframeHttpFailureDetails) {
    super(formatOverframeFetchErrorMessage(details));
    this.name = 'OverframeFetchError';
    this.details = details;
  }
}

function normalizeResponseHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function bodySnippet(body: string, maxLength = 140): string | undefined {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

function failureKindLabel(kind: OverframeHttpFailureKind): string {
  switch (kind) {
    case 'cloudflare-bot-block':
      return 'Cloudflare bot/WAF block';
    case 'cloudflare-challenge':
      return 'Cloudflare challenge page';
    case 'origin-forbidden':
      return 'origin forbidden';
    case 'not-found':
      return 'not found';
    case 'rate-limited':
      return 'rate limited';
    case 'service-unavailable':
      return 'service unavailable';
    default:
      return 'request failed';
  }
}

function classifyHttpFailure(
  status: number,
  url: string,
  headers: Record<string, string>,
  body: string,
): OverframeHttpFailureDetails {
  const normalizedHeaders = normalizeResponseHeaders(headers);
  const cfRay = normalizedHeaders['cf-ray'];
  const server = normalizedHeaders['server'];
  const cfMitigated = normalizedHeaders['cf-mitigated'];
  const bodyLower = body.toLowerCase();

  const hasCloudflareHeader =
    !!cfRay ||
    server?.toLowerCase().includes('cloudflare') ||
    !!normalizedHeaders['cf-cache-status'];
  const hasChallengeBody =
    bodyLower.includes('just a moment') ||
    bodyLower.includes('checking your browser') ||
    bodyLower.includes('enable javascript and cookies') ||
    bodyLower.includes('cf-browser-verification') ||
    bodyLower.includes('challenge-platform') ||
    bodyLower.includes('attention required! | cloudflare');
  const hasCloudflareBody =
    hasChallengeBody || bodyLower.includes('cloudflare') || bodyLower.includes('/cdn-cgi/');

  const isCloudflare = hasCloudflareHeader || hasCloudflareBody;
  const isChallenge =
    hasChallengeBody ||
    cfMitigated?.toLowerCase().includes('challenge') ||
    cfMitigated?.toLowerCase().includes('managed');

  const base = {
    status,
    url,
    cfRay,
    server,
    bodySnippet: bodySnippet(body),
  };

  if (status === 403) {
    if (isChallenge) {
      return { ...base, kind: 'cloudflare-challenge' };
    }
    if (isCloudflare) {
      return { ...base, kind: 'cloudflare-bot-block' };
    }
    return { ...base, kind: 'origin-forbidden' };
  }

  if (status === 404) {
    return { ...base, kind: 'not-found' };
  }

  if (status === 429) {
    return { ...base, kind: isCloudflare ? 'cloudflare-bot-block' : 'rate-limited' };
  }

  if (status === 503) {
    return { ...base, kind: 'service-unavailable' };
  }

  return { ...base, kind: 'unknown' };
}

function formatOverframeFetchErrorMessage(details: OverframeHttpFailureDetails): string {
  const parts = [
    `Failed to fetch ${details.url}: HTTP ${details.status} (${failureKindLabel(details.kind)})`,
  ];

  switch (details.kind) {
    case 'cloudflare-bot-block':
      parts.push(
        'Cloudflare rejected the request before Overframe served content. This usually means the server IP, datacenter egress, or TLS fingerprint is blocked — not that the URL is wrong.',
      );
      break;
    case 'cloudflare-challenge':
      parts.push(
        'Cloudflare returned an interactive browser challenge (JavaScript/cookie check). cuimp cannot complete these challenges automatically.',
      );
      break;
    case 'origin-forbidden':
      parts.push(
        'Overframe (or its origin) returned 403 without a Cloudflare challenge page. The route may be restricted or unavailable to unauthenticated clients.',
      );
      break;
    case 'not-found':
      parts.push('The requested Overframe page or JSON route was not found.');
      break;
    case 'rate-limited':
      parts.push(
        'The server returned HTTP 429 (too many requests). Try again later or reduce scrape concurrency.',
      );
      break;
    case 'service-unavailable':
      parts.push('The server returned HTTP 503 (temporarily unavailable).');
      break;
    default:
      parts.push('The request failed with a non-success HTTP status.');
      break;
  }

  if (details.cfRay) {
    parts.push(`cf-ray: ${details.cfRay}`);
  }
  if (details.server) {
    parts.push(`server: ${details.server}`);
  }
  if (details.bodySnippet) {
    parts.push(`response preview: ${details.bodySnippet}`);
  }

  return parts.join(' ');
}

function createHttpStatusError(
  status: number,
  url: string,
  headers: Record<string, string>,
  body: string,
): OverframeFetchError {
  return new OverframeFetchError(classifyHttpFailure(status, url, headers, body));
}

function getHttpStatusFromError(error: unknown): number | null {
  if (error instanceof OverframeFetchError) return error.details.status;
  if (error instanceof Error) {
    const match = error.message.match(/: HTTP (\d{3})\b|: (\d{3})\b/);
    if (match) return Number(match[1] ?? match[2]);
  }
  return null;
}

function isHttpStatusError(error: unknown, status: number): boolean {
  return getHttpStatusFromError(error) === status;
}

async function fetchOverframeRawWithClient(
  client: CuimpHttp,
  url: string,
  timeoutMs: number,
): Promise<{ status: number; body: string; rawBody: Buffer }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.get(url, { signal: controller.signal });
    const body = responseBodyText(response.rawBody, response.data);
    if (response.status < 200 || response.status >= 300) {
      throw createHttpStatusError(response.status, url, response.headers, body);
    }
    return { status: response.status, body, rawBody: response.rawBody };
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Failed to fetch ${url}: timed out after ${timeoutMs}ms`);
      timeoutError.name = 'AbortError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOverframeRaw(
  pathOrUrl: string,
  timeoutMs: number,
): Promise<{ status: number; body: string; rawBody: Buffer }> {
  const url = toAbsoluteOverframeUrl(pathOrUrl);
  let lastError: unknown;

  for (let attempt = 0; attempt < overframeClients.length; attempt++) {
    const clientIndex = (activeClientIndex + attempt) % overframeClients.length;
    const client = overframeClients[clientIndex];

    try {
      const result = await fetchOverframeRawWithClient(client, url, timeoutMs);
      activeClientIndex = clientIndex;
      return result;
    } catch (error: unknown) {
      lastError = error;
      const retryable =
        isHttpStatusError(error, 403) ||
        isHttpStatusError(error, 429) ||
        isHttpStatusError(error, 503);
      if (retryable && attempt < overframeClients.length - 1) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function warmUpOverframeFetch(): Promise<void> {
  const errors: string[] = [];

  for (let i = 0; i < OVERFRAME_DESCRIPTOR_FALLBACKS.length; i++) {
    const descriptor = OVERFRAME_DESCRIPTOR_FALLBACKS[i];
    const label = descriptorLabel(descriptor);

    try {
      const core = new Cuimp(overframeCuimpOptions(descriptor));
      await core.verifyBinary();
    } catch (error: unknown) {
      errors.push(`${label} binary: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    try {
      const url = toAbsoluteOverframeUrl(BUILD_ID_BOOTSTRAP_PATH);
      const result = await fetchOverframeRawWithClient(
        overframeClients[i],
        url,
        FETCH_TIMEOUT_MS.htmlPage,
      );
      activeClientIndex = i;
      const buildId = extractBuildIdFromHtml(result.body);
      if (buildId) {
        cachedBuildId = buildId;
      }
      return;
    } catch (error: unknown) {
      errors.push(`${label} fetch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const cloudflareBlocks = errors.filter((entry) =>
    /Cloudflare (bot\/WAF block|challenge page)/.test(entry),
  );
  const hint =
    cloudflareBlocks.length > 0
      ? 'Cloudflare blocked every browser fingerprint. Use a residential/non-datacenter egress via OVERFRAME_PROXY, or run imports from a network that can reach Overframe.'
      : 'Common causes: missing cuimp binary for the node user, blocked binary download, or unreachable Overframe routes. Set OVERFRAME_CUIMP_BINARY_PATH or OVERFRAME_PROXY if needed.';

  throw new Error(
    `Overframe warm-up failed for all cuimp browser fingerprints. ${hint} Details: ${errors.join('; ')}`,
  );
}

export async function ensureOverframeFetchReady(): Promise<void> {
  if (!warmUpPromise) {
    warmUpPromise = warmUpOverframeFetch().catch((error) => {
      warmUpPromise = null;
      throw error;
    });
  }
  await warmUpPromise;
}

export async function fetchOverframeHtml(
  path: string,
  timeoutMs: number = FETCH_TIMEOUT_MS.htmlPage,
): Promise<string> {
  await ensureOverframeFetchReady();
  const { body } = await fetchOverframeRaw(path, timeoutMs);
  if (Buffer.byteLength(body, 'utf8') > FETCH_BYTE_LIMITS.html) {
    throw new Error(`Overframe HTML exceeded ${FETCH_BYTE_LIMITS.html} byte limit`);
  }
  const buildId = extractBuildIdFromHtml(body);
  if (buildId) {
    cachedBuildId ??= buildId;
  }
  return body;
}

export async function fetchOverframeBytes(
  pathOrUrl: string,
  timeoutMs: number = FETCH_TIMEOUT_MS.binaryImage,
): Promise<Buffer> {
  await ensureOverframeFetchReady();
  const { rawBody } = await fetchOverframeRaw(pathOrUrl, timeoutMs);
  if (rawBody.length > FETCH_BYTE_LIMITS.image) {
    throw new Error(`Overframe binary exceeded ${FETCH_BYTE_LIMITS.image} byte limit`);
  }
  return rawBody;
}

export async function ensureOverframeBuildId(): Promise<string> {
  if (cachedBuildId) return cachedBuildId;

  await ensureOverframeFetchReady();
  if (cachedBuildId) return cachedBuildId;

  const html = await fetchOverframeHtml(BUILD_ID_BOOTSTRAP_PATH, FETCH_TIMEOUT_MS.htmlPage);
  const buildId = extractBuildIdFromHtml(html);
  if (!buildId) {
    throw new Error('Failed to extract Overframe buildId from bootstrap page');
  }

  cachedBuildId = buildId;
  return buildId;
}

export function overframeJsonPath(pagePath: string, buildId: string): string {
  const normalized = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const withoutTrailingSlash = normalized.replace(/\/+$/, '');
  return `/_next/data/${buildId}${withoutTrailingSlash}.json`;
}

export async function fetchOverframePageJson<T>(
  pagePath: string,
  timeoutMs: number = FETCH_TIMEOUT_MS.overframeDetailHtml,
): Promise<T> {
  await ensureOverframeFetchReady();

  async function loadJson(buildId: string): Promise<T> {
    const jsonPath = overframeJsonPath(pagePath, buildId);
    const { body } = await fetchOverframeRaw(jsonPath, timeoutMs);
    try {
      return JSON.parse(body) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse Overframe JSON for ${pagePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  let buildId = await ensureOverframeBuildId();
  let jsonError: unknown;

  try {
    return await loadJson(buildId);
  } catch (error: unknown) {
    jsonError = error;
    if (isHttpStatusError(error, 404)) {
      cachedBuildId = null;
      const refreshedBuildId = await ensureOverframeBuildId();
      if (refreshedBuildId !== buildId) {
        buildId = refreshedBuildId;
        try {
          return await loadJson(buildId);
        } catch (retryError: unknown) {
          jsonError = retryError;
        }
      }
    }
  }

  const retryableJsonFailure =
    isHttpStatusError(jsonError, 403) ||
    isHttpStatusError(jsonError, 404) ||
    isHttpStatusError(jsonError, 429);

  if (!retryableJsonFailure) {
    throw jsonError;
  }

  try {
    const html = await fetchOverframeHtml(pagePath, Math.max(timeoutMs, FETCH_TIMEOUT_MS.htmlPage));
    const nextData = extractFullNextDataFromHtml(html);
    const pageProps = (nextData?.props as { pageProps?: unknown } | undefined)?.pageProps;
    if (pageProps && typeof pageProps === 'object') {
      return { pageProps } as T;
    }
  } catch {
    // ignore
  }

  throw jsonError;
}

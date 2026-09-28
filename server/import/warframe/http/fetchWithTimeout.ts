import dns from 'node:dns';

import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

import {
  assertAllowedFetchUrl,
  assertAllowedImageMime,
  getPinnedAddresses,
} from './allowedFetchHosts.js';

const pinnedAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      const pinned = getPinnedAddresses(hostname);
      if (pinned && pinned.length > 0) {
        if (options.all) {
          callback(null, pinned);
        } else {
          callback(null, [pinned[0]]);
        }
        return;
      }
      dns.lookup(hostname, options, callback);
    },
  },
});

export const FETCH_TIMEOUT_MS = {
  manifest: 120_000,
  exportDownload: 120_000,
  binaryImage: 60_000,
  htmlPage: 60_000,
  warframeMarketItems: 120_000,
  overframeDetailHtml: 8_000,
  wikiFetch: 15_000,
} as const;

export const FETCH_BYTE_LIMITS = {
  image: 10 * 1024 * 1024,
  manifest: 50 * 1024 * 1024,
  html: 5 * 1024 * 1024,
} as const;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const allowed = await assertAllowedFetchUrl(url);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const callerSignal = init?.signal;
  const signal =
    callerSignal !== undefined && callerSignal !== null
      ? AbortSignal.any([timeoutSignal, callerSignal])
      : timeoutSignal;
  const response = await undiciFetch(allowed, {
    ...(init as UndiciRequestInit),
    signal,
    redirect: init?.redirect ?? 'error',
    dispatcher: pinnedAgent,
  });
  return response as unknown as Response;
}

export async function readResponseWithByteLimit(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > maxBytes) {
      try {
        await response.body?.cancel();
      } catch {
        // ignore cancel failures
      }
      throw new Error(`Response Content-Length ${len} exceeds limit of ${maxBytes} bytes`);
    }
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`Response body ${buffer.length} exceeds limit of ${maxBytes} bytes`);
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
        await reader.cancel();
        throw new Error(`Response body exceeds limit of ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function fetchBounded(
  url: string | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
  maxBytes: number,
  options?: { requireImageMime?: boolean },
): Promise<{ response: Response; body: Buffer }> {
  const response = await fetchWithTimeout(url, init, timeoutMs);
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // ignore cancel failures
    }
    return { response, body: Buffer.alloc(0) };
  }
  if (options?.requireImageMime) {
    assertAllowedImageMime(response.headers.get('content-type'));
  }
  const body = await readResponseWithByteLimit(response, maxBytes);
  return { response, body };
}

export async function fetchTextBounded(
  url: string | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
  maxBytes: number = FETCH_BYTE_LIMITS.html,
): Promise<{ response: Response; text: string }> {
  const { response, body } = await fetchBounded(url, init, timeoutMs, maxBytes);
  return { response, text: body.toString('utf-8') };
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true;
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  );
}

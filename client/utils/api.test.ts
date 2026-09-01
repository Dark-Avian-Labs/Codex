import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, setClerkTokenGetter } from './api.js';

function headersFromInit(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

describe('apiFetch clerk token', () => {
  afterEach(() => {
    setClerkTokenGetter(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a Clerk bearer token on API requests', async () => {
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return new Response('ok', { status: 200 });
    });
    setClerkTokenGetter(async () => 'fresh-session-token');

    const response = await apiFetch('/api/warframe/worksheets');

    expect(response.ok).toBe(true);
    expect(headersFromInit(capturedInit).get('Authorization')).toBe('Bearer fresh-session-token');
  });

  it('retries a 401 once after forcing a Clerk token refresh', async () => {
    const capturedInits: RequestInit[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (init) capturedInits.push(init);
      if (capturedInits.length === 1) {
        return new Response('Unauthorized', { status: 401 });
      }
      return new Response('{"worksheets":[]}', { status: 200 });
    });

    const getter = vi.fn(async (options?: { skipCache?: boolean }) =>
      options?.skipCache ? 'refreshed-token' : 'stale-token',
    );
    setClerkTokenGetter(getter);

    const response = await apiFetch('/api/warframe/worksheets');

    expect(response.status).toBe(200);
    expect(capturedInits).toHaveLength(2);
    expect(getter).toHaveBeenNthCalledWith(1, { skipCache: false });
    expect(getter).toHaveBeenNthCalledWith(2, { skipCache: true });
    expect(headersFromInit(capturedInits[1]).get('Authorization')).toBe('Bearer refreshed-token');
  });

  it('does not retry 401 when Clerk has no session token', async () => {
    let fetchCount = 0;
    vi.stubGlobal('fetch', async () => {
      fetchCount += 1;
      return new Response('Unauthorized', { status: 401 });
    });
    setClerkTokenGetter(async () => null);

    const response = await apiFetch('/api/warframe/worksheets');

    expect(response.status).toBe(401);
    expect(fetchCount).toBe(1);
  });
});

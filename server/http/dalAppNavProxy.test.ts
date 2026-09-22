import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleDalAppNavProxy } from './dalAppNavProxy.js';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('handleDalAppNavProxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.DAL_APP_NAV_UPSTREAM_URL;
  });

  it('returns upstream JSON with a short cache', async () => {
    const payload = Buffer.from('{"version":1,"updatedAt":"x","apps":[]}');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(payload, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const res = mockRes();
    await handleDalAppNavProxy({} as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(Buffer.isBuffer(res.body) ? res.body.equals(payload) : false).toBe(true);
  });

  it('returns 502 when upstream is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    const res = mockRes();
    await handleDalAppNavProxy({} as never, res as never);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'dal-app-nav upstream unavailable' });
  });
});

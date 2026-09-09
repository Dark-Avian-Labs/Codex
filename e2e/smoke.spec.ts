import { expect, test } from '@playwright/test';

test('liveness probe is up', async ({ request }) => {
  const res = await request.get('/healthz');
  expect(res.status()).toBe(200);
  await expect(res.json()).resolves.toMatchObject({ status: 'ok', app: 'Codex' });
});

test('readiness probe reaches all sqlite files', async ({ request }) => {
  const res = await request.get('/readyz');
  expect(res.status()).toBe(200);
  await expect(res.json()).resolves.toMatchObject({ status: 'ready', app: 'Codex' });
});

test('version endpoint is uncached', async ({ request }) => {
  const res = await request.get('/api/version');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  const body = (await res.json()) as { version: string };
  expect(body.version.length).toBeGreaterThan(0);
});

test('writes without a CSRF token are rejected', async ({ request }) => {
  const res = await request.post('/api/nope', { data: { name: 'Nope' } });
  expect(res.status()).toBe(403);
  await expect(res.json()).resolves.toMatchObject({ code: 'CSRF_INVALID' });
});

test('unknown API routes return JSON 404', async ({ request }) => {
  const res = await request.get('/api/nope');
  expect(res.status()).toBe(404);
  await expect(res.json()).resolves.toMatchObject({ error: 'Not found' });
});

test('SPA is served after build', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
});

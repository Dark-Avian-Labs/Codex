import type { Request, Response } from 'express';

export const DAL_APP_NAV_UPSTREAM_URL = 'https://darkavianlabs.com/dal-app-nav.json';
const UPSTREAM_TIMEOUT_MS = 5_000;

/**
 * Same-origin proxy for the shared DAL app catalog.
 * Browsers cannot fetch darkavianlabs.com cross-origin without CORS;
 * the app server fetches upstream and returns JSON.
 */
export async function handleDalAppNavProxy(_req: Request, res: Response): Promise<void> {
  const upstreamUrl = process.env.DAL_APP_NAV_UPSTREAM_URL?.trim() || DAL_APP_NAV_UPSTREAM_URL;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) {
      res.status(502).json({ error: 'dal-app-nav upstream failed' });
      return;
    }
    const body = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).send(body);
  } catch {
    res.status(502).json({ error: 'dal-app-nav upstream unavailable' });
  }
}

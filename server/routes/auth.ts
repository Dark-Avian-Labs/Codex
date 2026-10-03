import { getClerkAuthState, getCodexAppId, requireAuthApi } from '@codex/core';
import { Router, type Request, type Response } from 'express';

import { SECURE_COOKIES, SESSION_COOKIE_NAME, sessionCookieDomain } from '../config.js';
import {
  CODEX_GAMES as REGISTRY_CODEX_GAMES,
  getGameMetadata,
  unknownGameMetadata,
} from '../games/metadataRegistry.js';
import { ensureSessionBoundToClerkUser } from '../session/epic7SessionBinding.js';

export const authRouter = Router();

const FALLBACK_CODEX_GAMES = ['warframe', 'epic7', 'wor'] as const;
const CODEX_GAMES = REGISTRY_CODEX_GAMES.length > 0 ? REGISTRY_CODEX_GAMES : FALLBACK_CODEX_GAMES;

export function issueCsrfToken(req: Request, res: Response): void {
  const request = req as Request & { csrfToken?: (overwrite?: boolean) => string };
  const token = request.csrfToken ? request.csrfToken() : (req.session.csrfToken ?? '');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    csrfToken: token,
  });
}

authRouter.get('/csrf', issueCsrfToken);

authRouter.get('/me', requireAuthApi, async (req, res) => {
  const state = getClerkAuthState(req);
  if (!state.authenticated || !state.userId) {
    res.status(401).json({
      authenticated: false,
      userId: null,
      isAdmin: false,
      isCodexAdmin: false,
      apps: [],
    });
    return;
  }
  const apps = CODEX_GAMES.map((id) => {
    const metadata = getGameMetadata(id) ?? {
      ...unknownGameMetadata,
      url: `/${id}`,
    };
    return { id, ...metadata };
  });
  await ensureSessionBoundToClerkUser(req, state.userId);
  res.json({
    authenticated: true,
    userId: state.userId,
    isAdmin: state.isCodexAdmin,
    isCodexAdmin: state.isCodexAdmin,
    app: getCodexAppId(),
    apps,
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy((destroyErr) => {
    if (destroyErr) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    const domain = sessionCookieDomain();
    res.clearCookie(SESSION_COOKIE_NAME, {
      ...(domain ? { domain } : {}),
      path: '/',
      httpOnly: true,
      secure: SECURE_COOKIES,
      sameSite: 'lax',
    });
    res.json({ ok: true, next: '/' });
  });
});

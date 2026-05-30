import { getClerkAuthState, getCodexAppId, requireAuthApi } from '@codex/core';
import { Router } from 'express';

import { SESSION_COOKIE_NAME } from '../config.js';
import {
  CODEX_GAMES as REGISTRY_CODEX_GAMES,
  getGameMetadata,
  unknownGameMetadata,
} from '../games/metadataRegistry.js';
import { ensureSessionBoundToClerkUser } from '../session/epic7SessionBinding.js';

export const authRouter = Router();

const FALLBACK_CODEX_GAMES = ['warframe', 'epic7'] as const;
const CODEX_GAMES = REGISTRY_CODEX_GAMES.length > 0 ? REGISTRY_CODEX_GAMES : FALLBACK_CODEX_GAMES;

authRouter.get('/csrf', (_req, res) => {
  res.json({
    csrfToken: (res.locals as { csrfToken?: string }).csrfToken || '',
  });
});

authRouter.get('/me', requireAuthApi, (req, res) => {
  const state = getClerkAuthState(req);
  if (!state.authenticated || !state.userId) {
    res.status(401).json({
      authenticated: false,
      userId: null,
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
  ensureSessionBoundToClerkUser(req, state.userId);
  res.json({
    authenticated: true,
    userId: state.userId,
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
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ ok: true, next: '/' });
  });
});

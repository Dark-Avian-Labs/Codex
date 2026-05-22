import { CODEX_APP_ID, getClerkAuthState, requireAuthApi } from '@codex/core';
import { Router } from 'express';

import {
  CODEX_GAMES as REGISTRY_CODEX_GAMES,
  getGameMetadata,
  unknownGameMetadata,
} from '../games/metadataRegistry.js';

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
  res.json({
    authenticated: true,
    userId: state.userId,
    isCodexAdmin: state.isCodexAdmin,
    app: CODEX_APP_ID,
    apps,
  });
});

authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true, next: '/' });
});

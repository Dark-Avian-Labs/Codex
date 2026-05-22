import { clerkMiddleware, getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

import { isAppAdmin, metadataFromSessionClaims } from '../auth/clerk.js';
import { CODEX_APP_ID } from '../config.js';

export { clerkMiddleware, getAuth };

function wantsJson(req: Request): boolean {
  return req.accepts(['html', 'json']) === 'json';
}

function sendAuthError(req: Request, res: Response, status: number, message: string): void {
  if (wantsJson(req)) {
    res.status(status).json({ error: message });
  } else {
    res.status(status).send(message);
  }
}

export type ClerkAuthState = {
  authenticated: boolean;
  userId: string | null;
  isCodexAdmin: boolean;
};

export function getClerkAuthState(req: Request): ClerkAuthState {
  const auth = getAuth(req);
  const userId = auth.userId ?? null;
  const metadata = metadataFromSessionClaims(auth.sessionClaims);
  return {
    authenticated: Boolean(userId),
    userId,
    isCodexAdmin: isAppAdmin(metadata, CODEX_APP_ID),
  };
}

export function requireAuthApi(req: Request, res: Response, next: NextFunction): void {
  const state = getClerkAuthState(req);
  if (state.authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function requireCodexAdmin(req: Request, res: Response, next: NextFunction): void {
  const state = getClerkAuthState(req);
  if (!state.authenticated) {
    sendAuthError(req, res, 401, 'Unauthorized');
    return;
  }
  if (!state.isCodexAdmin) {
    sendAuthError(req, res, 403, 'Codex admin access required');
    return;
  }
  next();
}

export const requireAdmin = requireCodexAdmin;

export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export function requireGameAccess(_gameId: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}

export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction): void {
  const state = getClerkAuthState(req);
  if (state.authenticated) {
    res.redirect('/');
    return;
  }
  next();
}

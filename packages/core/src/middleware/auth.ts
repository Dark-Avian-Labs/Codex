import { clerkMiddleware as clerkExpressMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { isAppAdmin, metadataFromSessionClaims } from '../auth/clerk.js';
import { getCodexAppId } from '../config.js';
import { getClerkAuthorizedParties } from './clerkAuthorizedParties.js';

export { getAuth };

function isPlaceholderClerkKey(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('placeholder') || lower.includes('changeme') || lower.includes('your_key');
}

function hasClerkKeyPrefix(value: string, kind: 'pk' | 'sk'): boolean {
  const prefixes = [`${kind}_test_`, `${kind}_live_`] as const;
  return prefixes.some((prefix) => value.startsWith(prefix) && value.length > prefix.length);
}

export function isClerkConfigured(): boolean {
  const publishable = process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  const secret = process.env.CLERK_SECRET_KEY?.trim() ?? '';
  if (!publishable && !secret) return false;
  if (
    isPlaceholderClerkKey(publishable) ||
    isPlaceholderClerkKey(secret) ||
    !hasClerkKeyPrefix(publishable, 'pk') ||
    !hasClerkKeyPrefix(secret, 'sk')
  ) {
    throw new Error(
      '[FATAL] Clerk keys look invalid or like placeholders. Use real pk_test_/pk_live_ and sk_test_/sk_live_ values, or leave both empty for unauthenticated local dev.',
    );
  }
  return true;
}

export function clerkMiddleware(): RequestHandler {
  if (!isClerkConfigured()) {
    return (_req, _res, next) => next();
  }
  return clerkExpressMiddleware({ authorizedParties: getClerkAuthorizedParties() });
}

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
  if (!isClerkConfigured()) {
    return { authenticated: false, userId: null, isCodexAdmin: false };
  }
  const auth = getAuth(req);
  const userId = auth.userId ?? null;
  const metadata = metadataFromSessionClaims(auth.sessionClaims);
  return {
    authenticated: Boolean(userId),
    userId,
    isCodexAdmin: isAppAdmin(metadata, getCodexAppId()),
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

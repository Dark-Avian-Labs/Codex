import {
  requireAuth as coreRequireAuth,
  requireAuthApi as coreRequireAuthApi,
  requireAdmin as coreRequireAdmin,
} from '@codex/core';
import type { NextFunction, Request, Response } from 'express';

import { buildAuthLoginUrl } from './remoteAuth.js';

export const requireAuth = coreRequireAuth;
export const requireAuthApi = coreRequireAuthApi;
export const requireAdmin = coreRequireAdmin;

export function ensureAuthenticatedPage(req: Request, res: Response, next: NextFunction): void {
  const userId = (req.session as { user_id?: unknown } | undefined)?.user_id;
  const hasValidUserId = Number.isInteger(userId) && (userId as number) > 0;
  if (req.session && hasValidUserId) {
    next();
    return;
  }
  res.redirect(buildAuthLoginUrl(req));
}

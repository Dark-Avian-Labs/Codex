import type { Request, Response, NextFunction } from 'express';

import {
  type AuthSession,
  isAuthenticated,
  isAdmin,
  hasAccess,
} from '../auth.js';
import { BASE_HOST, GAME_HOSTS } from '../config.js';

function getSession(req: Request): AuthSession {
  return req.session as AuthSession;
}

function wantsJson(req: Request): boolean {
  return req.accepts('json') !== false;
}

function getLoginRedirectUrl(req: Request, gameId?: string): string {
  const host = req.hostname;
  if (GAME_HOSTS[host] && BASE_HOST && BASE_HOST !== 'localhost') {
    const proto = req.protocol === 'https' ? 'https' : 'http';
    const next = gameId ? `?next=/games/${gameId}` : '';
    return `${proto}://${BASE_HOST}/login${next}`;
  }
  return gameId ? `/login?next=/games/${gameId}` : '/login';
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAuthenticated(getSession(req))) {
    next();
    return;
  }
  res.redirect(getLoginRedirectUrl(req));
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const session = getSession(req);
  if (!isAuthenticated(session)) {
    res.redirect(getLoginRedirectUrl(req));
    return;
  }
  if (!isAdmin(session)) {
    if (wantsJson(req)) {
      res.status(403).json({ error: 'Admin access required' });
    } else {
      res.status(403).send('Admin access required');
    }
    return;
  }
  next();
}

export function requireGameAccess(gameId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = getSession(req);
    if (!isAuthenticated(session)) {
      res.redirect(getLoginRedirectUrl(req, gameId));
      return;
    }
    const userId = session?.user_id;
    if (typeof userId !== 'number') {
      res.redirect(getLoginRedirectUrl(req, gameId));
      return;
    }
    if (!hasAccess(userId, gameId)) {
      if (wantsJson(req)) {
        res.status(403).json({ error: 'Access to this game is not granted.' });
      } else {
        res.status(403).send('Access to this game is not granted.');
      }
      return;
    }
    next();
  };
}

export function requireAuthApi(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAuthenticated(getSession(req))) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function redirectIfAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAuthenticated(getSession(req))) {
    res.redirect('/');
    return;
  }
  next();
}

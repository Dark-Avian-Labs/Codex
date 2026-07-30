import { randomUUID } from 'node:crypto';

import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function sanitizeRequestId(incoming: unknown): string {
  if (typeof incoming === 'string') {
    const trimmed = incoming.trim();
    if (REQUEST_ID_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }
  return randomUUID();
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = sanitizeRequestId(req.headers['x-request-id']);
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function getRequestId(res: Response): string | undefined {
  const id = res.locals.requestId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

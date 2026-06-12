import { getAuth } from '@clerk/express';
import type { Request } from 'express';
export class UnauthorizedRequestError extends Error {
  readonly status = 401;

  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedRequestError';
  }
}

export function getClerkUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

export function requireClerkUserId(req: Request): string {
  const userId = getClerkUserId(req);
  if (!userId) {
    throw new UnauthorizedRequestError();
  }
  return userId;
}

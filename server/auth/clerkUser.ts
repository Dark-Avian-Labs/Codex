import { getAuth } from '@clerk/express';
import type { Request } from 'express';

export function getClerkUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

export function requireClerkUserId(req: Request): string {
  const userId = getClerkUserId(req);
  if (!userId) {
    throw new Error('Authenticated Clerk user id missing from request.');
  }
  return userId;
}

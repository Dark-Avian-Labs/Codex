import type { Request } from 'express';

import { bindClerkUserToExpressSession } from './bindClerkUserSession.js';

export type Epic7SessionFields = {
  clerk_user_id?: string | null;
  account_id?: number | null;
  account_name?: string | null;
};

export function getEpic7Session(req: Request): Epic7SessionFields {
  return req.session as Epic7SessionFields;
}

export function clearEpic7SessionFields(req: Request): void {
  const sessionData = getEpic7Session(req);
  sessionData.account_id = null;
  sessionData.account_name = null;
}

export async function ensureSessionBoundToClerkUser(
  req: Request,
  clerkUserId: string,
): Promise<void> {
  await bindClerkUserToExpressSession(req, clerkUserId);
}

export function patchEpic7Session(req: Request, values: Partial<Epic7SessionFields>): void {
  Object.assign(getEpic7Session(req), values);
}

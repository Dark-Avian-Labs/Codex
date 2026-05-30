import type { Request } from 'express';

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

export function ensureSessionBoundToClerkUser(req: Request, clerkUserId: string): void {
  const sessionData = getEpic7Session(req);
  const boundUserId = sessionData.clerk_user_id;
  if (boundUserId && boundUserId !== clerkUserId) {
    clearEpic7SessionFields(req);
  }
  sessionData.clerk_user_id = clerkUserId;
}

export function patchEpic7Session(req: Request, values: Partial<Epic7SessionFields>): void {
  Object.assign(getEpic7Session(req), values);
}

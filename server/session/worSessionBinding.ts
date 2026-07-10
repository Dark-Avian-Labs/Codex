import type { Request } from 'express';

export type WorSessionFields = {
  clerk_user_id?: string | null;
  wor_account_id?: number | null;
  wor_account_name?: string | null;
};

export function getWorSession(req: Request): WorSessionFields {
  return req.session as WorSessionFields;
}

export function clearWorSessionFields(req: Request): void {
  const sessionData = getWorSession(req);
  sessionData.wor_account_id = null;
  sessionData.wor_account_name = null;
}

export function ensureWorSessionBoundToClerkUser(req: Request, clerkUserId: string): void {
  const sessionData = getWorSession(req);
  const boundUserId = sessionData.clerk_user_id;
  if (boundUserId && boundUserId !== clerkUserId) {
    clearWorSessionFields(req);
  }
  sessionData.clerk_user_id = clerkUserId;
}

export function patchWorSession(req: Request, values: Partial<WorSessionFields>): void {
  Object.assign(getWorSession(req), values);
}

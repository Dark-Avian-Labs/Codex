import type { Request } from 'express';

import { bindClerkUserToExpressSession } from './bindClerkUserSession.js';

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

export async function ensureWorSessionBoundToClerkUser(
  req: Request,
  clerkUserId: string,
): Promise<void> {
  await bindClerkUserToExpressSession(req, clerkUserId);
}

export function patchWorSession(req: Request, values: Partial<WorSessionFields>): void {
  Object.assign(getWorSession(req), values);
}

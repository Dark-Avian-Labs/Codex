import type { NextFunction, Request, Response } from 'express';

type SessionWithClerk = {
  clerk_user_id?: string | null;
  csrfToken?: string;
  regenerate: (callback: (error?: Error) => void) => void;
};

function sessionOf(req: Request): SessionWithClerk | undefined {
  return req.session as SessionWithClerk | undefined;
}

export async function bindClerkUserToExpressSession(
  req: Request,
  clerkUserId: string | null,
  rotateCsrf?: () => void,
): Promise<{ rotated: boolean }> {
  const session = sessionOf(req);
  if (!session) {
    return { rotated: false };
  }

  const current = clerkUserId;
  const bound = session.clerk_user_id;

  if (bound === current) {
    return { rotated: false };
  }

  if (bound === undefined && current === null) {
    session.clerk_user_id = null;
    return { rotated: false };
  }

  const hasPriorIdentity = bound !== undefined;
  const hasCsrf = Boolean(session.csrfToken);
  if (!hasPriorIdentity && !hasCsrf) {
    session.clerk_user_id = current;
    return { rotated: false };
  }

  await new Promise<void>((resolve, reject) => {
    session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  const rotate =
    rotateCsrf ??
    (() => {
      const generate = (req as Request & { csrfToken?: (overwrite?: boolean) => string }).csrfToken;
      generate?.(true);
    });
  rotate();
  const nextSession = sessionOf(req);
  if (nextSession) {
    nextSession.clerk_user_id = current;
  }
  return { rotated: true };
}

export function bindClerkUserSessionMiddleware(
  getUserId: (req: Request) => string | null,
  rotateCsrf: (req: Request) => void,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (req.path === '/health' || req.path === '/version') {
      next();
      return;
    }
    let userId: string | null = null;
    try {
      userId = getUserId(req);
    } catch {
      userId = null;
    }
    void bindClerkUserToExpressSession(req, userId, () => rotateCsrf(req)).then(() => next(), next);
  };
}

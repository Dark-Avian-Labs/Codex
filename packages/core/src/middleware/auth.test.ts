import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: null as string | null,
  sessionClaims: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@clerk/express', () => ({
  getAuth: () => ({
    userId: authState.userId,
    sessionClaims: authState.sessionClaims,
  }),
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import { isAppAdmin } from '../auth/clerk.js';
import { mockResponse } from '../testing/mockResponse.js';
import { getClerkAuthState, isClerkConfigured, requireAuthApi, requireCodexAdmin } from './auth.js';

function restoreClerkKeys(previousPublishable: string | undefined, previousSecret: string | undefined): void {
  if (previousPublishable === undefined) delete process.env.CLERK_PUBLISHABLE_KEY;
  else process.env.CLERK_PUBLISHABLE_KEY = previousPublishable;
  if (previousSecret === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = previousSecret;
}

function enableClerkForAuthTests(): void {
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
  process.env.CLERK_SECRET_KEY = 'sk_test_abc';
}

describe('isClerkConfigured', () => {
  const previousPublishable = process.env.CLERK_PUBLISHABLE_KEY;
  const previousSecret = process.env.CLERK_SECRET_KEY;

  afterEach(() => {
    restoreClerkKeys(previousPublishable, previousSecret);
  });

  it('returns false when both keys are empty', () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    expect(isClerkConfigured()).toBe(false);
  });

  it('rejects bare pk_test_ and sk_test_ prefixes', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_';
    process.env.CLERK_SECRET_KEY = 'sk_test_abc';
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });

  it('rejects a secret that is only sk_live_', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_live_abc';
    process.env.CLERK_SECRET_KEY = 'sk_live_';
    expect(() => isClerkConfigured()).toThrow(/FATAL/);
  });
});

describe('isAppAdmin', () => {
  it('returns true when app role is admin', () => {
    expect(isAppAdmin({ apps: { codex: 'admin' } }, 'codex')).toBe(true);
  });

  it('returns false for missing app key', () => {
    expect(isAppAdmin({ apps: {} }, 'codex')).toBe(false);
    expect(isAppAdmin(undefined, 'codex')).toBe(false);
  });

  it('returns false for non-admin values', () => {
    expect(isAppAdmin({ apps: { codex: 'user' } }, 'codex')).toBe(false);
  });

  it('does not treat other apps as codex admin', () => {
    expect(isAppAdmin({ apps: { armory: 'admin' } }, 'codex')).toBe(false);
  });
});

describe('getClerkAuthState', () => {
  const previousPublishable = process.env.CLERK_PUBLISHABLE_KEY;
  const previousSecret = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
    enableClerkForAuthTests();
  });

  afterEach(() => {
    restoreClerkKeys(previousPublishable, previousSecret);
  });

  it('returns unauthenticated state when there is no user', () => {
    const state = getClerkAuthState({} as Request);
    expect(state.authenticated).toBe(false);
    expect(state.isCodexAdmin).toBe(false);
  });

  it('returns signed-out when Clerk is not configured even if getAuth would return a user', () => {
    authState.userId = 'user_1';
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    const state = getClerkAuthState({} as Request);
    expect(state).toEqual({ authenticated: false, userId: null, isCodexAdmin: false });
  });

  it('returns authenticated non-admin for signed-in user without admin role', () => {
    authState.userId = 'user_2';
    authState.sessionClaims = { metadata: { apps: { codex: 'user' } } };
    const state = getClerkAuthState({} as Request);
    expect(state.authenticated).toBe(true);
    expect(state.isCodexAdmin).toBe(false);
  });

  it('returns codex admin when metadata includes admin role', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { codex: 'admin' } } };
    const state = getClerkAuthState({} as Request);
    expect(state.isCodexAdmin).toBe(true);
  });
});

describe('requireAuthApi', () => {
  const previousPublishable = process.env.CLERK_PUBLISHABLE_KEY;
  const previousSecret = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    authState.userId = null;
    enableClerkForAuthTests();
  });

  afterEach(() => {
    restoreClerkKeys(previousPublishable, previousSecret);
  });

  it('returns 401 JSON when unauthenticated', () => {
    const res = mockResponse();
    const next = vi.fn();
    requireAuthApi({} as Request, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when authenticated', () => {
    authState.userId = 'user_1';
    const res = mockResponse();
    const next = vi.fn();
    requireAuthApi({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireCodexAdmin', () => {
  const previousPublishable = process.env.CLERK_PUBLISHABLE_KEY;
  const previousSecret = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
    enableClerkForAuthTests();
  });

  afterEach(() => {
    restoreClerkKeys(previousPublishable, previousSecret);
  });

  it('returns 401 JSON when unauthenticated', () => {
    const req = { accepts: vi.fn(() => 'json') } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();
    requireCodexAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 JSON for non-admin when client prefers json', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { codex: 'user' } } };
    const req = { accepts: vi.fn(() => 'json') } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();
    requireCodexAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Codex admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 HTML for non-admin when client prefers html', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { codex: 'user' } } };
    const req = { accepts: vi.fn(() => 'html') } as unknown as Request;
    const res = mockResponse('html');
    const next = vi.fn();
    requireCodexAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toBe('Codex admin access required');
  });

  it('calls next for codex admin', () => {
    authState.userId = 'user_1';
    authState.sessionClaims = { metadata: { apps: { codex: 'admin' } } };
    const req = { accepts: vi.fn(() => 'json') } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();
    requireCodexAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

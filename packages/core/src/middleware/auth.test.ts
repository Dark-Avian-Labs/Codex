import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { getClerkAuthState, requireAuthApi, requireCodexAdmin } from './auth.js';

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
  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
  });

  it('returns unauthenticated state when there is no user', () => {
    const state = getClerkAuthState({} as Request);
    expect(state.authenticated).toBe(false);
    expect(state.isCodexAdmin).toBe(false);
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
  beforeEach(() => {
    authState.userId = null;
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
  beforeEach(() => {
    authState.userId = null;
    authState.sessionClaims = undefined;
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

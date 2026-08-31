import { describe, expect, it } from 'vitest';

import {
  clearEpic7SessionFields,
  ensureSessionBoundToClerkUser,
  getEpic7Session,
  patchEpic7Session,
} from '../server/session/epic7SessionBinding.js';

function mockRequest(session: Record<string, unknown> = {}) {
  const req = {
    session: {
      ...session,
      regenerate(callback: (error?: Error) => void) {
        req.session = {
          regenerate: req.session.regenerate,
        };
        callback();
      },
    },
  };
  return req as Parameters<typeof getEpic7Session>[0];
}

describe('epic7SessionBinding', () => {
  it('binds clerk_user_id on first access', async () => {
    const req = mockRequest({});
    await ensureSessionBoundToClerkUser(req, 'user_a');
    expect(getEpic7Session(req).clerk_user_id).toBe('user_a');
  });

  it('regenerates when an anonymous CSRF session binds a Clerk user', async () => {
    const req = mockRequest({ csrfToken: 'anon-token' }) as Parameters<typeof ensureSessionBoundToClerkUser>[0] & {
      csrfToken?: (overwrite?: boolean) => string;
    };
    req.csrfToken = (overwrite) => {
      if (overwrite) {
        (req.session as { csrfToken?: string }).csrfToken = 'fresh-token';
      }
      return 'fresh-token';
    };
    await ensureSessionBoundToClerkUser(req, 'user_a');
    expect(getEpic7Session(req).clerk_user_id).toBe('user_a');
    expect((req.session as { csrfToken?: string }).csrfToken).toBe('fresh-token');
  });

  it('regenerates the session when Clerk user changes', async () => {
    const req = mockRequest({
      clerk_user_id: 'user_a',
      account_id: 42,
      account_name: 'Main',
    });
    await ensureSessionBoundToClerkUser(req, 'user_b');
    expect(getEpic7Session(req).clerk_user_id).toBe('user_b');
    expect(getEpic7Session(req).account_id).toBeUndefined();
    expect(getEpic7Session(req).account_name).toBeUndefined();
  });

  it('preserves account fields for the same Clerk user', async () => {
    const req = mockRequest({
      clerk_user_id: 'user_a',
      account_id: 7,
      account_name: 'Alt',
    });
    await ensureSessionBoundToClerkUser(req, 'user_a');
    expect(getEpic7Session(req).account_id).toBe(7);
    expect(getEpic7Session(req).account_name).toBe('Alt');
  });

  it('clearEpic7SessionFields removes account context only', () => {
    const req = mockRequest({
      clerk_user_id: 'user_a',
      account_id: 3,
      account_name: 'Main',
      csrfToken: 'token',
    });
    clearEpic7SessionFields(req);
    expect(getEpic7Session(req).account_id).toBeNull();
    expect(getEpic7Session(req).account_name).toBeNull();
    expect(getEpic7Session(req).clerk_user_id).toBe('user_a');
    expect(getEpic7Session(req).csrfToken).toBe('token');
  });

  it('patchEpic7Session merges partial updates', () => {
    const req = mockRequest({ clerk_user_id: 'user_a' });
    patchEpic7Session(req, { account_id: 99, account_name: 'New' });
    expect(getEpic7Session(req).account_id).toBe(99);
    expect(getEpic7Session(req).account_name).toBe('New');
  });
});

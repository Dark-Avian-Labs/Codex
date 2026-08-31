import { describe, expect, it } from 'vitest';

import { bindClerkUserToExpressSession } from './bindClerkUserSession.js';

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
  return req as Parameters<typeof bindClerkUserToExpressSession>[0];
}

describe('bindClerkUserToExpressSession', () => {
  it('records the first anonymous bind without rotating', async () => {
    const req = mockRequest({});
    const rotated = await bindClerkUserToExpressSession(req, null);
    expect(rotated).toEqual({ rotated: false });
    expect((req.session as { clerk_user_id?: string | null }).clerk_user_id).toBeNull();
  });

  it('does not rotate an anonymous CSRF session still signed out', async () => {
    const req = mockRequest({ csrfToken: 'anon-token' });
    const result = await bindClerkUserToExpressSession(req, null);
    expect(result.rotated).toBe(false);
    expect((req.session as { clerk_user_id?: string | null }).clerk_user_id).toBeNull();
    expect((req.session as { csrfToken?: string }).csrfToken).toBe('anon-token');
  });

  it('rotates when an anonymous CSRF session becomes a signed-in user', async () => {
    const req = mockRequest({ csrfToken: 'anon-token' });
    let csrfRotated = false;
    const result = await bindClerkUserToExpressSession(req, 'user_a', () => {
      csrfRotated = true;
      (req.session as { csrfToken?: string }).csrfToken = 'fresh-token';
    });
    expect(result.rotated).toBe(true);
    expect(csrfRotated).toBe(true);
    expect((req.session as { clerk_user_id?: string | null }).clerk_user_id).toBe('user_a');
    expect((req.session as { csrfToken?: string }).csrfToken).toBe('fresh-token');
  });

  it('rotates when the Clerk user changes', async () => {
    const req = mockRequest({ clerk_user_id: 'user_a', csrfToken: 'old' });
    const result = await bindClerkUserToExpressSession(req, 'user_b', () => {
      (req.session as { csrfToken?: string }).csrfToken = 'new';
    });
    expect(result.rotated).toBe(true);
    expect((req.session as { clerk_user_id?: string | null }).clerk_user_id).toBe('user_b');
  });

  it('is a no-op when the bound user is unchanged', async () => {
    const req = mockRequest({ clerk_user_id: 'user_a', csrfToken: 'keep' });
    const result = await bindClerkUserToExpressSession(req, 'user_a');
    expect(result.rotated).toBe(false);
    expect((req.session as { csrfToken?: string }).csrfToken).toBe('keep');
  });

  it('rotates when a signed-in session becomes anonymous', async () => {
    const req = mockRequest({ clerk_user_id: 'user_a', csrfToken: 'old' });
    let csrfRotated = false;
    const result = await bindClerkUserToExpressSession(req, null, () => {
      csrfRotated = true;
      (req.session as { csrfToken?: string }).csrfToken = 'anon-fresh';
    });
    expect(result.rotated).toBe(true);
    expect(csrfRotated).toBe(true);
    expect((req.session as { clerk_user_id?: string | null }).clerk_user_id).toBeNull();
  });
});

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'user_a' as string | null,
  isCodexAdmin: false,
}));

vi.mock('@codex/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codex/core')>();
  return {
    ...actual,
    getClerkAuthState: () => ({
      authenticated: Boolean(authState.userId),
      userId: authState.userId,
      isCodexAdmin: authState.isCodexAdmin,
    }),
    requireAuthApi: (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!authState.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    },
    getCodexAppId: () => 'codex',
  };
});

import { authRouter } from '../server/routes/auth.js';
import { getEpic7Session, patchEpic7Session } from '../server/session/epic7SessionBinding.js';

function createAuthApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.get('/api/auth/__test/epic7-session', (req, res) => {
    const epic7 = getEpic7Session(req);
    res.json({
      clerk_user_id: epic7.clerk_user_id ?? null,
      account_id: epic7.account_id ?? null,
      account_name: epic7.account_name ?? null,
    });
  });
  app.post('/api/auth/__test/epic7-session', (req, res) => {
    patchEpic7Session(req, req.body);
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  return app;
}

describe('auth session routes', () => {
  it('destroys session on logout', async () => {
    authState.userId = 'user_a';
    const app = createAuthApp();
    const agent = request.agent(app);

    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/__test/epic7-session').send({ account_id: 42, account_name: 'Primary' }).expect(200);
    await agent
      .get('/api/auth/__test/epic7-session')
      .expect(200)
      .expect({ clerk_user_id: 'user_a', account_id: 42, account_name: 'Primary' });

    const logoutRes = await agent.post('/api/auth/logout').expect(200).expect({ ok: true, next: '/' });
    expect(logoutRes.headers['set-cookie']).toBeDefined();

    await agent
      .get('/api/auth/__test/epic7-session')
      .expect(200)
      .expect({ clerk_user_id: null, account_id: null, account_name: null });

    await agent.get('/api/auth/me').expect(200);
  });

  it('clears Epic7 session fields when Clerk user changes', async () => {
    authState.userId = 'user_a';
    const app = createAuthApp();
    const agent = request.agent(app);

    await agent.get('/api/auth/me').expect(200);
    await agent
      .post('/api/auth/__test/epic7-session')
      .send({ account_id: 99, account_name: 'Bound account' })
      .expect(200);
    await agent
      .get('/api/auth/__test/epic7-session')
      .expect(200)
      .expect({ clerk_user_id: 'user_a', account_id: 99, account_name: 'Bound account' });

    authState.userId = 'user_b';
    await agent.get('/api/auth/me').expect(200);
    await agent
      .get('/api/auth/__test/epic7-session')
      .expect(200)
      .expect({ clerk_user_id: 'user_b', account_id: null, account_name: null });
  });
});

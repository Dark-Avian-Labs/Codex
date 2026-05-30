import fs from 'node:fs';

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_NAME } from '../server/config.js';
import { healthzHandler, readyzHandler } from '../server/probes.js';
import { authRouter } from '../server/routes/auth.js';

const dbMocks = vi.hoisted(() => ({
  sessionOk: true,
  warframeOk: true,
  epic7Ok: true,
  armoryOk: true,
  armoryDbPath: '',
}));

vi.mock('../server/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/config.js')>();
  return {
    ...actual,
    get ARMORY_DB_PATH() {
      return dbMocks.armoryDbPath;
    },
  };
});

vi.mock('@codex/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codex/core')>();
  return {
    ...actual,
    getSessionDb: () => ({
      prepare: () => ({
        get: () => {
          if (!dbMocks.sessionOk) throw new Error('session db unavailable');
          return { ok: 1 };
        },
      }),
    }),
  };
});

vi.mock('@codex/game-warframe', () => ({
  getWarframeDb: () => ({
    prepare: () => ({
      get: () => {
        if (!dbMocks.warframeOk) throw new Error('warframe db unavailable');
        return { ok: 1 };
      },
    }),
  }),
}));

vi.mock('@codex/game-epic7', () => ({
  getEpic7Db: () => ({
    prepare: () => ({
      get: () => {
        if (!dbMocks.epic7Ok) throw new Error('epic7 db unavailable');
        return { ok: 1 };
      },
    }),
  }),
}));

const armoryAccessMock = vi.hoisted(() => vi.fn(async () => {}));

function createProbeApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true,
    }),
  );
  app.use((req, res, next) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = 'test-csrf-token';
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
  });
  app.get('/healthz', healthzHandler);
  app.get('/readyz', readyzHandler);
  app.use('/api/auth', authRouter);
  return app;
}

describe('auth and probe routes', () => {
  beforeEach(() => {
    dbMocks.sessionOk = true;
    dbMocks.warframeOk = true;
    dbMocks.epic7Ok = true;
    dbMocks.armoryOk = true;
    dbMocks.armoryDbPath = '';
    armoryAccessMock.mockReset();
    armoryAccessMock.mockImplementation(async () => {
      if (!dbMocks.armoryOk) throw new Error('armory db unavailable');
    });
    vi.spyOn(fs.promises, 'access').mockImplementation(armoryAccessMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /healthz returns ok', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/healthz')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok', app: APP_NAME });
      });
  });

  it('GET /readyz returns ready when databases respond', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ready');
        expect(res.body.app).toBe(APP_NAME);
      });
  });

  it('GET /readyz returns 503 when a database probe fails', async () => {
    dbMocks.warframeOk = false;
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(503)
      .expect((res) => {
        expect(res.body.status).toBe('not_ready');
      });
  });

  it('GET /readyz returns 503 when Armory DB is configured but unreadable', async () => {
    dbMocks.armoryDbPath = '/tmp/armory.db';
    dbMocks.armoryOk = false;
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(503)
      .expect((res) => {
        expect(res.body.status).toBe('not_ready');
      });
    expect(armoryAccessMock).toHaveBeenCalled();
  });

  it('GET /api/auth/csrf returns session token', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/api/auth/csrf')
      .expect(200)
      .expect((res) => {
        expect(res.body.csrfToken).toBe('test-csrf-token');
      });
  });
});

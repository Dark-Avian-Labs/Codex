import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_NAME } from '../server/config.js';
import { healthzHandler, readyzHandler } from '../server/probes.js';
import { authRouter, issueCsrfToken } from '../server/routes/auth.js';
import { testRateLimiter, testSessionOptions } from './helpers/testExpress.js';

const dbMocks = vi.hoisted(() => ({
  sessionOk: true,
  warframeOk: true,
  epic7Ok: true,
  worOk: true,
  catalogDbPath: '',
  worCatalogDbPath: '',
}));

vi.mock('../server/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/config.js')>();
  return {
    ...actual,
    get WARFRAME_CATALOG_DB_PATH() {
      return dbMocks.catalogDbPath;
    },
    get WOR_CATALOG_DB_PATH() {
      return dbMocks.worCatalogDbPath;
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

vi.mock('@codex/game-wor', () => ({
  getWorDb: () => ({
    prepare: () => ({
      get: () => {
        if (!dbMocks.worOk) throw new Error('wor db unavailable');
        return { ok: 1 };
      },
    }),
  }),
}));

vi.mock('../server/epic7DbState.js', () => ({
  refreshEpic7DbAvailability: async () => {},
  isEpic7DbAvailable: () => dbMocks.epic7Ok,
  ensureEpic7DbAvailable: () => dbMocks.epic7Ok,
}));

vi.mock('../server/worDbState.js', () => ({
  refreshWorDbAvailability: async () => {},
  isWorDbAvailable: () => dbMocks.worOk,
  ensureWorDbAvailable: () => dbMocks.worOk,
}));

function createProbeApp() {
  const app = express();
  app.use(testRateLimiter);
  app.use(express.json());
  app.use(
    session(
      testSessionOptions({
        saveUninitialized: true,
      }),
    ),
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
  app.get('/api/csrf', issueCsrfToken);
  return app;
}

function writeEmptySqlite(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.close();
}

describe('auth and probe routes', () => {
  const tmpRoot = path.join(os.tmpdir(), `codex-auth-routes-${process.pid}`);

  beforeEach(() => {
    dbMocks.sessionOk = true;
    dbMocks.warframeOk = true;
    dbMocks.epic7Ok = true;
    dbMocks.worOk = true;
    dbMocks.catalogDbPath = '';
    dbMocks.worCatalogDbPath = '';
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.mkdirSync(tmpRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
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

  it('GET /readyz returns 503 when Warframe catalog DB is configured but unreadable', async () => {
    dbMocks.catalogDbPath = path.join(tmpRoot, 'missing-warframe-catalog.db');
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(503)
      .expect((res) => {
        expect(res.body.status).toBe('not_ready');
      });
  });

  it('GET /readyz returns 503 when Warframe catalog DB lacks required tables', async () => {
    const catalogPath = path.join(tmpRoot, 'empty-warframe-catalog.db');
    writeEmptySqlite(catalogPath);
    dbMocks.catalogDbPath = catalogPath;
    const app = createProbeApp();
    await request(app)
      .get('/readyz')
      .expect(503)
      .expect((res) => {
        expect(res.body.status).toBe('not_ready');
      });
  });

  it('GET /api/csrf returns session token', async () => {
    const app = createProbeApp();
    await request(app)
      .get('/api/csrf')
      .expect(200)
      .expect((res) => {
        expect(res.body.csrfToken).toBe('test-csrf-token');
      });
  });
});

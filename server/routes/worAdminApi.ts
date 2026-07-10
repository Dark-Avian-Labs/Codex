import { requireCodexAdmin } from '@codex/core';
import { validateBody } from '@codex/core/validation';
import { getWorDb, worAdminImportRunSchema } from '@codex/game-wor';
import { Router, type Response } from 'express';

import {
  getWorAdminImportSnapshot,
  isWorImportRunning,
  startWorAdminImport,
  subscribeWorAdminImport,
} from '../import/wor/adminImportJob.js';
import { catalogNeedsImport, runWorStartupPipeline } from '../import/wor/startupPipeline.js';
import { isWorDbAvailable } from '../worDbState.js';

export const worAdminApiRouter = Router();

function json(res: Response, data: object, status = 200): void {
  res.status(status).json(data);
}

function err(res: Response, message: string, status = 400): void {
  res.status(status).json({ error: message });
}

worAdminApiRouter.get('/import/status', requireCodexAdmin, (_req, res) => {
  if (!isWorDbAvailable()) {
    err(res, 'WoR database unavailable', 503);
    return;
  }
  json(res, getWorAdminImportSnapshot());
});

worAdminApiRouter.get('/import/stream', requireCodexAdmin, (req, res) => {
  if (!isWorDbAvailable()) {
    err(res, 'WoR database unavailable', 503);
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = () => {
    res.write(`data: ${JSON.stringify(getWorAdminImportSnapshot())}\n\n`);
  };
  send();
  const unsubscribe = subscribeWorAdminImport(() => {
    send();
  });
  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

worAdminApiRouter.post('/import/start', requireCodexAdmin, async (req, res) => {
  if (!isWorDbAvailable()) {
    err(res, 'WoR database unavailable', 503);
    return;
  }
  const data = validateBody(worAdminImportRunSchema, req.body ?? {}, res);
  if (!data) return;
  if (isWorImportRunning()) {
    err(res, 'Import already running', 409);
    return;
  }
  const result = await startWorAdminImport({
    forceImport: data.forceImport,
    forceImages: data.forceImages,
    forceSteps: data.forceSteps,
  });
  if (!result.started) {
    err(res, result.reason ?? 'Import could not start', 409);
    return;
  }
  json(res, getWorAdminImportSnapshot());
});

worAdminApiRouter.get('/catalog/status', requireCodexAdmin, (_req, res) => {
  if (!isWorDbAvailable()) {
    err(res, 'WoR database unavailable', 503);
    return;
  }
  const db = getWorDb();
  json(res, {
    needs_import: catalogNeedsImport(db),
    has_catalog: !catalogNeedsImport(db),
  });
});

worAdminApiRouter.post('/catalog/bootstrap', requireCodexAdmin, async (_req, res) => {
  if (!isWorDbAvailable()) {
    err(res, 'WoR database unavailable', 503);
    return;
  }
  if (isWorImportRunning()) {
    err(res, 'Import already running', 409);
    return;
  }
  try {
    const summary = await runWorStartupPipeline();
    json(res, { ok: true, summary });
  } catch (error) {
    err(res, error instanceof Error ? error.message : 'Bootstrap failed', 500);
  }
});

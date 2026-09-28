import { requireCodexAdmin } from '@codex/core';
import { validateBody } from '@codex/core/validation';
import { Router, type Response } from 'express';
import { z } from 'zod';

import { parseForceSteps } from '../../shared/warframeImport/pipelineSteps.js';
import { getClerkUserId } from '../auth/clerkUser.js';
import {
  getAdminImportSnapshot,
  isAdminImportRunning,
  resetAdminImportLock,
  startAdminImportJob,
  subscribeAdminImportSnapshot,
} from '../import/warframe/adminImportJob.js';
import { catalogNeedsImport } from '../import/warframe/startupPipeline.js';

export const warframeAdminImportRouter = Router();

const warframeAdminImportRunSchema = z.object({
  forceImport: z.boolean().optional(),
  forceImages: z.boolean().optional(),
  forceSteps: z.array(z.string()).optional(),
});

function json(res: Response, data: object, status = 200): void {
  res.status(status).json(data);
}

function err(res: Response, message: string, status = 400): void {
  res.status(status).json({ error: message });
}

warframeAdminImportRouter.get('/import/status', requireCodexAdmin, (_req, res) => {
  json(res, getAdminImportSnapshot());
});

warframeAdminImportRouter.get('/import/stream', requireCodexAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    unsubscribe();
  };

  const canWrite = () => !closed && !res.writableEnded && !res.writableFinished && res.writable;

  const sendSnapshot = () => {
    if (!canWrite()) {
      cleanup();
      return;
    }
    try {
      const payload = JSON.stringify(getAdminImportSnapshot());
      res.write('event: snapshot\n');
      res.write(`data: ${payload}\n\n`);
    } catch {
      cleanup();
    }
  };

  const unsubscribe = subscribeAdminImportSnapshot(() => {
    sendSnapshot();
  });

  sendSnapshot();
  heartbeat = setInterval(() => {
    if (!canWrite()) {
      cleanup();
      return;
    }
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, 15_000);

  req.on('close', () => {
    cleanup();
  });
});

warframeAdminImportRouter.post('/import/start', requireCodexAdmin, (req, res) => {
  const data = validateBody(warframeAdminImportRunSchema, req.body ?? {}, res);
  if (!data) return;
  if (isAdminImportRunning()) {
    err(res, 'Import already running', 409);
    return;
  }
  const userId = getClerkUserId(req);
  if (!userId) {
    err(res, 'Not authenticated', 401);
    return;
  }
  const result = startAdminImportJob(userId, {
    forceImport: data.forceImport,
    forceImages: data.forceImages,
    forceSteps: parseForceSteps(data.forceSteps),
  });
  if (!result.started) {
    err(res, result.reason ?? 'Import could not start', 409);
    return;
  }
  json(res, { started: true, snapshot: result.snapshot }, 202);
});

warframeAdminImportRouter.post('/import/reset', requireCodexAdmin, (_req, res) => {
  const result = resetAdminImportLock();
  if (!result.cleared) {
    err(res, result.reason ?? 'Import job is still running', 409);
    return;
  }
  json(res, { ok: true, snapshot: result.snapshot });
});

warframeAdminImportRouter.get('/catalog/status', requireCodexAdmin, (_req, res) => {
  json(res, {
    needs_import: catalogNeedsImport(),
    has_catalog: !catalogNeedsImport(),
  });
});

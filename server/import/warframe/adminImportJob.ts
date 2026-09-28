import { log } from '@codex/core';

import type { PipelineStepKey } from '../../../shared/warframeImport/pipelineSteps.js';
import { bustCatalogResponseCache } from './cacheStubs.js';
import { bustModListCache } from './cacheStubs.js';
import {
  createImportRun,
  getActiveImportRunId,
  getImportRunRow,
  getLatestImportRunRow,
  isImportLeaseHeld,
  maskClerkUserId,
  noteImportLeaseHeartbeat,
  parseImportRunSteps,
  persistImportRunSteps,
  recoverImportLeaseOnStartup,
  releaseImportLease,
  touchLiveImportLease,
  tryAcquireImportLease,
  updateImportRun,
  type ImportLogLine,
} from './importRuns.js';
import type { StartupPipelineSummary } from './pipelineSummary.js';
import { runStartupPipeline } from './startupPipeline.js';

export type { ImportLogLine } from './importRuns.js';

export interface AdminImportSnapshot {
  runId: number;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  requestedByUserId: string | null;
  requestedByUserMasked: string | null;
  lines: ImportLogLine[];
  summary: StartupPipelineSummary | null;
  error: string | null;
}

type SnapshotListener = (snapshot: AdminImportSnapshot) => void;

const MAX_LINES = 4000;
const listeners = new Set<SnapshotListener>();

let state: AdminImportSnapshot = {
  runId: 0,
  running: false,
  startedAt: null,
  finishedAt: null,
  requestedByUserId: null,
  requestedByUserMasked: null,
  lines: [],
  summary: null,
  error: null,
};

let hydratedFromDb = false;

let activeJobPromise: Promise<void> | null = null;

function hydrateAdminImportFromDb(): void {
  if (hydratedFromDb) return;
  hydratedFromDb = true;
  if (state.runId > 0 || state.lines.length > 0) return;
  const activeRunId = getActiveImportRunId();
  const row =
    (activeRunId != null ? getImportRunRow(activeRunId) : null) ?? getLatestImportRunRow();
  if (!row) return;
  const steps = parseImportRunSteps(row.steps_json);
  state = {
    runId: row.id,
    running: false,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    requestedByUserId: null,
    requestedByUserMasked: null,
    lines: steps.lines,
    summary: steps.summary,
    error: row.error_text,
  };
}

function prepareAdminImportSnapshot(): void {
  hydrateAdminImportFromDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function pushLine(level: 'info' | 'error', message: string): void {
  const line: ImportLogLine = {
    ts: nowIso(),
    level,
    message,
  };
  state.lines.push(line);
  if (state.lines.length > MAX_LINES) {
    state.lines.splice(0, state.lines.length - MAX_LINES);
  }
  schedulePersistCurrentSteps();
  notify();
}

const PERSIST_THROTTLE_MS = 1000;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistCurrentSteps(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistCurrentSteps();
  }, PERSIST_THROTTLE_MS);
  persistTimer.unref?.();
}

function persistCurrentSteps(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (state.runId < 1) return;
  persistImportRunSteps(state.runId, {
    lines: state.lines,
    summary: state.summary,
  });
}

function notify(): void {
  const snapshot = getAdminImportSnapshot();
  let index = 0;
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      log('error', 'Admin import snapshot listener failed', {
        index,
        err: error instanceof Error ? error.message : String(error),
      });
    }
    index += 1;
  }
}

export function getAdminImportSnapshot(): AdminImportSnapshot {
  prepareAdminImportSnapshot();
  return {
    ...state,
    running: state.running || isImportLeaseHeld(),
    lines: [...state.lines],
  };
}

export interface AdminImportResetResult {
  cleared: boolean;
  reason?: string;
  snapshot: AdminImportSnapshot;
}

export function resetAdminImportLock(): AdminImportResetResult {
  if (activeJobPromise !== null) {
    return {
      cleared: false,
      reason: 'An import job is still running in this process; wait for it to finish.',
      snapshot: getAdminImportSnapshot(),
    };
  }
  // No local job: always drop the lease (including non-stale orphans from a prior process).
  recoverImportLeaseOnStartup();
  state.running = false;
  if (state.runId > 0 && !state.finishedAt) {
    state.finishedAt = nowIso();
    state.error = state.error ?? 'Import lock cleared by admin.';
    updateImportRun(state.runId, {
      status: 'failed',
      finished_at: state.finishedAt,
      error_text: state.error,
    });
    persistCurrentSteps();
  }
  notify();
  return { cleared: true, snapshot: getAdminImportSnapshot() };
}

export function subscribeAdminImportSnapshot(listener: SnapshotListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAdminImportRunning(): boolean {
  return activeJobPromise !== null || state.running || isImportLeaseHeld();
}

export function waitForAdminImportIdle(timeoutMs: number): Promise<boolean> {
  if (!isAdminImportRunning()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubscribe = subscribeAdminImportSnapshot(() => {
      if (!isAdminImportRunning()) {
        finish(true);
      }
    });
  });
}

export interface AdminImportOptions {
  forceImport?: boolean;
  forceImages?: boolean;
  forceSteps?: PipelineStepKey[];
}

export function startAdminImportJob(
  requestedByUserId: string,
  options: AdminImportOptions = {},
): {
  started: boolean;
  snapshot: AdminImportSnapshot;
  reason?: string;
} {
  if (isAdminImportRunning()) {
    return {
      started: false,
      reason: 'An import job is already running.',
      snapshot: getAdminImportSnapshot(),
    };
  }

  const run = createImportRun(requestedByUserId);
  const masked = maskClerkUserId(requestedByUserId);
  state = {
    runId: run.id,
    running: true,
    startedAt: nowIso(),
    finishedAt: null,
    requestedByUserId,
    requestedByUserMasked: masked,
    lines: [],
    summary: null,
    error: null,
  };
  updateImportRun(run.id, { status: 'running' });
  pushLine('info', `[AdminImport] Run #${state.runId} queued by user ${masked}.`);

  activeJobPromise = (async () => {
    const lockToken = tryAcquireImportLease(run.id);
    if (!lockToken) {
      const message = 'An import job is already running.';
      state.error = message;
      state.running = false;
      state.finishedAt = nowIso();
      updateImportRun(run.id, {
        status: 'failed',
        finished_at: state.finishedAt,
        error_text: message,
      });
      persistCurrentSteps();
      activeJobPromise = null;
      notify();
      return;
    }

    try {
      const leaseWatch = { lost: false };
      const heartbeat = setInterval(
        () => {
          noteImportLeaseHeartbeat(lockToken, leaseWatch);
        },
        5 * 60 * 1000,
      );
      heartbeat.unref();
      try {
        const summary = await runStartupPipeline({
          cliReport: true,
          forceImport: options.forceImport,
          forceImages: options.forceImages,
          forceSteps: options.forceSteps,
          importRunId: run.id,
          skipLease: true,
          heldLockToken: lockToken,
          reporter: (line, level) => {
            touchLiveImportLease(lockToken, leaseWatch);
            pushLine(level, line);
          },
        });
        state.summary = summary;
        pushLine(
          'info',
          `[AdminImport] Run #${state.runId} finished in ${(summary.durationMs / 1000).toFixed(1)}s.`,
        );
        updateImportRun(run.id, {
          status: 'succeeded',
          finished_at: nowIso(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        state.error = message;
        pushLine('error', `[AdminImport] Run #${state.runId} failed: ${message}`);
        updateImportRun(run.id, {
          status: 'failed',
          finished_at: nowIso(),
          error_text: message,
        });
      } finally {
        clearInterval(heartbeat);
      }
    } finally {
      releaseImportLease(lockToken);
      state.running = false;
      state.finishedAt = nowIso();
      persistCurrentSteps();
      bustModListCache();
      bustCatalogResponseCache();
      activeJobPromise = null;
      notify();
    }
  })();

  return { started: true, snapshot: getAdminImportSnapshot() };
}

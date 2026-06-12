import { EventEmitter } from 'node:events';

import {
  isWarframeSyncLeaseHeld,
  releaseWarframeSyncLease,
  tryAcquireWarframeSyncLease,
} from './warframeSyncJobs.js';

let running = false;
const syncStateEmitter = new EventEmitter();

export class SyncAlreadyRunningError extends Error {
  constructor(message = 'A Warframe sync is already running.') {
    super(message);
    this.name = 'SyncAlreadyRunningError';
  }
}

export function isWarframeSyncRunning(): boolean {
  return running || isWarframeSyncLeaseHeld();
}

export function acquireWarframeSyncSlot(runId: number | null = null): string {
  if (isWarframeSyncRunning()) {
    throw new SyncAlreadyRunningError();
  }
  const lockToken = tryAcquireWarframeSyncLease(runId);
  if (!lockToken) {
    throw new SyncAlreadyRunningError();
  }
  running = true;
  return lockToken;
}

export function releaseWarframeSyncSlot(lockToken: string): void {
  releaseWarframeSyncLease(lockToken);
  running = false;
  syncStateEmitter.emit('stopped');
}

export async function runWarframeSyncGuarded<T>(
  fn: () => T | Promise<T>,
  runId: number | null = null,
): Promise<T> {
  const lockToken = acquireWarframeSyncSlot(runId);
  try {
    return await Promise.resolve(fn());
  } finally {
    releaseWarframeSyncSlot(lockToken);
  }
}

export function waitForWarframeSyncIdle(timeoutMs: number): Promise<boolean> {
  if (!isWarframeSyncRunning()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (idle: boolean) => {
      if (settled) return;
      settled = true;
      syncStateEmitter.off('stopped', onStopped);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve(idle);
    };

    const onStopped = () => {
      if (!isWarframeSyncRunning()) {
        finish(true);
      }
    };

    syncStateEmitter.on('stopped', onStopped);

    if (!isWarframeSyncRunning()) {
      finish(true);
      return;
    }

    timeoutId = setTimeout(() => {
      finish(!isWarframeSyncRunning());
    }, timeoutMs);
  });
}

import { createSessionSchema, getSessionDb } from '@codex/core';

import { ensureWarframeSyncJobsSchema } from '../services/warframeSyncJobs.js';

export function ensureSessionSchema(): void {
  const db = getSessionDb();
  createSessionSchema(db);
  ensureWarframeSyncJobsSchema(db);
}

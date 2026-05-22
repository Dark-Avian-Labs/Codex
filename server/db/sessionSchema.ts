import { createSessionSchema } from '@codex/core';

import { getSessionDb } from './connection.js';

export function ensureSessionSchema(): void {
  createSessionSchema(getSessionDb());
}

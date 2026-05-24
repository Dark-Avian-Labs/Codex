import { createSessionSchema, getSessionDb } from '@codex/core';

export function ensureSessionSchema(): void {
  createSessionSchema(getSessionDb());
}

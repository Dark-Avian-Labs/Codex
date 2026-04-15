import { createCentralSchema } from '@codex/core';

import { getCentralDb } from './connection.js';

export function ensureCentralSchema(): void {
  createCentralSchema(getCentralDb());
}

import os from 'node:os';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

const testEnvDefaults = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'codex-dev-only-session-secret-32ch',
  SESSION_DB_PATH: path.join(os.tmpdir(), 'codex-vitest-session.db'),
  ARMORY_DB_PATH: path.join(os.tmpdir(), 'codex-vitest-armory.db'),
  COOKIE_DOMAIN: 'localhost',
  BASE_HOST: 'localhost',
  BASE_DOMAIN: 'example.com',
} as const;

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'server/**/*.test.ts',
      'packages/core/src/**/*.test.ts',
      'client/**/*.test.ts',
    ],
    testTimeout: 10_000,
    env: {
      ...testEnvDefaults,
    },
  },
});

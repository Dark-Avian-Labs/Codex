import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const e2eRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-e2e-'));
const port = process.env.CODEX_E2E_PORT?.trim() || '3101';
const baseURL = `http://127.0.0.1:${port}`;
const armoryDbPath = path.join(e2eRoot, 'armory.db');
fs.writeFileSync(armoryDbPath, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    env: {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: port,
      SESSION_SECRET: 'codex-dev-only-session-secret-32ch',
      SESSION_DB_PATH: path.join(e2eRoot, 'session.db'),
      ARMORY_DB_PATH: armoryDbPath,
      WARFRAME_DB_PATH: path.join(e2eRoot, 'warframe.db'),
      EPIC7_DB_PATH: path.join(e2eRoot, 'epic7.db'),
      WOR_DB_PATH: path.join(e2eRoot, 'wor.db'),
      APP_PUBLIC_BASE_URL: baseURL,
      BASE_DOMAIN: 'example.com',
      CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: '',
      VITE_CLERK_PUBLISHABLE_KEY: '',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

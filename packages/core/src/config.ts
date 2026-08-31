import fs from 'fs';
import path from 'path';

import { isEncryptedEnvValue } from './auth/clerkEnv.js';

export function resolveEnvFilePath(rootPath: string): string | null {
  const normalizedNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

  if (normalizedNodeEnv === 'test') {
    const testPath = path.join(rootPath, '.env.test');
    return fs.existsSync(testPath) ? testPath : null;
  }

  if (
    normalizedNodeEnv &&
    normalizedNodeEnv !== 'production' &&
    normalizedNodeEnv !== 'development'
  ) {
    throw new Error(
      `[FATAL] Unsupported NODE_ENV "${process.env.NODE_ENV}". Use production, development, or test.`,
    );
  }

  const isProduction = normalizedNodeEnv !== 'development';
  const fileName = isProduction ? '.env.production' : '.env.development';
  const candidatePath = path.join(rootPath, fileName);
  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }
  if (isProduction) {
    throw new Error(
      `[FATAL] Missing ${fileName}. Refusing to start production without the matching env file.`,
    );
  }
  return null;
}

export const APP_NAME = 'Codex';

const DEFAULT_CODEX_APP_ID = 'codex';

export function getCodexAppId(): string {
  const raw = process.env.APP_ID?.trim().toLowerCase();
  if (!raw || isEncryptedEnvValue(raw)) {
    return DEFAULT_CODEX_APP_ID;
  }
  return raw;
}

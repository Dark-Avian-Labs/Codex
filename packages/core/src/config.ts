import fs from 'fs';
import path from 'path';

import { isEncryptedEnvValue } from './auth/clerkEnv.js';

export function resolveEnvFilePath(rootPath: string): string | null {
  const normalizedNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

  if (normalizedNodeEnv === 'test') {
    const testPath = path.join(rootPath, '.env.test');
    return fs.existsSync(testPath) ? testPath : null;
  }

  const envFileByMode: Record<string, string> = {
    production: '.env.production',
    development: '.env.development',
  };
  const prioritizedFiles = [
    envFileByMode[normalizedNodeEnv],
    '.env.production',
    '.env.development',
  ].filter((value, index, values): value is string => {
    return typeof value === 'string' && values.indexOf(value) === index;
  });

  for (const fileName of prioritizedFiles) {
    if (!fileName) continue;
    const candidatePath = path.join(rootPath, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

export const APP_NAME = 'Codex';

const DEFAULT_CODEX_APP_ID = 'codex';

/** Resolved at call time so dotenv can decrypt APP_ID before auth checks run. */
export function getCodexAppId(): string {
  const raw = process.env.APP_ID?.trim().toLowerCase();
  if (!raw || isEncryptedEnvValue(raw)) {
    return DEFAULT_CODEX_APP_ID;
  }
  return raw;
}

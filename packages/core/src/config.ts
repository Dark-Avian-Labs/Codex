import fs from 'fs';
import path from 'path';

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
export const CODEX_APP_ID = process.env.APP_ID?.trim().toLowerCase() || 'codex';

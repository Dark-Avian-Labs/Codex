import { config as loadEnv } from '@dotenvx/dotenvx';
import fs from 'fs';
import path from 'path';

const testEnvCandidates = ['.env.test', '.env.development', '.env'];
for (const envFile of testEnvCandidates) {
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    continue;
  }
  try {
    loadEnv({ path: envPath });
  } catch (error) {
    console.error(
      `[Test Setup] Failed to load environment via loadEnv from "${envPath}".`,
      error,
    );
    throw error;
  }
  break;
}

process.env.NODE_ENV ??= 'test';
process.env.APP_PUBLIC_BASE_URL ??= 'https://corpus.example.test';
process.env.AUTH_SERVICE_URL ??= 'https://auth.example.test';
process.env.COOKIE_DOMAIN ??= '.example.test';
process.env.BASE_HOST ??= 'corpus.example.test';
process.env.BASE_DOMAIN ??= 'example.test';
process.env.BASE_PROTOCOL ??= 'https';
process.env.APP_SUBDOMAIN ??= 'corpus';
process.env.CENTRAL_DB_PATH ??= path.join(
  process.cwd(),
  'data',
  'central.test.db',
);
process.env.PARAMETRIC_DB_PATH ??= path.join(
  process.cwd(),
  'data',
  'parametric.test.db',
);
process.env.SESSION_SECRET ??= 'test-session-secret-32-characters-min';

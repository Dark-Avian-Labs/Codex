import { getAppPublicBaseUrl } from './appPublicBaseUrl.js';

const DEV_AUTHORIZED_PARTIES = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
] as const;

function isAllowedOrigin(origin: string, isDevEnv: boolean): boolean {
  return origin.startsWith('https://') || (isDevEnv && origin.startsWith('http://'));
}

export function getClerkAuthorizedParties(): string[] {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  const isDevEnv = nodeEnv === 'development' || nodeEnv === 'test';

  const configuredOrigins = (process.env.ALLOWED_APP_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const devOrigins = isDevEnv ? DEV_AUTHORIZED_PARTIES : [];

  return [...new Set([getAppPublicBaseUrl(), ...configuredOrigins, ...devOrigins])].filter(
    (origin) => isAllowedOrigin(origin, isDevEnv),
  );
}

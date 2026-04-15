import { describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'APP_PUBLIC_BASE_URL',
  'COOKIE_DOMAIN',
  'BASE_HOST',
  'AUTH_SERVICE_URL',
  'NODE_ENV',
  'BASE_DOMAIN',
  'BASE_PROTOCOL',
  'APP_SUBDOMAIN',
  'APP_ID',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];
type EnvOverrides = Partial<Record<EnvKey, string | undefined>>;

function restoreEnv(key: EnvKey, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function withEnvOverrides<T>(
  overrides: EnvOverrides,
  fn: (getAppPublicBaseUrl: () => string) => T | Promise<T>,
): Promise<T> {
  const originals: Record<EnvKey, string | undefined> = {
    APP_PUBLIC_BASE_URL: process.env.APP_PUBLIC_BASE_URL,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
    BASE_HOST: process.env.BASE_HOST,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BASE_DOMAIN: process.env.BASE_DOMAIN,
    BASE_PROTOCOL: process.env.BASE_PROTOCOL,
    APP_SUBDOMAIN: process.env.APP_SUBDOMAIN,
    APP_ID: process.env.APP_ID,
  };
  try {
    for (const key of ENV_KEYS) {
      if (key in overrides) {
        restoreEnv(key, overrides[key]);
      }
    }
    await vi.resetModules();
    const { getAppPublicBaseUrl } = await import('../packages/core/src/middleware/appPublicBaseUrl.js');
    return await fn(getAppPublicBaseUrl);
  } finally {
    for (const key of ENV_KEYS) {
      restoreEnv(key, originals[key]);
    }
  }
}

describe('getAppPublicBaseUrl', () => {
  it('prefers explicit APP_PUBLIC_BASE_URL', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: 'https://corpus.example.com/',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(getAppPublicBaseUrl()).toBe('https://corpus.example.com');
      },
    );
  });
  it('computes URL from BASE_DOMAIN when APP_PUBLIC_BASE_URL omitted', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: undefined,
        BASE_DOMAIN: 'example.com',
        BASE_PROTOCOL: 'https',
        APP_SUBDOMAIN: 'corpus',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(getAppPublicBaseUrl()).toBe('https://corpus.example.com');
      },
    );
  });

  it('defaults BASE_PROTOCOL to https when BASE_PROTOCOL is unset', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: undefined,
        BASE_DOMAIN: 'example.com',
        BASE_PROTOCOL: undefined,
        APP_SUBDOMAIN: 'corpus',
        APP_ID: undefined,
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        const url = getAppPublicBaseUrl();
        expect(url.startsWith('https')).toBe(true);
        expect(url).toBe('https://corpus.example.com');
      },
    );
  });

  it('uses APP_ID as subdomain when APP_SUBDOMAIN is missing', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: undefined,
        BASE_DOMAIN: 'example.com',
        BASE_PROTOCOL: 'https',
        APP_SUBDOMAIN: undefined,
        APP_ID: 'myapp',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'myapp.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(getAppPublicBaseUrl()).toBe('https://myapp.example.com');
      },
    );
  });

  it('defaults subdomain to corpus when APP_SUBDOMAIN and APP_ID are missing', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: undefined,
        BASE_DOMAIN: 'example.com',
        BASE_PROTOCOL: 'https',
        APP_SUBDOMAIN: undefined,
        APP_ID: undefined,
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(getAppPublicBaseUrl()).toBe('https://corpus.example.com');
      },
    );
  });

  it('rejects invalid BASE_PROTOCOL such as ftp', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: undefined,
        BASE_DOMAIN: 'example.com',
        BASE_PROTOCOL: 'ftp',
        APP_SUBDOMAIN: 'corpus',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(() => getAppPublicBaseUrl()).toThrow(/APP_PUBLIC_BASE_URL|BASE_DOMAIN/);
      },
    );
  });

  it('throws when neither APP_PUBLIC_BASE_URL nor BASE_DOMAIN is set', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: undefined,
        BASE_DOMAIN: undefined,
        BASE_PROTOCOL: undefined,
        APP_SUBDOMAIN: undefined,
        APP_ID: undefined,
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(() => getAppPublicBaseUrl()).toThrow(/APP_PUBLIC_BASE_URL|BASE_DOMAIN/);
      },
    );
  });
  it('rejects invalid APP_PUBLIC_BASE_URL format', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: 'not-a-valid-url',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
      },
      (getAppPublicBaseUrl) => {
        expect(() => getAppPublicBaseUrl()).toThrow('APP_PUBLIC_BASE_URL must be a valid URL.');
      },
    );
  });
  it('rejects non-https APP_PUBLIC_BASE_URL in production', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: 'http://corpus.example.com/',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
        NODE_ENV: 'production',
      },
      (getAppPublicBaseUrl) => {
        expect(() => getAppPublicBaseUrl()).toThrow();
      },
    );
  });

  it('allows non-https APP_PUBLIC_BASE_URL in development', async () => {
    await withEnvOverrides(
      {
        APP_PUBLIC_BASE_URL: 'http://corpus.example.com/',
        COOKIE_DOMAIN: '.example.com',
        BASE_HOST: 'corpus.example.com',
        AUTH_SERVICE_URL: 'https://auth.example.com',
        NODE_ENV: 'development',
      },
      (getAppPublicBaseUrl) => {
        expect(getAppPublicBaseUrl()).toBe('http://corpus.example.com');
      },
    );
  });
});

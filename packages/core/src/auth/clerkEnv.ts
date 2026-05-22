const ENCRYPTED_PREFIX = 'encrypted:';

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function isEncryptedEnvValue(value: string | undefined): boolean {
  return trimEnv(value).startsWith(ENCRYPTED_PREFIX);
}

export function normalizeClerkEnv(options?: { requireKeys?: boolean }): void {
  const requireKeys = options?.requireKeys ?? process.env.NODE_ENV === 'production';
  const publishable =
    trimEnv(process.env.CLERK_PUBLISHABLE_KEY) || trimEnv(process.env.VITE_CLERK_PUBLISHABLE_KEY);
  const secret = trimEnv(process.env.CLERK_SECRET_KEY);

  if (publishable && !trimEnv(process.env.CLERK_PUBLISHABLE_KEY)) {
    process.env.CLERK_PUBLISHABLE_KEY = publishable;
  }

  if (requireKeys) {
    for (const [name, value] of [
      ['CLERK_PUBLISHABLE_KEY', publishable],
      ['CLERK_SECRET_KEY', secret],
      ['VITE_CLERK_PUBLISHABLE_KEY', trimEnv(process.env.VITE_CLERK_PUBLISHABLE_KEY)],
    ] as const) {
      if (isEncryptedEnvValue(value)) {
        throw new Error(
          `[FATAL] ${name} is still encrypted. Ensure DOTENV_PRIVATE_KEY_* is available (see .env.keys) or run via dotenvx.`,
        );
      }
    }

    if (!publishable || !secret) {
      throw new Error(
        '[FATAL] CLERK_PUBLISHABLE_KEY (or VITE_CLERK_PUBLISHABLE_KEY) and CLERK_SECRET_KEY must be set.',
      );
    }
  }
}

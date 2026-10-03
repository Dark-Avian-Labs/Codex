import { config as loadEnv } from '@dotenvx/dotenvx';

import { clerkFrontendApiOrigin, isSignedInClerkConfigured } from '../server/signedInClerk.js';

export { clerkFrontendApiOrigin };

export const signedInStorageState = 'e2e/.clerk/user.json';

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? '';
    if (trimmed) return trimmed;
  }
  return '';
}

function skipSignedIn(reason: string): null {
  console.warn(`[e2e] Signed-in tests skipped: ${reason}`);
  return null;
}

export function readSignedInClerk(): { email: string; publishable: string; secret: string } | null {
  const email = process.env.E2E_CLERK_USER_EMAIL?.trim() ?? '';
  if (!email) return skipSignedIn('E2E_CLERK_USER_EMAIL is not set.');

  try {
    const loaded = loadEnv({ path: '.env.development', quiet: true, overload: false });
    const parsed = loaded.parsed ?? {};
    const publishable = firstNonEmpty(
      parsed.VITE_CLERK_PUBLISHABLE_KEY,
      parsed.CLERK_PUBLISHABLE_KEY,
      process.env.VITE_CLERK_PUBLISHABLE_KEY,
      process.env.CLERK_PUBLISHABLE_KEY,
    );
    const secret = firstNonEmpty(parsed.CLERK_SECRET_KEY, process.env.CLERK_SECRET_KEY);
    if (!isSignedInClerkConfigured(email, publishable, secret)) {
      return skipSignedIn('Clerk pk_test_ and sk_test_ keys are missing from .env.development.');
    }

    process.env.CLERK_PUBLISHABLE_KEY = publishable;
    process.env.CLERK_SECRET_KEY = secret;
    process.env.VITE_CLERK_PUBLISHABLE_KEY = publishable;
    return { email, publishable, secret };
  } catch {
    return skipSignedIn('Could not decrypt .env.development.');
  }
}

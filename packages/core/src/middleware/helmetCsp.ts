import helmet from 'helmet';

const DEFAULT_CLERK_FAPI_ORIGIN = 'https://clerk.darkavianlabs.com';

export function getClerkFapiOrigin(): string {
  const fromEnv = process.env.CLERK_FAPI_URL?.trim() || process.env.VITE_CLERK_FAPI_URL?.trim();
  if (!fromEnv) return DEFAULT_CLERK_FAPI_ORIGIN;
  return fromEnv.replace(/\/+$/, '');
}

export function createAppHelmet() {
  const clerkFapi = getClerkFapiOrigin();
  const defaults = helmet.contentSecurityPolicy.getDefaultDirectives();

  return helmet({
    contentSecurityPolicy: {
      directives: {
        ...defaults,
        'script-src': ["'self'", clerkFapi, 'https://challenges.cloudflare.com'],
        'connect-src': ["'self'", clerkFapi],
        'img-src': [...(defaults['img-src'] ?? ["'self'"]), 'https://img.clerk.com'],
        'frame-src': ["'self'", 'https://challenges.cloudflare.com'],
        'worker-src': ["'self'", 'blob:'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  });
}

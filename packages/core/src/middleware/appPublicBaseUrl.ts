export function getAppPublicBaseUrl(): string {
  const configured = process.env.APP_PUBLIC_BASE_URL?.trim();
  if (!configured) {
    throw new Error('APP_PUBLIC_BASE_URL must be set.');
  }
  const normalized = configured.replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('APP_PUBLIC_BASE_URL must be a valid URL.');
  }
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1');
  const nodeEnv = process.env.NODE_ENV;
  const isKnownNonProductionEnv = nodeEnv === 'development' || nodeEnv === 'test';
  if (nodeEnv == null || (nodeEnv !== 'production' && !isKnownNonProductionEnv)) {
    console.warn(
      `Unknown or unset NODE_ENV "${nodeEnv ?? ''}" detected; defaulting APP_PUBLIC_BASE_URL protocol policy to production (https-only unless local http).`,
    );
  }
  if (parsed.protocol !== 'https:' && !(isLocalHttp || isKnownNonProductionEnv)) {
    throw new Error('APP_PUBLIC_BASE_URL must use https://');
  }
  return normalized;
}

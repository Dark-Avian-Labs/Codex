export const APP_ADMIN_ROLE = 'admin' as const;

export type AppMetadata = {
  apps?: Record<string, string>;
};

export function isAppAdmin(metadata: AppMetadata | undefined | null, appId: string): boolean {
  return metadata?.apps?.[appId] === APP_ADMIN_ROLE;
}

export function metadataFromSessionClaims(sessionClaims: unknown): AppMetadata | undefined {
  if (!sessionClaims || typeof sessionClaims !== 'object') return undefined;
  const metadata = (sessionClaims as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;
  const apps = (metadata as { apps?: unknown }).apps;
  if (!apps || typeof apps !== 'object') return undefined;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(apps)) {
    if (typeof value === 'string') normalized[key] = value;
  }
  if (Object.keys(normalized).length === 0) return undefined;
  return { apps: normalized };
}

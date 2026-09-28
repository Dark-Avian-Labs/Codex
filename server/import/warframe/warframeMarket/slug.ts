import { normalizeDisplayName } from './canonical.js';

export function warframeMarketBaseSlug(displayName: string): string {
  const base = normalizeDisplayName(displayName).toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

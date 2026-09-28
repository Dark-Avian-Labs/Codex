import type { LookupAddress } from 'node:dns';
import dns from 'node:dns/promises';
import net from 'node:net';

export const ALLOWED_FETCH_HOSTS = new Set([
  'wiki.warframe.com',
  'overframe.gg',
  'media.overframe.gg',
  'content.warframe.com',
  'origin.warframe.com',
  'api.warframe.market',
]);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_EQUIPMENT_IMAGE_HOSTS = new Set([
  'content.warframe.com',
  'wiki.warframe.com',
  'media.overframe.gg',
  'overframe.gg',
]);

const RELATIVE_EQUIPMENT_IMAGE_RE = /^\/[A-Za-z0-9/_.-]+$/;

const PIN_TTL_MS = 60_000;
const pinnedAddresses = new Map<string, { records: LookupAddress[]; expiresAt: number }>();

export function getPinnedAddresses(host: string): LookupAddress[] | null {
  const key = host.toLowerCase();
  const entry = pinnedAddresses.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    pinnedAddresses.delete(key);
    return null;
  }
  return entry.records;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (family === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('::ffff:')) {
      const v4 = normalized.slice('::ffff:'.length);
      if (net.isIP(v4) === 4) return isPrivateOrLoopbackIp(v4);
    }
    return false;
  }
  return true;
}

export async function assertAllowedFetchUrl(url: string | URL): Promise<URL> {
  let parsed: URL;
  try {
    parsed = typeof url === 'string' ? new URL(url) : new URL(url.href);
  } catch {
    throw new Error(`Invalid fetch URL: ${String(url)}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing non-HTTPS fetch URL: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_FETCH_HOSTS.has(host)) {
    throw new Error(`Refusing fetch to non-allowlisted host: ${host}`);
  }
  if (net.isIP(host)) {
    if (isPrivateOrLoopbackIp(host)) {
      throw new Error(`Refusing fetch to private/loopback IP: ${host}`);
    }
    return parsed;
  }
  const records = await dns.lookup(host, { all: true, verbatim: true });
  for (const record of records) {
    if (isPrivateOrLoopbackIp(record.address)) {
      throw new Error(`Refusing fetch: ${host} resolved to private/loopback IP ${record.address}`);
    }
  }
  if (records.length > 0) {
    pinnedAddresses.set(host, { records, expiresAt: Date.now() + PIN_TTL_MS });
  }
  return parsed;
}

export function assertAllowedImageMime(contentType: string | null): void {
  if (!contentType) return;
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!mime) return;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
    throw new Error(`Refusing non-image Content-Type: ${mime}`);
  }
}

export function isAllowedEquipmentImage(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (RELATIVE_EQUIPMENT_IMAGE_RE.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_EQUIPMENT_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

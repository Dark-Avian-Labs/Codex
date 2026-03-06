import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash } from 'node:crypto';

function firstHeaderValue(req: Request, header: string): string | null {
  const value = req.headers?.[header];
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === 'string' && value.trim() !== '')
    return value.split(',')[0]?.trim() ?? null;
  return null;
}

function buildFallbackKey(req: Request): string {
  const ua = firstHeaderValue(req, 'user-agent') ?? 'ua:unknown';
  const host = firstHeaderValue(req, 'host') ?? 'host:unknown';
  const reqIp =
    typeof req.ip === 'string' && req.ip.trim() !== '' ? req.ip : null;
  const forwarded = firstHeaderValue(req, 'x-forwarded-for');
  const realIp = firstHeaderValue(req, 'x-real-ip');
  const cfIp = firstHeaderValue(req, 'cf-connecting-ip');
  const socketIp =
    typeof req.socket?.remoteAddress === 'string' &&
    req.socket.remoteAddress.length > 0
      ? req.socket.remoteAddress
      : null;

  const candidateIp = reqIp ?? forwarded ?? realIp ?? cfIp ?? socketIp;
  const normalizedIp = candidateIp ? ipKeyGenerator(candidateIp) : 'ip:unknown';

  const composite = [
    normalizedIp,
    ua,
    host,
    req.method,
    req.headers['accept-language'] ?? 'lang:unknown',
    req.headers['accept'] ?? 'accept:unknown',
  ]
    .map((part) => String(part ?? '').trim())
    .join('|');

  return createHash('sha256').update(composite).digest('hex');
}

const keyGen = (req: Request): string => {
  try {
    const ip = req?.ip;
    if (typeof ip === 'string' && ip.length > 0) {
      return ipKeyGenerator(ip);
    }
  } catch {
    // ignore
  }
  return buildFallbackKey(req);
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGen,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: keyGen,
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many admin requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGen,
});

import type { Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { SessionOptions } from 'express-session';
import request from 'supertest';

export const testRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

const testSessionCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
};

export function testSessionOptions(overrides: Partial<SessionOptions> = {}): SessionOptions {
  return {
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: testSessionCookie,
    ...overrides,
  };
}

export function createSessionAgent(app: Express) {
  return request.agent(app);
}

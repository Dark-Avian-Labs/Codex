import type { Response } from 'express';
import { vi } from 'vitest';

export function mockResponse(accepts: string | false = 'json') {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    accepts: vi.fn(() => accepts),
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

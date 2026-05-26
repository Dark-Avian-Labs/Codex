import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { mockResponse } from './testing/mockResponse.js';
import { optionalPositiveInt, positiveInt, validateBody } from './validation.js';

describe('validateBody', () => {
  const schema = z.object({
    name: z.string().trim().min(1),
    count: z.coerce.number().int().positive(),
  });

  it('returns parsed data for valid input', () => {
    const res = mockResponse();
    const data = validateBody(schema, { name: ' Excalibur ', count: '3' }, res);
    expect(data).toEqual({ name: 'Excalibur', count: 3 });
    expect(res.statusCode).toBe(200);
  });

  it('returns null and 400 JSON for invalid input', () => {
    const res = mockResponse();
    const data = validateBody(schema, { name: '', count: 0 }, res);
    expect(data).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.any(Object),
      }),
    );
  });
});

describe('positiveInt', () => {
  it('coerces string ids', () => {
    expect(positiveInt.safeParse('5').success).toBe(true);
  });

  it('rejects zero and non-numeric values', () => {
    expect(positiveInt.safeParse(0).success).toBe(false);
    expect(positiveInt.safeParse('nope').success).toBe(false);
  });
});

describe('optionalPositiveInt', () => {
  it('accepts null and empty string as null', () => {
    expect(optionalPositiveInt.safeParse(null).success).toBe(true);
    expect(optionalPositiveInt.safeParse('').success).toBe(true);
  });

  it('coerces positive integers', () => {
    const result = optionalPositiveInt.safeParse('4');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(4);
  });
});

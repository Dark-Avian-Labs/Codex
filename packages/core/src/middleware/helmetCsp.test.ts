import { afterEach, describe, expect, it } from 'vitest';

import { getClerkFapiOrigin } from './helmetCsp.js';

describe('getClerkFapiOrigin', () => {
  const previous = {
    CLERK_FAPI_URL: process.env.CLERK_FAPI_URL,
    VITE_CLERK_FAPI_URL: process.env.VITE_CLERK_FAPI_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('defaults to the production Clerk FAPI host', () => {
    delete process.env.CLERK_FAPI_URL;
    delete process.env.VITE_CLERK_FAPI_URL;

    expect(getClerkFapiOrigin()).toBe('https://clerk.darkavianlabs.com');
  });

  it('prefers CLERK_FAPI_URL and strips trailing slashes', () => {
    process.env.CLERK_FAPI_URL = 'https://clerk.example.test/';

    expect(getClerkFapiOrigin()).toBe('https://clerk.example.test');
  });
});

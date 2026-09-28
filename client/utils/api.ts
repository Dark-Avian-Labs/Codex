export class ApiError extends Error {
  readonly status: number;
  readonly fields: string[];

  constructor(message: string, status: number, fields: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export type ClerkTokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

let cachedToken: string | null = null;
let inFlightPromise: Promise<string | null> | null = null;
let csrfTokenGeneration = 0;
let getClerkToken: ClerkTokenGetter | null = null;

export function setClerkTokenGetter(getter: ClerkTokenGetter | null): void {
  getClerkToken = getter;
}

async function resolveClerkToken(skipCache = false): Promise<string | null> {
  if (!getClerkToken) {
    return null;
  }
  try {
    const token = await getClerkToken({ skipCache });
    return token ?? null;
  } catch {
    return null;
  }
}

async function getCsrfToken(): Promise<string | null> {
  if (cachedToken !== null) {
    return cachedToken;
  }
  if (inFlightPromise !== null) {
    return await inFlightPromise;
  }

  const generationAtStart = csrfTokenGeneration;
  inFlightPromise = (async () => {
    try {
      const res = await fetch('/api/csrf', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        return null;
      }
      const body = (await res.json()) as { csrfToken?: string };
      if (!body.csrfToken) {
        return null;
      }
      if (generationAtStart === csrfTokenGeneration) {
        cachedToken = body.csrfToken;
      }
      return body.csrfToken;
    } catch {
      return null;
    } finally {
      inFlightPromise = null;
    }
  })();

  const generationBeforeAwait = csrfTokenGeneration;
  const token = await inFlightPromise;
  if (token === null && generationBeforeAwait === csrfTokenGeneration) {
    cachedToken = null;
  }
  return token;
}

export function clearCsrfToken(): void {
  csrfTokenGeneration += 1;
  cachedToken = null;
  inFlightPromise = null;
}

async function isCsrfFailureResponse(response: Response): Promise<boolean> {
  const csrfErrorHeader = response.headers.get('X-CSRF-Error');
  if (response.status === 403 && csrfErrorHeader === '1') {
    return true;
  }

  try {
    const body = (await response.clone().json()) as {
      code?: string;
      errorCode?: string;
      error_code?: string;
    };
    const code = body.code ?? body.errorCode ?? body.error_code;
    return response.status === 403 && code === 'CSRF_INVALID';
  } catch {
    return false;
  }
}

function send(url: string, init: RequestInit | undefined, headers: Headers): Promise<Response> {
  return fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
    cache: init?.cache ?? 'no-store',
  });
}

function withClerkAuthorization(headers: Headers, token: string | null): Headers {
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }
  return headers;
}

function withJsonContentType(headers: Headers, init?: RequestInit): Headers {
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

  const headers = withJsonContentType(new Headers(init?.headers), init);
  if (needsCsrf) {
    const csrfToken = await getCsrfToken();
    if (csrfToken === null) {
      throw new Error('Failed to fetch CSRF token');
    }
    headers.set('X-CSRF-Token', csrfToken);
  }

  let clerkToken = await resolveClerkToken(false);
  withClerkAuthorization(headers, clerkToken);

  let response = await send(url, init, headers);

  if (response.status === 401 && getClerkToken) {
    const refreshed = await resolveClerkToken(true);
    if (refreshed && refreshed !== clerkToken) {
      clerkToken = refreshed;
      response = await send(url, init, withClerkAuthorization(new Headers(headers), clerkToken));
    }
  }

  if (!needsCsrf || !(await isCsrfFailureResponse(response))) {
    return response;
  }

  clearCsrfToken();
  if (init?.signal?.aborted) {
    throw new DOMException('Request aborted before CSRF retry', 'AbortError');
  }
  const freshCsrfToken = await getCsrfToken();
  if (freshCsrfToken === null) {
    throw new Error('Failed to refresh CSRF token');
  }
  if (init?.signal?.aborted) {
    throw new DOMException('Request aborted before CSRF retry', 'AbortError');
  }

  const retryHeaders = withJsonContentType(
    withClerkAuthorization(new Headers(init?.headers), clerkToken),
    init,
  );
  retryHeaders.set('X-CSRF-Token', freshCsrfToken);
  return send(url, init, retryHeaders);
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    let message = 'Request failed';
    let fields: string[] = [];
    try {
      const data = (await res.json()) as { error?: unknown; fields?: unknown };
      if (typeof data.error === 'string' && data.error) message = data.error;
      if (Array.isArray(data.fields)) {
        fields = data.fields.filter((field): field is string => typeof field === 'string');
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status, fields);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

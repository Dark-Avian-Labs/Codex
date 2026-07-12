# Authentication Workflow

## Overview

Codex implements a **multi-layered authentication system** combining Clerk.com for identity management with custom Express.js sessions for application state. This provides secure, scalable authentication with proper session management and CSRF protection.

## Authentication Flow

### Complete Authentication Sequence

```
1. User visits Codex → Clerk authentication UI
2. Clerk authenticates user → Issues Clerk session token
3. Client stores Clerk token → Makes authenticated requests
4. Server validates Clerk token → Creates Express session
5. Server issues CSRF token → Stores in Express session
6. Client includes CSRF token → In state-changing requests
7. Server validates CSRF token → Processes authenticated request
```

### Step-by-Step Implementation

#### 1. Clerk Authentication Setup

**Client Configuration** (`/client/main.tsx`):

```typescript
import { ClerkProvider } from '@clerk/react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

<ClerkProvider publishableKey={clerkPubKey}>
  <App />
</ClerkProvider>
```

**Server Configuration** (`/server/auth/clerkAuth.ts`):

```typescript
import { ClerkExpressRequireAuth } from '@clerk/express';

export const clerkMiddleware = ClerkExpressRequireAuth({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  onError: (error) => {
    log.error('Clerk authentication error:', error);
    throw error;
  },
});
```

#### 2. Express Session Configuration

**Session Store** (`/server/session/store.ts`):

```typescript
import SQLiteStore from 'better-sqlite3-session-store';

const sessionConfig: session.SessionOptions = {
  store: new SQLiteStore({
    client: getSessionDb(),
    expired: {
      clear: true,
      intervalMs: 15 * 60 * 1000, // 15 minutes
    },
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: SESSION_COOKIE_NAME,
  cookie: {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: 'lax',
    domain: COOKIE_DOMAIN,
    maxAge: 24 * 60 * 170 * 1000, // 24 hours
  },
};
```

#### 3. CSRF Protection Implementation

**Middleware Setup** (`/server/auth/csrfProtection.ts`):

```typescript
import { csrfSync } from 'csrf-sync';

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.csrfToken(),
  getTokenFromState: (req) => req.session.csrfToken,
  storeTokenInState: (req, token) => {
    req.session.csrfToken = token;
  },
  size: 32, // Token size in bytes
});

// Apply to state-changing routes
app.post('/api/*', csrfSynchronisedProtection);
app.put('/api/*', csrfSynchronisedProtection);
app.delete('/api/*', csrfSynchronisedProtection);
app.patch('/api/*', csrfSynchronisedProtection);
```

#### 4. Client-Side CSRF Integration

**Token Retrieval**:

```typescript
// Client-side token management
async function getCsrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf-token', {
    credentials: 'include',
  });
  const data = await response.json();
  return data.csrfToken;
}

// Include in requests
async function makeAuthenticatedRequest(url: string, data: any) {
  const csrfToken = await getCsrfToken();

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
}
```

## User Roles and Permissions

### Role Management via Clerk Metadata

**Role Assignment**:

```typescript
// Clerk dashboard configuration
{
  "publicMetadata": {
    "role": "user" // or "admin"
  }
}
```

**Server-Side Role Verification**:

```typescript
// /server/auth/roleMiddleware.ts
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.auth?.publicMetadata?.role;

    if (userRole !== role) {
      return res.status(403).json({
        error: 'Insufficient permissions',
      });
    }

    next();
  };
}

// Usage
app.get('/api/admin/*', requireRole('admin'));
```

### Game-Specific Permissions

**Epic Seven Account Linking**:

```typescript
// /server/games/epic7/middleware.ts
export function requireEpic7Account() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.userId;
    const db = getEpic7Db();

    const account = db.prepare('SELECT * FROM game_accounts WHERE user_id = ?').get(userId);

    if (!account) {
      return res.status(403).json({
        error: 'No Epic Seven account linked',
      });
    }

    req.epic7Account = account;
    next();
  };
}
```

## Session Management

### Session Lifecycle

**Creation**:

1. User authenticates via Clerk
2. Server creates Express session with unique ID
3. CSRF token generated and stored in session
4. Session cookie sent to client

**Validation**:

1. Each request includes session cookie
2. Server retrieves session from SQLite store
3. Clerk token verified for current user
4. CSRF token validated for state-changing requests

**Destruction**:

1. User logs out via `/api/auth/logout`
2. Session destroyed in SQLite store
3. Session cookie cleared on client
4. Clerk session optionally terminated

### Session Storage

**SQLite Session Store**:

```sql
-- /server/db/sessionSchema.ts
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  expired INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
```

**Session Expiration**:

- Active expiration: 24 hours from last activity
- Passive cleanup: Every 15 minutes via SQLiteStore
- Manual invalidation: On password change or security events

## Security Considerations

### Token Security

**Clerk Tokens**:

- Short-lived access tokens
- Refresh token rotation
- Token revocation on suspicious activity

**CSRF Tokens**:

- Cryptographically secure random tokens
- Session-bound (not reusable across sessions)
- Per-session uniqueness
- Size: 32 bytes (256 bits)

**Session Cookies**:

- `HttpOnly` flag prevents JavaScript access
- `Secure` flag in production (HTTPS only)
- `SameSite=Lax` for CSRF protection
- Custom domain for subdomain support

### Rate Limiting

**Authentication Endpoints**:

```typescript
// /server/auth/rateLimiting.ts
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per window
  message: 'Too many authentication attempts',
  standardHeaders: true,
  legacyHeaders: false
});
```

**API Endpoints**:

```typescript
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 60, // 60 requests per minute
  message: 'Too many API requests',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Security Headers

**Helmet Configuration** (`/server/auth/security.ts`):

```typescript
export function createAppHelmet(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://clerk.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://clerk.com'],
        fontSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"],
        frameSrc: ['https://clerk.com'],
      },
    },
  });
}
```

## Error Handling

### Authentication Errors

**Common Error Scenarios**:

1. **Invalid Clerk Token**: 401 Unauthorized
2. **Expired Session**: 401 Unauthorized with refresh prompt
3. **Missing CSRF Token**: 403 Forbidden
4. **Invalid CSRF Token**: 403 Forbidden
5. **Insufficient Permissions**: 403 Forbidden
6. **Rate Limit Exceeded**: 429 Too Many Requests

**Error Response Format**:

```typescript
{
  "error": {
    "message": "Authentication failed",
    "code": "AUTH_FAILED",
    "requestId": "req_123456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Recovery Flows

**Session Refresh**:

1. Client detects expired session
2. Redirect to Clerk authentication
3. New session established
4. CSRF token regenerated

**CSRF Token Renewal**:

1. Server detects invalid CSRF token
2. Returns 403 with renewal endpoint
3. Client requests new CSRF token
4. Retries original request

## Testing Authentication

### Test Environment Setup

**Mock Clerk Authentication**:

```typescript
// tests/helpers/authHelper.ts
export function mockClerkAuth(userId: string, role: string = 'user') {
  return {
    userId,
    sessionId: `mock_session_${userId}`,
    getToken: () => Promise.resolve('mock_token'),
    publicMetadata: { role },
  };
}
```

**CSRF Token Testing**:

```typescript
// tests/auth/csrf.test.ts
describe('CSRF Protection', () => {
  it('should reject requests without CSRF token', async () => {
    const response = await request(app)
      .post('/api/data')
      .set('Cookie', sessionCookie)
      .send({ data: 'test' });

    expect(response.status).toBe(403);
  });

  it('should accept requests with valid CSRF token', async () => {
    const csrfToken = await getCsrfToken(sessionCookie);

    const response = await request(app)
      .post('/api/data')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ data: 'test' });

    expect(response.status).toBe(200);
  });
});
```

## Source References

- Clerk middleware: `/server/auth/clerkAuth.ts`
- CSRF protection: `/server/auth/csrfProtection.ts`
- Session configuration: `/server/index.ts` (lines 48-72)
- Rate limiting: `/server/auth/rateLimiting.ts`
- Security headers: `/server/auth/security.ts`
- Client auth context: `/client/context/AuthContext.tsx`
- Session database schema: `/server/db/sessionSchema.ts`

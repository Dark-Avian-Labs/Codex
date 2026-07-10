# Server Architecture

## Overview

The Codex server is an **Express.js** application built with **TypeScript 6** and **Node.js 26+**. It implements a comprehensive security stack, per-game database isolation, Clerk authentication integration, and a modular architecture for extensible game support.

## Server Structure

```
server/
├── index.ts                  # Main server entry point
├── config.ts                 # Configuration management
├── auth/                     # Authentication middleware
│   ├── clerkAuth.ts         # Clerk authentication setup
│   ├── csrfProtection.ts    # CSRF protection middleware
│   └── rateLimiting.ts      # Rate limiting configuration
├── db/                       # Database utilities
│   ├── sessionSchema.ts     # Session database schema
│   └── connectionPool.ts    # Database connection management
├── games/                    # Game-specific server logic
│   ├── warframe/            # Warframe API handlers
│   └── epic7/               # Epic Seven API handlers
├── http/                     # HTTP utilities
│   ├── requestId.ts         # Request ID generation
│   └── errorHandler.ts      # Error handling middleware
├── routes/                   # API route definitions
│   ├── api.ts               # Main API router
│   ├── auth.ts              # Authentication routes
│   └── game.ts              # Game-specific routes
├── services/                 # Business logic services
│   ├── warframeSync.ts      # Warframe Armory synchronization
│   └── epic7State.ts        # Epic Seven state management
├── session/                  # Session management
│   └── store.ts             # SQLite session store
└── probes.ts                 # Health check endpoints
```

## Key Architectural Patterns

### 1. Security-First Middleware Stack

The server implements a **defense-in-depth** security approach with multiple layers:

```typescript
// Security middleware order in index.ts
app.use(createAppHelmet());           // Security headers
app.use(requestIdMiddleware);         // Request tracking
app.use(loggerMiddleware);           // Request logging
app.use(cookieParser());             // Cookie parsing
app.use(compression());              // Response compression
app.use(express.json());             // JSON body parsing
app.use(express.urlencoded({ extended: false }));
app.use(session(sessionConfig));     // Session management
app.use(clerkMiddleware());          // Clerk authentication
app.use(csrfProtection());           // CSRF protection
app.use(rateLimiting());             // Rate limiting
```

### 2. Database Connection Management

**Multiple SQLite Databases**:
- **Session Database**: User sessions and CSRF tokens (`session.db`)
- **Warframe Database**: Warframe inventory data
- **Epic Seven Database**: Epic Seven collection data
- **Armory Database**: Read-only sync from Armory service

**Connection Pooling**:
```typescript
// db/connectionPool.ts
export function getSessionDb(): Database {
  return betterSqlite3(SESSION_DB_PATH, { 
    readonly: false, 
    fileMustExist: true 
  });
}

export function getWarframeDb(): Database {
  return betterSqlite3(WARFRAME_DB_PATH, {
    readonly: false,
    fileMustExist: true
  });
}
```

### 3. Modular Game Support

**Game Package Integration**:
- Each game package (`@codex/game-*`) exports database and API handlers
- Server imports game-specific functionality at runtime
- Common patterns for game routing and error handling

**Game Route Registration**:
```typescript
// routes/game.ts
import { warframeRouter } from './games/warframe';
import { epic7Router } from './games/epic7';

const gameRouter = express.Router();
gameRouter.use('/warframe', warframeRouter);
gameRouter.use('/epic7', epic7Router);
```

## Middleware Details

### Helmet Configuration

Custom Helmet configuration with CSP policies:

```typescript
// auth/security.ts
export function createAppHelmet(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://clerk.com"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        frameSrc: ["https://clerk.com"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" }
  });
}
```

### Clerk Authentication

**Multi-Layer Authentication**:
1. **Clerk Middleware**: Verifies Clerk sessions
2. **Express Sessions**: Maintains server-side session state
3. **CSRF Tokens**: Protects against cross-site request forgery
4. **Role Verification**: Checks user roles from Clerk metadata

**Configuration**:
```typescript
// auth/clerkAuth.ts
export const clerkMiddleware = ClerkExpressRequireAuth({
  secretKey: CLERK_SECRET_KEY,
  publishableKey: CLERK_PUBLISHABLE_KEY,
  onError: (error) => {
    log.error('Clerk authentication error:', error);
    throw error;
  }
});
```

### CSRF Protection

**Synchronizer Token Pattern**:
- CSRF tokens stored in user sessions
- Tokens validated on state-changing requests
- Exemptions for safe HTTP methods (GET, HEAD, OPTIONS)

**Implementation**:
```typescript
// auth/csrfProtection.ts
const { csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) => req.csrfToken(),
  getTokenFromState: (req) => req.session.csrfToken,
  storeTokenInState: (req, token) => {
    req.session.csrfToken = token;
  }
});
```

### Rate Limiting

**Per-Route Rate Limits**:
- Authentication endpoints: stricter limits
- API endpoints: moderate limits
- Static assets: higher limits

**Configuration**:
```typescript
// auth/rateLimiting.ts
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 requests per window
  message: 'Too many authentication attempts'
});

export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 60, // 60 requests per minute
  message: 'Too many API requests'
});
```

## Database Architecture

### Session Database Schema

```sql
-- server/db/sessionSchema.ts
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  expired INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
```

### Game Database Validation

**Startup Validation**:
```typescript
// index.ts - ensureGameSchemasReady()
function ensureGameSchemasReady(): void {
  const warframeDb = getWarframeDb();
  const epic7Db = getEpic7Db();
  
  // Validate required tables exist
  assertTableExists(warframeDb, 'worksheets');
  assertTableExists(warframeDb, 'columns');
  assertTableExists(warframeDb, 'rows');
  assertTableExists(warframeDb, 'cell_values');
  
  assertTableExists(epic7Db, 'game_accounts');
  assertTableExists(epic7Db, 'base_heroes');
  assertTableExists(epic7Db, 'base_artifacts');
  assertTableExists(epic7Db, 'account_heroes');
  assertTableExists(epic7Db, 'account_artifacts');
}
```

### Armory Integration

**Read-Only Data Sync**:
- Warframe data synchronized from Armory SQLite database
- Periodic synchronization jobs
- Conflict resolution and data validation
- Cache invalidation strategies

## API Design

### RESTful API Structure

```
/api
├── /auth                    # Authentication endpoints
│   ├── GET /session        # Get current session
│   └── POST /logout        # Logout user
├── /games                   # Game endpoints
│   ├── /warframe           # Warframe-specific endpoints
│   └── /epic7              # Epic Seven-specific endpoints
└── /health                  # Health check endpoints
```

### Request/Response Patterns

**Validation**:
- Zod schemas for all request bodies
- Consistent error response format
- Type-safe request/response types

**Error Handling**:
```typescript
// http/errorHandler.ts
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err instanceof ValidationError ? 400 : 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    error: {
      message,
      requestId: getRequestId(req),
      timestamp: new Date().toISOString()
    }
  });
}
```

## Health Monitoring

### Health Check Endpoints

**`GET /healthz`** - Liveness probe:
- Server process running
- Basic functionality check

**`GET /readyz`** - Readiness probe:
- Database connections healthy
- External service dependencies available
- Game schemas validated

**Implementation**:
```typescript
// probes.ts
export function healthzHandler(req: Request, res: Response): void {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
}

export function readyzHandler(req: Request, res: Response): void {
  const checks = {
    sessionDb: checkDatabaseConnection(getSessionDb()),
    warframeDb: checkDatabaseConnection(getWarframeDb()),
    epic7Db: checkDatabaseConnection(getEpic7Db()),
    clerk: checkClerkConnection()
  };
  
  const allHealthy = Object.values(checks).every(Boolean);
  res.status(allHealthy ? зато : 503).json({ checks });
}
```

## Configuration Management

### Environment Variable Hierarchy

1. **Encrypted Environment Files**: `.env.development`, `.env.production` (via dotenvx)
2. **Plain Environment Files**: `.env` (fallback)
3. **System Environment Variables**: Process-level overrides

### Configuration Validation

```typescript
// config.ts
export const {
  PORT = 3001,
  HOST = '0.0.0.0',
  NODE_ENV = 'development',
  SESSION_SECRET,
  BASE_DOMAIN,
  CLERK_SECRET_KEY,
  CLERK_PUBLISHABLE_KEY,
  SESSION_DB_PATH,
  ARMORY_DB_PATH
} = process.env;

// Validate required variables
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

if (!SESSION_DB_PATH) {
  throw new Error('SESSION_DB_PATH is required');
}
```

## Deployment Considerations

### Containerization
- Multi-stage Docker builds
- Node.js 26+ base image
- SQLite native bindings for better-sqlite3

### Scaling Strategy
- Stateless application servers
- Shared SQLite databases on network storage
- Read replicas for game databases
- Session affinity for CSRF token consistency

### Monitoring
- Structured logging with request IDs
- Health check endpoints
- Performance metrics collection
- Error tracking integration

## Source References

- Main server: `/server/index.ts`
- Configuration: `/server/config.ts`
- Authentication: `/server/auth/`
- Database: `/server/db/`
- Routes: `/server/routes/`
- Health checks: `/server/probes.ts`
- TypeScript config: `/tsconfig.server.json`
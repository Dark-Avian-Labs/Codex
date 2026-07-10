# Environment Configuration

## Overview

Codex uses a comprehensive environment configuration system with support for encrypted environment files via dotenvx. This provides secure handling of sensitive configuration values like database paths, authentication keys, and service credentials.

## Environment File Structure

### File Hierarchy

**Development vs Production**:
```
.env.example          # Template with documentation
.env                  # Plain development (optional)
.env.development      # Encrypted development environment
.env.production       # Encrypted production environment
.env.keys             # Local encryption keys (NEVER commit)
```

**Configuration Priority**:
1. System environment variables (highest priority)
2. `.env` file (if exists)
3. Encrypted `.env.development` or `.env.production` (based on NODE_ENV)
4. Default values in code

### Environment Variables Reference

#### Required Variables

| Variable | Description | Example | Validation |
|----------|-------------|---------|------------|
| `SESSION_SECRET` | Session encryption secret | `supersecretkeywithatleast32chars` | Min 32 chars |
| `SESSION_DB_PATH` | Absolute path to session SQLite | `/var/lib/codex/session.db` | Must exist |
| `ARMORY_DB_PATH` | Absolute path to Armory SQLite | `/var/lib/armory/armory.db` | Must exist |
| `BASE_DOMAIN` | Apex domain for the application | `example.com` | Required |
| `CLERK_SECRET_KEY` | Clerk secret key (production) | `sk_live_...` | Required in prod |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_live_...` | Required |

#### Optional Variables with Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `NODE_ENV` | `development` | Environment mode |
| `APP_ID` | `codex` | Application identifier |
| `APP_SUBDOMAIN` | `APP_ID` | Public host subdomain |
| `TRUST_PROXY` | `0` | Enable behind reverse proxy |
| `SECURE_COOKIES` | `1` in production | Enable secure cookies |
| `BASE_PROTOCOL` | `https` | `http` or `https` |
| `SESSION_COOKIE_NAME` | `codex_session` | Session cookie name |
| `COOKIE_DOMAIN` | Derived from BASE_DOMAIN | Cookie domain |
| `ALLOWED_APP_ORIGINS` | `*` | CORS allowed origins |

#### Game Database Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `WARFRAME_DB_PATH` | `./data/warframe.db` | Warframe database path |
| `EPIC7_DB_PATH` | `./data/epic7.db` | Epic Seven database path |

#### Client Variables (VITE_*)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for client | `pk_test_...` |
| `VITE_APP_NAME` | Application name | `Codex` |
| `VITE_APP_ID` | Application ID | `codex` |
| `VITE_BASE_PATH` | Base URL path | `/` |
| `VITE_API_BASE_URL` | API base URL | `https://codex.example.com/api` |

## dotenvx Encryption System

### Overview

dotenvx provides encrypted environment files for secure configuration management. Encrypted `.env.*` files can be safely committed to version control, while encryption keys remain private.

### Key Management

**Key Storage**:
- `.env.keys`: Local encryption key file (NEVER commit)
- Environment variables: `DOTENV_PRIVATE_KEY_*`
- Secret managers: Vault, AWS Secrets Manager, etc.

**Key Naming Convention**:
```bash
DOTENV_PRIVATE_KEY_DEVELOPMENT    # Development environment key
DOTENV_PRIVATE_KEY_PRODUCTION     # Production environment key
```

### Encryption Workflow

**Initial Setup**:
```bash
# 1. Create plain .env file from template
cp .env.example .env

# 2. Edit with your values
nano .env

# 3. Encrypt for development
pnpm dlx dotenvx encrypt -f .env -o .env.development

# 4. Store the encryption key securely
# .env.keys file is created - NEVER commit this
```

**Development Usage**:
```bash
# Method 1: Using dotenvx run (requires key in .env.keys)
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js

# Method 2: Decrypt to plain .env first
pnpm dotenvx decrypt -f .env.development
NODE_ENV=development node dist/server/index.js
```

**Production Usage**:
```bash
# Key from environment variable
export DOTENV_PRIVATE_KEY_PRODUCTION="your-production-key"
NODE_ENV=production pnpm dotenvx run -f .env.production -- node dist/server/index.js

# Or mount decrypted file in container
```

### Security Considerations

**Key Rotation**:
```bash
# Rotate encryption key
pnpm dlx dotenvx rekey -f .env.development

# Update all environments using the key
# Update secret manager values
# Rotate deployed keys
```

**Multi-Environment Security**:
-## Use separate keys for development and production
- Limit development key access
- Production keys in secure secret manager
- Regular key rotation schedule

## Configuration Management

### Server Configuration (`/server/config.ts`)

**Configuration Loading**:
```typescript
import { config } from '@dotenvx/dotenvx';

// Load environment based on NODE_ENV
config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
  debug: process.env.NODE_ENV === 'development'
});

// Export validated configuration
export const {
  PORT = 3001,
  HOST = '0.0.0.0',
  NODE_ENV = 'development',
  SESSION_SECRET,
  BASE_DOMAIN,
  // ... other variables
} = process.env;

// Validate required variables
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

if (!SESSION_DB_PATH) {
  throw new Error('SESSION_DB_PATH is required');
}
```

**Derived Configuration**:
```typescript
// Calculate derived values
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN 
  ? `.${process.env.COOKIE_DOMAIN.replace(/^\./, '')}`
  : undefined;

export const APP_PUBLIC_BASE_URL = process.env.APP_PUBLIC_BASE_URL 
  || `${BASE_PROTOCOL}://${APP_SUBDOMAIN}.${BASE_DOMAIN}`;

export const SECURE_COOKIES = process.env.SECURE_COOKIES !== '0' 
  && (NODE_ENV === 'production' || process.env.SECURE_COOKIES === '1');
```

### Client Configuration

**Vite Environment Variables**:
```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(
        env.VITE_APP_NAME?.trim() || env.APP_NAME?.trim() || 'Codex'
      ),
      'import.meta.env.VITE_APP_ID': JSON.stringify(
        env.VITE_APP_ID?.trim() || env.APP_ID?.trim() || 'codex'
      ),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    }
  };
});
```

**Client-Side Access**:
```typescript
// Access environment variables in client code
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const appName = import.meta.env.VITE_APP_NAME;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
```

## Deployment Configurations

### Development Configuration

**`.env.development` Example**:
```bash
# Development-specific configuration
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database paths (development)
SESSION_DB_PATH=/tmp/codex_dev/session.db
ARMORY_DB_PATH=/tmp/armory_dev/armory.db
WARFRAME_DB_PATH=./data/warframe.db
EPIC7_DB_PATH=./data/epic7.db

# Clerk (development keys or placeholders)
CLERK_SECRET_KEY=sk_test_placeholder
CLERK_PUBLISHABLE_KEY=pk_test_placeholder
VITE_CLERK_PUBLISHABLE_KEY=pk_test_placeholder

# Security (relaxed for development)
SECURE_COOKIES=0
TRUST_PROXY=0

# Application configuration
BASE_DOMAIN=localhost
BASE_PROTOCOL=http
APP_ID=codex
APP_SUBDOMAIN=codex
APP_PUBLIC_BASE_URL=http://localhost:3001

# Session
SESSION_SECRET=development_session_secret_at_least_32_characters_long
SESSION_COOKIE_NAME=codex_session_dev
```

### Production Configuration

**`.env.production` Example**:
```bash
# Production configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Absolute database paths
SESSION_DB_PATH=/var/lib/codex/session.db
ARMORY_DB_PATH=/var/lib/armory/armory.db
WARFRAME_DB_PATH=/var/lib/codex/warframe.db
EPIC7_DB_PATH=/var/lib/codex/epic7.db

# Real Clerk keys
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Security (strict)
SECURE_COOKIES=1
TRUST_PROXY=1  # Behind reverse proxy

# Application configuration
BASE_DOMAIN=example.com
BASE_PROTOCOL=https
APP_ID=codex
APP_SUBDOMAIN=codex
APP_PUBLIC_BASE_URL=https://codex.example.com

# Session
SESSION_SECRET=production_session_secret_at_least_32_characters_long_and_secure
SESSION_COOKIE_NAME=codex_session
COOKIE_DOMAIN=.example.com

# CORS
ALLOWED_APP_ORIGINS=https://codex.example.com
```

### CI/CD Configuration

**GitHub CI Example** (`/.github/ci.env.development`):
```bash
# CI environment template
NODE_ENV=test
PORT=3001
HOST=0.0.0.0

# Test database paths (in-memory or temp files)
SESSION_DB_PATH=:memory:
ARMORY_DB_PATH=./tests/fixtures/armory_test.db
WARFRAME_DB_PATH=:memory:
EPIC7_DB_PATH=:memory:

# Clerk test keys
CLERK_SECRET_KEY=sk_test_placeholder
CLERK_PUBLISHABLE_KEY=pk_test_placeholder
VITE_CLERK_PUBLISHABLE_KEY=pk_test_placeholder

# Security for tests
SECURE_COOKIES=0
TRUST_PROXY=0

# Test configuration
BASE_DOMAIN=localhost
BASE_PROTOCOL=http
APP_ID=codex_test
APP_SUBDOMAIN=codex
APP_PUBLIC_BASE_URL=http://localhost:3001

# Session for tests
SESSION_SECRET=test_session_secret_at_least_32_characters_long
SESSION_COOKIE_NAME=codex_session_test
```

## Database Path Configuration

### Path Requirements

**Absolute Paths Required**:
- `SESSION_DB_PATH`: Must be absolute
- `ARMORY_DB_PATH`: Must be absolute
- Game database paths: Absolute recommended

**Path Examples**:
```bash
# Linux/macOS
SESSION_DB_PATH=/var/lib/codex/session.db

# Windows
SESSION_DB_PATH=C:\ProgramData\Codex\session.db

# Docker container
SESSION_DB_PATH=/data/session.db
```

### Shared Database Deployment

**Multi-Service Database Sharing**:
```bash
# Armory and Codex sharing database volume
# docker-compose.yml
volumes:
  armory-data:
  
services:
  armory:
    volumes:
      - armory-data:/var/lib/armory
      
  codex:
    volumes:
      - armory-data:/var/lib/armory:ro  # Read-only mount
    environment:
      ARMORY_DB_PATH: /var/lib/armory/armory.db
```

**Permission Considerations**:
```bash
# Set appropriate permissions
chown -R codex:codex /var/lib/codex
chmod 750 /var/lib/codex
chmod 640 /var/lib/codex/*.db
```

## Security Configuration

### Clerk Authentication

**Key Configuration**:
```bash
# Development placeholders (cause 500 errors but allow startup)
CLERK_SECRET_KEY=sk_test_placeholder
CLERK_PUBLISHABLE_KEY=pk_test_placeholder

# Production real keys
CLERK_SECRET_KEY=sk_live_abcdef1234567890
CLERK_PUBLISHABLE_KEY=pk_live_abcdef1234567890
```

**Placeholder Key Issues**:
- Clerk middleware throws 500 on all routes with placeholder keys
- Server starts successfully
- Authentication-dependent endpoints fail
- Expected behavior for local development without real keys

### Session Security

**Secret Requirements**:
```bash
# Minimum 32 characters
SESSION_SECRET=this_is_a_very_long_secret_with_at_least_32_chars

# Generated securely
openssl rand -base64 32
```

**Cookie Configuration**:
```typescript
const sessionConfig = {
  cookie: {
    httpOnly: true,      // Prevent JavaScript access
    secure: SECURE_COOKIES, // HTTPS only in production
    sameSite: 'lax',     // CSRF protection
    domain: COOKIE_DOMAIN,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

## Runtime Validation

### Preflight Checks (`/scripts/runtime-preflight.mjs`)

**Validation Steps**:
1. Node.js version check (>= 26)
2. pnpm version check (>= 11)
3. better-sqlite3 native bindings check
4. Environment variable validation
5. Database path validation

**Usage**:
```bash
# Manual validation
node scripts/runtime-preflight.mjs

# Integrated in validate script
pnpm run validate  # includes preflight
```

### Server Startup Validation

**Configuration Validation** (`/server/config.ts`):
```typescript
// Validate on server import
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

if (!SESSION_DB_PATH) {
  throw new Error('SESSION_DB_PATH is required');
}

if (NODE_ENV === 'production') {
  if (!CLERK_SECRET_KEY || CLERK_SECRET_KEY.includes('placeholder')) {
    throw new Error('Real Clerk keys required in production');
  }
}
```

**Database Validation** (`/server/index.ts`):
```typescript
function ensureGameSchemasReady(): void {
  const warframeDb = getWarframeDb();
  const epic7Db = getEpic7Db();
  
  // Check required tables exist
  assertTableExists(warframeDb, 'worksheets');
  assertTableExists(epic7Db, 'game_accounts');
  // ... other tables
}
```

## Troubleshooting

### Common Configuration Issues

**Database Path Errors**:
```bash
# Error: Database path must be absolute
SESSION_DB_PATH=./data/session.db  # Wrong
SESSION_DB_PATH=$(pwd)/data/session.db  # Correct

# Error: Database file doesn't exist
# Run db:init or create manually
pnpm run db:init
```

**Clerk Authentication Errors**:
```bash
# Error: 500 on all routes with placeholder keys
# Expected behavior - use real keys or accept 500s in dev
# Or skip auth middleware in development
```

**Environment Loading Issues**:
```bash
# dotenvx decrypt fails
# Check .env.keys file exists
# Or use plain .env file instead

# Variables not loading
# Check NODE_ENV matches .env.* file
# Check variable names match case
```

### Debug Commands

**Environment Inspection**:
```bash
# Check loaded environment variables
node -e "console.log(process.env.NODE_ENV)"
node -e "console.log(process.env.SESSION_DB_PATH)"

# Check dotenvx status
pnpm dlx dotenvx status -f .env.development
```

**Configuration Validation**:
```bash
# Run preflight checks
node scripts/runtime-preflight.mjs

# Validate server config
npx tsx server/config.ts
```

## Source References

- Configuration management: `/server/config.ts`
- Environment templates: `/.env.example`, `/.github/ci.env.development`
- Runtime validation: `/scripts/runtime-preflight.mjs`
- Server startup: `/server/index.ts` (lines 60-90)
- Vite configuration: `/vite.config.ts`
- Package scripts: `/package.json` (scripts section)
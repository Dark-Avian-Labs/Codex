# Development Workflow

## Overview

This document outlines the development workflow for Codex, including build processes, testing strategies, code quality checks, and deployment procedures. The project uses modern tooling with pnpm workspaces, Vite, Vitest, and comprehensive quality gates.

## Development Environment Setup

### Prerequisites

**System Requirements**:
- Node.js 26+
- pnpm 11+
- Git
- Code editor with TypeScript support (VS Code recommended)

**Node.js Management**:
```bash
# Using nvm (recommended)
nvm install 26
nvm use 26

# Verify installation
node --version  # Should be >= 26
pnpm --version  # Should be >= 11
```

### Initial Setup

**Clone and Install**:
```bash
# Clone repository
git clone <repository-url>
cd codex

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Build workspace packages
pnpm run build

# Initialize databases
pnpm run db:init
```

**Development with Encrypted Environments**:
```bash
# If using dotenvx encryption
pnpm dotenvx decrypt -f .env.development

# Or create plain .env for development
cp .github/ci.env.development .env.development
```

## Build System

### Build Commands

| Command | Description | Typical Usage |
|---------|-------------|--------------|
| `pnpm run build` | Full build (workspace packages + main app) | Production builds, CI/CD |
| `pnpm --filter @codex/core run build` | Build core package only | Core package development |
| `pnpm run typecheck` | Type check server and client | Pre-commit validation |
| `pnpm run lint` | Run Oxlint | Code quality checks |
| `pnpm run lint:fix` | Run Oxlint with fixes | Automated code fixes |
| `pnpm run format` | Run Oxfmt formatting | Code formatting |
| `pnpm run check-format` | Check formatting without fixing | CI validation |

### Build Process Details

**Full Build Flow** (`pnpm run build`):
```
1. Build workspace packages (@codex/core, @codex/game-warframe, @codex/game-epic7)
2. Type check server and client code
3. Compile server TypeScript to dist/server/
4. Build client with Vite to dist/client/
```

**Workspace Build Order**:
1. `@codex/core` (dependency for game packages)
2. `@codex/game-warframe` and `@codex/game-epic7` (parallel)
3. Main application

### Development Builds

**Fast Development Build**:
```bash
# Build only workspace packages for development
pnpm --filter @codex/core --filter @codex/game-warframe --filter @codex/game-epic7 run --if-present build

# Run type checking
pnpm run typecheck
```

**Client Development Server**:
```bash
# Start Vite dev server (not typically used due to server dependencies)
# Instead, use full build and run server
```

## Testing Strategy

### Test Commands

| Command | Description | Coverage |
|---------|-------------|----------|
| `pnpm run test` | Run all tests once | None |
| `pnpm run test:watch` | Run tests in watch mode | None |
| `pnpm run test:coverage` | Run tests with coverage | HTML report |
| `pnpm run validate` | Full quality check (build + tests) | CI pipeline |

### Test Structure

**Test Organization**:
```
tests/
├── unit/                    # Unit tests
│   ├── client/             # Client unit tests
│   ├── server/             # Server unit tests
│   └── packages/           # Package tests
├── integration/            # Integration tests
│   ├── api/               # API integration tests
│   └── database/          # Database integration tests
├── e2e/                    # End-to-end tests
└── helpers/                # Test utilities
    ├── sqliteTestHarness.ts # SQLite test database setup
    └── authHelper.ts       # Authentication mocking
```

### Test Patterns

**Unit Testing**:
```typescript
// Example unit test
import { describe, it, expect } from 'vitest';
import { calculateTotal } from '@/utils/calculations';

describe('calculations', () => {
  it('should calculate total correctly', () => {
    const items = [{ price: 10 }, { price: 20 }];
    expect(calculateTotal(items)).toBe(30);
  });
});
```

**Integration Testing**:
```typescript
// Example integration test
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '../helpers/serverHelper';
import { createTestDatabase } from '../helpers/sqliteTestHarness';

describe('Warframe API', () => {
  let server: TestServer;
  let db: Database;
  
  beforeAll(async () => {
    db = createTestDatabase(warframeSchema);
    server = await createTestServer({ warframeDb: db });
  });
  
  afterAll(async () => {
    await server.close();
    db.close();
  });
  
  it('should create worksheet', async () => {
    const response = await server.request('/api/warframe/worksheets')
      .auth('test-user')
      .post({ name: 'Test Worksheet' });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Worksheet');
  });
});
```

### Coverage Requirements

**Coverage Thresholds**:
- Statements: 80% minimum
- Branches: 70% minimum  
- Functions: 80% minimum
- Lines:4148 minimum

**Coverage Configuration** (`vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    }
  }
});
```

## Code Quality

### Linting and Formatting

**Oxlint Configuration** (`/.oxfmtrc.json`):
```json
{
  "indent": {
    "character": "space",
    "size": 2,
    "switchCase": 1
  },
  "lineWidth": 100,
  "quoteStyle": "single",
  "semi": true,
  "trailingComma": "es5"
}
```

**Lint Rules**:
- TypeScript strict mode compliance
- React hooks rules
- Import ordering
- Naming conventions
- Security best practices

**Pre-commit Hooks**:
```bash
# Recommended pre-commit script
#!/bin/bash
pnpm run typecheck
pnpm run lint
pnpm run check-format
pnpm run test
```

### Type Checking

**TypeScript Configuration**:
- `strict: true` in all configurations
- Path aliases for clean imports (`@/` for client)
- Separate configs for client/server
- Workspace package type definitions

**Type Checking Commands**:
```bash
# Check client types
tsc -p tsconfig.json --noEmit

# Check server types (includes workspace packages)
tsc -p tsconfig.server.json --noEmit

# Combined type check
pnpm run typecheck  # Runs both above
```

## Development Server

### Running in Development

**Standard Development**:
```bash
# Build everything
pnpm run build

# Start server
pnpm start
```

**Development with Encrypted Env**:
```bash
# Using dotenvx with encrypted .env.development
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js
```

**Development without Encryption**:
```bash
# Using plain .env file
NODE_ENV=development node --env-file=.env dist/server/index.js
```

### Hot Reload Development

**Server Development**:
```bash
# Install nodemon for development
npm install -g nodemon

# Run with nodemon for auto-restart
nodemon --exec "node --env-file=.env dist/server/index.js" --watch dist/server
```

**Client Development**:
```bash
# Vite dev server (limited use due to server dependencies)
pnpm exec vite dev
```

## Debugging

### Debugging Configuration

**VS Code Launch Configuration** (`/.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Codex Server",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "start"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Tips

**Server Debugging**:
```typescript
// Enable debug logging
import { log } from '@codex/core';

// Add debug statements
log.debug('Processing request', { userId: req.auth?.userId });
log.error('Database error', error);

// Environment variable for verbose logging
DEBUG=codex:* pnpm start
```

**Client Debugging**:
- React Developer Tools browser extension
- Vite dev tools for build debugging
- Browser network tab for API requests
- Console logging with source maps

**Database Debugging**:
```bash
# Inspect SQLite databases
sqlite3 data/warframe.db
.tables
.schema worksheets
SELECT * FROM worksheets LIMIT 5;
```

## Git Workflow

### Branch Strategy

**Main Branches**:
- `main`: Production-ready code
- `develop`: Integration branch for features

**Supporting Branches**:
- `feature/*`: New features
- `fix/*`: Bug fixes
- `chore/*`: Maintenance tasks
- `release/*`: Release preparation

### Commit Conventions

**Commit Message Format**:
```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Maintenance tasks
- `build`: Build system changes
- `ci`: CI configuration changes

**Examples**:
```
feat(warframe): add weapon synchronization
fix(auth): resolve session expiration bug
chore(deps): update better-sqlite3 to v12.1.0
```

### Pull Request Process

**PR Requirements**:
1. All tests pass (`pnpm run validate`)
2. Code coverage maintained or improved
3. Type checking passes (`pnpm run typecheck`)
4. Linting passes (`pnpm run lint`)
5. Formatting passes (`pnpm run check-format`)
6. Documentation updated as needed
7. No console.log statements in production code

**PR Template**:
```markdown
## Description
<!-- Describe your changes -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots
<!-- If UI changes, include before/after screenshots -->
```

## CI/CD Pipeline

### GitHub Actions Workflow

**Main Workflows**:
- `/.github/workflows/ci.yml`: Continuous integration
- `/.github/workflows/pr.yml`: Pull request validation
- `/.github/workflows/release.yml`: Release automation

**CI Steps**:
```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4
    
  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '26'
      
  - name: Setup pnpm
    uses: pnpm/action-setup@v4
    with:
      version: '11'
      
  - name: Install dependencies
    run: pnpm install
    
  - name: Run quality checks
    run: pnpm run validate
    
  - name: Run tests with coverage
    run: pnpm run test:coverage
```

### Deployment

**Production Deployment**:
```bash
# Build for production
pnpm run build

# Start production server
pnpm start
```

**Container Deployment**:
```dockerfile
# Dockerfile.example
FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@11 && pnpm install
COPY . .
RUN pnpm run build

FROM node:26-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
EXPOSE 3001
CMD ["node", "dist/server/index.js"]
```

## Performance Monitoring

### Development Performance

**Build Performance**:
```bash
# Measure build time
time pnpm run build

# Analyze bundle size
pnpm exec vite build --mode analyze
```

**Runtime Performance**:
```typescript
// Add performance monitoring
import { performance } from 'perf_hooks';

const start = performance.now();
// ... operation ...
const duration = performance.now() - start;
log.debug(`Operation took ${duration.toFixed(2)}ms`);
```

### Production Monitoring

**Health Checks**:
- `GET /healthz`: Liveness probe
- `GET /readyz`: Readiness probe

**Metrics**:
- Request duration tracking
- Database query performance
- Memory usage monitoring
- Error rate tracking

## Troubleshooting

### Common Issues

**Workspace Build Issues**:
```bash
# Clean and rebuild
rm -rf node_modules packages/*/node_modules packages/*/dist
pnpm install
pnpm run build
```

**SQLite Native Bindings**:
```bash
# Rebuild better-sqlite3
pnpm rebuild better-sqlite3

# On Windows with Cursor agent
# Check .cursor/hooks/prepend-system-node.ps1
```

**Clerk Authentication**:
```bash
# Placeholder keys cause 500 errors
# Use real Clerk keys or skip auth in development
```

**Environment Issues**:
```bash
# Verify environment variables
echo $NODE_ENV
echo $SESSION_DB_PATH

# Use runtime preflight check
node scripts/runtime-preflight.mjs
```

### Getting Help

**Debug Commands**:
```bash
# Run preflight checks
node scripts/runtime-preflight.mjs

# Check Node and pnpm versions
node --version
pnpm --version

# Verify workspace packages built
ls packages/core/dist/
ls packages/games/warframe/dist/
ls packages/games/epic7/dist/
```

**Log Files**:
- Application logs in console
- SQLite database files in `data/`
- Build artifacts in `dist/`
- Test coverage in `coverage/`

## Source References

- Build scripts: `/package.json` (scripts section)
- Quality checks: `/run-quality-checks.mjs`
- Runtime preflight: `/scripts/runtime-preflight.mjs`
- Database init: `/scripts/db-init.mjs`
- Test config: `/vitest.config.ts`
- Vite config: `/vite.config.ts`
- CI workflows: `/.github/workflows/`
- TypeScript configs: `/tsconfig*.json`
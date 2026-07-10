# Codex Quickstart

## What is Codex?

**Codex** is a production-ready, table-based game collection tracker built as a pnpm workspace monorepo. It provides a unified platform for tracking game collections with support for multiple games, currently including:

- **Warframe**: Inventory tracking backed by data synced from Armory
- **Epic Seven**: Collection tracking with manually curated lists

The application features a modern React frontend, Express.js backend with comprehensive security, Clerk authentication, and SQLite database storage with per-game isolation.

## Repository Structure

```
/
├── client/                    # React frontend application
│   ├── app/                  # Feature-based app structure
│   ├── components/           # Reusable UI components
│   ├── context/             # React context providers
│   ├── features/            # Game-specific features
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Client-side libraries
│   └── styles/              # Tailwind CSS and custom styles
├── server/                   # Express.js backend
│   ├── auth/                # Authentication middleware
│   ├── db/                  # Database utilities
│   ├── games/               # Game-specific server logic
│   ├── http/                # HTTP utilities and middleware
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic services
│   └── session/             # Session management
├── packages/                 # Monorepo workspace packages
│   ├── core/                # Shared auth, session, DB, middleware
│   └── games/               # Game-specific implementations
│       ├── warframe/        # Warframe inventory tracking
│       └── epic7/           # Epic Seven collection tracking
├── shared/                  # TypeScript types shared between client/server
├── tests/                   # Test files and helpers
└── scripts/                 # Build and utility scripts
```

## Key Technology Stack

- **Frontend**: React 19, TypeScript 6, Vite 8, Tailwind CSS 4
- **Backend**: Express.js, Node.js 26+, TypeScript 6
- **Authentication**: Clerk (with custom session management)
- **Database**: better-sqlite3 with per-game SQLite databases
- **Build System**: pnpm workspaces, Vite
- **Testing**: Vitest, React Testing Library
- **Security**: Helmet, CSRF protection, rate limiting, environment encryption
- **Code Quality**: Oxlint, Oxfmt, TypeScript strict mode

## Getting Started

### Prerequisites
- Node.js 26+
- pnpm 11+

### Installation & Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your configuration

# Build workspace packages and application
pnpm run build

# Initialize databases
pnpm run db:init

# Start the application
pnpm start
```

For development with encrypted environments:
```bash
# With dotenvx encryption
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js
```

## Key Concepts

### Monorepo Architecture
Codex uses a pnpm workspace monorepo with clear separation between:
- **Core package** (`@codex/core`): Shared authentication, database, middleware, validation
- **Game packages**: Independent implementations for each supported game
- **Main application**: Web server, routing, and UI integration layer

### Authentication Flow
1. **Clerk Integration**: Primary authentication via Clerk.com
2. **Session Management**: Custom Express.js sessions with SQLite storage
3. **CSRF Protection**: Synchronizer token pattern for state-changing operations
4. **Role-Based Access**: Admin/user roles managed through Clerk metadata

### Database Strategy
- **Session Database**: SQLite for user sessions and CSRF tokens
- **Game Databases**: Separate SQLite files for each game's data
- **Armory Integration**: Read-only sync from Armory's SQLite database for Warframe
- **Schema Management**: Automatic table creation and validation on startup

### Security Implementation
- **Defense in Depth**: Multiple layers of security controls
- **Environment Encryption**: dotenvx for encrypted environment variables
- **Secure Headers**: Helmet.js with CSP configuration
- **Request Validation**: Zod schemas for all API inputs
- **Rate Limiting**: Per-route rate limiting to prevent abuse

## Navigating the Documentation

Start here, then explore these key areas:

### Architecture
- [Monorepo Structure](architecture/monorepo-structure.md) - Workspace setup and package relationships
- [Client Architecture](architecture/client-architecture.md) - React app structure and routing
- [Server Architecture](architecture/server-architecture.md) - Express.js setup and middleware

### Workflows
- [Authentication](workflows/authentication.md) - Clerk integration and session management
- [Database Management](workflows/database-management.md) - SQLite setup and game databases
- [Development Workflow](workflows/development-workflow.md) - Build, test, and deployment processes

### Domain Concepts
- [Game Concepts](domain/games-concepts.md) - Game-specific data models and features
- [Collection System](domain/collection-system.md) - Table-based tracking system
- [Armory Integration](domain/armory-integration.md) - Warframe data sync from Armory

### Operations
- [Environment Configuration](operations/environment-configuration.md) - Environment variables and encryption
- [Security Configuration](operations/security-configuration.md) - Security setup and best practices
- [Monitoring & Health](operations/monitoring-health.md) - Health checks, logging, and probes

### Testing
- [Test Strategy](testing/test-strategy.md) - Testing approach and tools
- [Test Helpers](testing/test-helpers.md) - Test utilities and SQLite test harness

## Important Notes for New Contributors

1. **Workspace Packages Must Be Built**: Run `pnpm run build` before tests or development
2. **Absolute Database Paths**: `SESSION_DB_PATH` and `ARMORY_DB_PATH` require absolute paths
3. **Clerk Keys Required**: Production requires real Clerk keys (placeholder keys cause 500 errors)
4. **Environment Encryption**: Supports dotenvx for encrypted `.env.development`/`.env.production`
5. **UI Consistency**: Armory and Codex share design tokens manually (no shared UI package)

## Source References

- Main entry: `/server/index.ts`
- Client entry: `/client/main.tsx`
- Configuration: `/server/config.ts`
- Package workspace: `/pnpm-workspace.yaml`
- Environment template: `/.env.example`

## Version Information
- Current version: 1.55.11
- Last updated: See git history for recent changes
- Maintenance status: Actively maintained with regular releases
# Monorepo Structure

## Overview

Codex is built as a **pnpm workspace monorepo**, which allows for clear separation of concerns while maintaining shared dependencies and tooling. This structure enables independent development of game packages while sharing core infrastructure.

## Workspace Configuration

### Root Configuration Files

- **`/pnpm-workspace.yaml`**: Defines workspace packages

  ```yaml
  packages:
    - 'packages/core'
    - 'packages/games/warframe'
    - 'packages/games/epic7'
  ```

- **Root `package.json`**: Main application dependencies and scripts
  - Workspace references: `@codex/core`, `@codex/game-warframe`, `@codex/game-epic7`
  - Build script builds workspace packages first, then main app
  - Type checking spans workspace packages and main app

### Package Relationships

```
codex (root)
├── @codex/core (shared infrastructure)
├── @codex/game-warframe (depends on core)
├── @codex/game-epic7 (depends on core)
└── main application (depends on all packages)
```

## Package Details

### @codex/core

**Purpose**: Shared authentication, database, middleware, validation, and configuration utilities.

**Key Exports**:

- Authentication: Clerk integration, session management
- Database: SQLite connection management, session store
- Middleware: Security middleware, request validation
- Validation: Zod schemas for API inputs
- Configuration: Environment variable management

**Source Structure**:

```
packages/core/src/
├── auth/           # Authentication utilities
├── db/             # Database connection management
├── middleware/     # Express middleware
├── validation/     # Zod validation schemas
└── index.ts        # Main exports
```

**Dependencies**:

- `@clerk/express`: Clerk authentication
- `better-sqlite3`: SQLite database
- `express`: Web framework
- `zod`: Schema validation

### @codex/game-warframe

**Purpose**: Warframe inventory tracking with Armory data sync.

**Key Features**:

- Worksheet-based inventory system
- Armory database integration (read-only)
- Column and row management for table UI
- Cell value tracking for individual items

**Database Schema**:

- `worksheets`: Top-level inventory categories
- `columns`: Table column definitions
- `rows`: Inventory item rows
- `cell_values`: Individual cell data

**Source Structure**:

```
packages/games/warframe/src/
├── db/             # Database schema and queries
├── sync/           # Armory data synchronization
├── types/          # TypeScript types
└── index.ts        # Main exports
```

### @codex/game-epic7

**Purpose**: Epic Seven collection tracking with manually curated data.

**Key Features**:

- Hero and artifact collection tracking
- Game account management
- Base hero and artifact catalogs
- Account-specific collection state

**Database Schema**:

- `game_accounts`: User game accounts
- `base_heroes`: Hero catalog
- `base_artifacts`: Artifact catalog
- `account_heroes`: User's hero collection
- `account_artifacts`: User's artifact collection

**Source Structure**:

```
packages/games/epic7/src/
├── db/             # Database schema and queries
├── types/          # TypeScript types
└── index.ts        # Main exports
```

## Build System

### Workspace Build Order

1. **Core package** (`@codex/core`): Must be built first as other packages depend on it
2. **Game packages**: Built in parallel (no interdependencies)
3. **Main application**: Built last, depends on all workspace packages

### Build Commands

```bash
# Build all workspace packages
pnpm --filter @codex/core --filter @codex/game-warframe --filter @codex/game-epic7 run --if-present build

# Full build (packages + main app)
pnpm run build

# Type checking across workspace
pnpm run typecheck
```

## Development Workflow

### Adding a New Game Package

1. Create new directory: `packages/games/{game-name}/`
2. Add `package.json` with:
   - `name: "@codex/game-{game-name}"`
   - `dependencies: { "@codex/core": "workspace:*" }`
3. Implement game-specific database schema and APIs
4. Add to workspace in `pnpm-workspace.yaml`
5. Update root `package.json` dependencies
6. Add game routes in `/server/games/`

### Shared Development Patterns

- **TypeScript**: Strict mode enabled across all packages
- **Code Style**: Oxlint and Oxfmt for consistent formatting
- **Testing**: Vitest with workspace-aware test configuration
- **Environment**: Shared configuration via `@codex/core`

## Dependency Management

### Workspace Protocol

Packages use the `workspace:*` protocol for internal dependencies:

```json
{
  "dependencies": {
    "@codex/core": "workspace:*"
  }
}
```

This ensures packages always use the local workspace version rather than published versions.

### External Dependencies

External dependencies are managed at the workspace root level with:

- **Hoisting**: Common dependencies are hoisted to root `node_modules`
- **Version Consistency**: Single version policy for shared dependencies
- **Peer Dependencies**: Properly declared for compatibility

## Source References

- Workspace config: `/pnpm-workspace.yaml`
- Root package: `/package.json`
- Core package: `/packages/core/package.json`
- Warframe package: `/packages/games/warframe/package.json`
- Epic7 package: `/packages/games/epic7/package.json`
- TypeScript configs: `/tsconfig*.json`

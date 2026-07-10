# Database Management

## Overview

Codex uses **SQLite** as its primary data store with a multi-database architecture designed for game collection tracking. The system employs separate SQLite databases for sessions, each game, and external data synchronization (Armory).

## Database Architecture

### Database Layout

```
data/                           # Default data directory (configurable)
├── session.db                  # User sessions and CSRF tokens
├── warframe.db                 # Warframe inventory data
├── epic7.db                    # Epic Seven collection data
└── armory.db                   # Read-only sync from Armory (external)
```

### Database Responsibilities

| Database | Purpose | Read/Write | Managed By |
|----------|---------|------------|------------|
| `session.db` | User sessions, CSRF tokens | Read/Write | Codex |
| `warframe.db` | Warframe inventory, worksheets | Read/Write | Codex |
| `epic7.db` | Epic Seven collections, accounts | Read/Write | Codex |
| `armory.db` | Warframe item catalog | Read-Only | Armory service |

## Database Configuration

### Environment Variables

**Required Database Paths**:
```bash
# Absolute paths required
SESSION_DB_PATH=/absolute/path/to/session.db
ARMORY_DB_PATH=/absolute/path/to/armory.db

# Game database paths (default to ./data/ if not set)
WARFRAME_DB_PATH=/absolute/path/to/warframe.db
EPIC7_DB_PATH=/absolute/path/to/epic7.db
```

**Database Configuration**:
```bash
# SQLite performance tuning
SQLITE_JOURNAL_MODE=WAL          # Write-Ahead Logging
SQLITE_SYNCHRONOUS=NORMAL        # Balance safety vs performance
SQLITE_CACHE_SIZE=-2000          # 2000 pages cache
```

### Connection Management

**Database Connection Factory** (`/packages/core/src/db/connection.ts`):
```typescript
import Database from 'better-sqlite3';

export function createDatabaseConnection(
  path: string,
  options: { readonly?: boolean; fileMustExist?: boolean } = {}
): Database {
  return new Database(path, {
    readonly: options.readonly ?? false,
    fileMustExist: options.fileMustExist ?? true,
    verbose: process.env.NODE_ENV === 'development' 
      ? console.log 
      : undefined
  });
}

// Performance optimizations
export function optimizeDatabase(db: Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -2000');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
}
```

## Database Schemas

### Session Database Schema

```sql
-- /server/db/sessionSchema.ts
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  expired INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expired 
ON sessions(expired);

-- CSRF token tracking (optional)
CREATE TABLE IF NOT EXISTS csrf_tokens (
  session_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, token_hash),
  FOREIGN KEY (session_id) REFERENCES sessions(sid) ON DELETE CASCADE
);
```

### Warframe Database Schema

```sql
-- /packages/games/warframe/src/db/schema.ts
CREATE TABLE IF NOT EXISTS worksheets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY,
  worksheet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (worksheet_id) REFERENCES worksheets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rows (
  id TEXT PRIMARY KEY,
  worksheet_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (worksheet_id) REFERENCES worksheets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cell_values (
  id TEXT PRIMARY KEY,
  worksheet_id TEXT NOT NULL,
  column_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  value TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (worksheet_id) REFERENCES worksheets(id) ON DELETE CASCADE,
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
  FOREIGN KEY (row_id) REFERENCES rows(id) ON DELETE CASCADE,
  UNIQUE(column_id, row_id)
);

-- Indexes for performance
CREATE INDEX idx_cell_values_worksheet ON cell_values(worksheet_id);
CREATE INDEX idx_cell_values_column ON cell_values(column_id);
CREATE INDEX idx_cell_values_row ON cell_values(row_id);
```

### Epic Seven Database Schema

```sql
-- /packages/games/epic7/src/db/schema.ts
CREATE TABLE IF NOT EXISTS game_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  server TEXT NOT NULL,
  account_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, server, account_name)
);

CREATE TABLE IF NOT EXISTS base_heroes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  element TEXT NOT NULL,
  role TEXT NOT NULL,
  zodiac TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS base_artifacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  slot TEXT NOT NULL,
  set_effect TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_heroes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  hero_id TEXT NOT NULL,
  obtained_at INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  level INTEGER NOT NULL,
  awakening TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES game_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (hero_id) REFERENCES base_heroes(id),
  UNIQUE(account_id, hero_id)
);

CREATE TABLE IF NOT EXISTS account_artifacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  obtained_at INTEGER NOT NULL,
  level INTEGER NOT NULL,
  main_stat TEXT,
  substats TEXT, -- JSON array
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES game_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES base_artifacts(id),
  UNIQUE(account_id, artifact_id)
);
```

## Database Initialization

### Initialization Script

**`pnpm run db:init`** (`/scripts/db-init.mjs`):
```javascript
#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function initializeDatabases() {
  console.log('Initializing game databases...');
  
  // Warframe database
  const warframeDb = new Database(join(__dirname, '../data/warframe.db'));
  await applyWarframeSchema(warframeDb);
  
  // Epic Seven database
  const epic7Db = new Database(join(__dirname, '../data/epic7.db'));
  await applyEpic7Schema(epic7Db);
  
  console.log('Database initialization complete');
}

// Import and apply schema from game packages
async function applyWarframeSchema(db) {
  const schema = await import('../packages/games/warframe/dist/db/schema.js');
  schema.initializeDatabase(db);
}

async function applyEpic7Schema(db) {
  const schema = await import('../packages/games/epic7/dist/db/schema.js');
  schema.initializeDatabase(db);
}
```

### Server Startup Validation

**Database Health Checks** (`/server/index.ts`):
```typescript
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

function assertTableExists(db: { prepare: (sql: string) => unknown }, tableName: string): void {
  const row = (
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?") as {
      get: (param: string) => unknown;
    }
  ).get(tableName);
  if (!row) {
    throw new Error(`Required table "${tableName}" was not found.`);
  }
}
```

## Data Migration

### Schema Migration Strategy

**Versioned Migrations**:
```sql
-- Example migration file: migrations/001_add_user_preferences.sql
ALTER TABLE game_accounts 
ADD COLUMN preferences TEXT DEFAULT '{}';

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
```

**Migration Application**:
```typescript
// /scripts/migrate.mjs
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

async function applyMigrations(dbPath: string, migrationsDir: string) {
  const db = new Database(dbPath);
  
  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
  
  // Get applied migrations
  const applied = db.prepare(
    'SELECT version FROM schema_migrations ORDER BY version'
  ).all();
  
  const appliedVersions = new Set(applied.map(m => m.version));
  
  // Find and apply new migrations
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
    
  for (const file of migrationFiles) {
    const version = parseInt(file.split('_')[0]);
    
    if (!appliedVersions.has(version)) {
      const migrationSql = fs.readFileSync(
        path.join(migrationsDir, file), 
        'utf-8'
      );
      
      console.log(`Applying migration: ${file}`);
      db.exec(migrationSql);
      
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
      ).run(version, file, Date.now());
    }
  }
}
```

### Data Migration Utilities

**Backup and Restore**:
```typescript
// /scripts/backup.mjs
export async function backupDatabase(sourcePath: string, backupPath: string) {
  const sourceDb = new Database(sourcePath);
  const backupDb = new Database(backupPath);
  
  // Use SQLite backup API
  sourceDb.backup(backupDb, {
    progress: ({ totalPages, remainingPages }) => {
      const percent = ((totalPages - remainingPages) / totalPages * 100).toFixed(1);
      console.log(`Backup progress: ${percent}%`);
    }
  });
  
  console.log(`Backup completed: ${backupPath}`);
}
```

## Performance Optimization

### Indexing Strategy

**Warframe Database Indexes**:
```sql
-- Frequently queried columns
CREATE INDEX idx_worksheets_user ON worksheets(user_id);
CREATE INDEX idx_columns_worksheet ON columns(worksheet_id);
CREATE INDEX idx_rows_worksheet ON rows(worksheet_id);

-- Composite indexes for common queries
CREATE INDEX idx_cell_values_lookup ON cell_values(worksheet_id, column_id, row_id);
```

**Epic Seven Database Indexes**:
```sql
-- Account-based queries
CREATE INDEX idx_account_heroes_account ON account_heroes(account_id);
CREATE INDEX idx_account_artifacts_account ON account_artifacts(account_id);

-- Hero/artifact lookup
CREATE INDEX idx_account_heroes_hero ON account_heroes(hero_id);
CREATE INDEX idx_account_artifacts_artifact ON account_artifacts(artifact_id);
```

### Query Optimization

**Prepared Statements**:
```typescript
// Use prepared statements for frequent queries
const getWorksheetStmt = db.prepare(`
  SELECT * FROM worksheets 
  WHERE id = ? AND user_id = ?
`);

const insertCellValueStmt = db.prepare(`
  INSERT OR REPLACE INTO cell_values 
  (id, worksheet_id, column_id, row_id, value, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Batch operations for better performance
const insertManyCells = db.transaction((cells: CellValue[]) => {
  for (const cell of cells) {
    insertCellValueStmt.run(
      cell.id,
      cell.worksheet_id,
      cell.column_id,
      cell.row_id,
      cell.value,
      Date.now(),
      Date.now()
    );
  }
});
```

### Connection Pooling

**Database Connection Management**:
```typescript
// /packages/core/src/db/connectionPool.ts
const connectionPool = new Map<string, Database>();

export function getDatabaseConnection(
  path: string, 
  options: ConnectionOptions = {}
): Database {
  const key = `${path}:${JSON.stringify(options)}`;
  
  if (!connectionPool.has(key)) {
    const db = createDatabaseConnection(path, options);
    optimizeDatabase(db);
    connectionPool.set(key, db);
    
    // Clean up on process exit
    process.on('exit', () => {
      db.close();
      connectionPool.delete(key);
    });
  }
  
  return connectionPool.get(key)!;
}
```

## Testing Database Interactions

### Test Database Setup

**SQLite Test Harness** (`/tests/helpers/sqliteTestHarness.ts`):
```typescript
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

export function createTestDatabase(schemaSql: string): {
  db: Database;
  cleanup: () => void;
} {
  const testDbPath = join(
    tmpdir(), 
    `test_db_${Date.now()}_${Math.random().toString(36).substring(2)}.db`
  );
  
  const db = new Database(testDbPath);
  db.exec(schemaSql);
  
  const cleanup = () => {
    db.close();
    try {
      unlinkSync(testDbPath);
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  };
  
  return { db, cleanup };
}
```

### Database Test Patterns

**Isolated Test Databases**:
```typescript
// tests/warframe/db.test.ts
describe('Warframe Database', () => {
  let db: Database;
  let cleanup: () => void;
  
  beforeEach(() => {
    const { db: testDb, cleanup: testCleanup } = createTestDatabase(`
      CREATE TABLE worksheets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_id TEXT NOT NULL
      );
      
      CREATE TABLE columns (
        id TEXT PRIMARY KEY,
        worksheet_id TEXT NOT NULL,
        name TEXT NOT NULL
      );
    `);
    
    db = testDb;
    cleanup = testCleanup;
  });
  
  afterEach(() => {
    cleanup();
  });
  
  test('should create worksheet', () => {
    db.prepare(
      'INSERT INTO worksheets (id, name, user_id) VALUES (?, ?, ?)'
    ).run('test-id', 'Test Worksheet', 'user-123');
    
    const worksheet = db.prepare(
      'SELECT * FROM worksheets WHERE id = ?'
    ).get('test-id');
    
    expect(worksheet.name).toBe('Test Worksheet');
  });
});
```

## Deployment Considerations

### Database Path Configuration

**Production Deployment**:
```bash
# Use absolute paths in production
SESSION_DB_PATH=/var/lib/codex/session.db
ARMORY_DB_PATH=/var/lib/armory/armory.db
WARFRAME_DB_PATH=/var/lib/codex/warframe.db
EPIC7_DB_PATH=/var/lib/codex/epic7.db
```

**Container Deployment**:
```dockerfile
# Dockerfile
VOLUME /data
ENV SESSION_DB_PATH=/data/session.db
ENV WARFRAME_DB_PATH=/data/warframe.db
ENV EPIC7_DB_PATH=/data/epic7.db

# Mount Armory database as read-only
VOLUME /armory-data
ENV ARMORY_DB_PATH=/armory-data/armory.db
```

### Backup Strategy

**Automated Backups**:
```bash
# cron job for daily backups
0 2 * * * /usr/bin/node /path/to/codex/scripts/backup.mjs
```

**Backup Rotation**:
- Daily backups kept for 7 days
- Weekly backups kept for 4 weeks
- Monthly backups kept for 12 months

## Source References

- Database initialization: `/scripts/db-init.mjs`
- Session schema: `/server/db/sessionSchema.ts`
- Warframe schema: `/packages/games/warframe/src/db/schema.ts`
- Epic7 schema: `/packages/games/epic7/src/db/schema.ts`
- Connection management: `/packages/core/src/db/connection.ts`
- Server validation: `/server/index.ts` (lines 73-87)
- Test harness: `/tests/helpers/sqliteTestHarness.ts`
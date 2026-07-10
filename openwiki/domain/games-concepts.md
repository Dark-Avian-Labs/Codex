# Game Concepts

## Overview

Codex supports multiple games through a modular architecture. Each game has its own package with game-specific data models, business logic, and UI components. This document describes the concepts and implementations for currently supported games.

## Supported Games

### Warframe
**Type**: Inventory tracking system  
**Data Source**: Armory SQLite database sync  
**Primary Use**: Weapon, frame, and item inventory management  
**Key Feature**: Worksheet-based table organization

### Epic Seven
**Type**: Collection tracker  
**Data Source**: Manually curated lists  
**Primary Use**: Hero and artifact collection tracking  
**Key Feature**: Account-based progression tracking

## Warframe Implementation

### Core Concepts

**Worksheets**: Top-level containers for organizing inventory data
- Each worksheet represents a logical grouping (e.g., "Primary Weapons", "Frames")
- Contains columns, rows, and cell values
- User-defined organization structure

**Columns**: Define the structure of data within a worksheet
- Each column has a name and data type (text, number, boolean, etc.)
- Columns define the "schema" for rows in the worksheet
- Order determines display order in UI

**Rows**: Individual inventory items
- Each row represents a single item (weapon, frame, etc.)
- Contains metadata and order information
- Linked to Armory catalog entries

**Cell Values**: Specific data points for items
- Value for a specific column in a specific row
- Can be text, numbers, booleans, or references
- Supports tracking of item states (owned, mastered, etc.)

### Data Model

```typescript
// /packages/games/warframe/src/types.ts
interface Worksheet {
  id: string;
  name: string;
  description?: string;
  created_at: number;
  updated_at: number;
  user_id: string;
}

interface Column {
  id: string;
  worksheet_id: string;
  name: string;
  data_type: 'text' | 'number' | 'boolean' | 'date' | 'reference';
  order_index: number;
  created_at: number;
}

interface Row {
  id: string;
  worksheet_id: string;
  order_index: number;
  created_at: number;
  updated_at: number;
}

interface CellValue {
  id: string;
  worksheet_id: string;
  column_id: string;
  row_id: string;
  value: string | number | boolean | null;
  created_at: number;
  updated_at: number;
}
```

### Armory Integration

**Data Sync Flow**:
```
Armory Database → Codex Warframe Database → UI Display
     (read-only)         (read/write)      (user interface)
```

**Sync Process**:
1. Periodic synchronization from Armory SQLite database
2. Catalog updates (new weapons, frames, items)
3. Worksheet template updates
4. Conflict resolution for user-modified data

**Sync State Management** (`/server/services/warframeSyncState.ts`):
```typescript
interface SyncState {
  lastSyncTime: number;
  syncInProgress: boolean;
  itemsSynced: number;
  errors: SyncError[];
}

export async function waitForWarframeSyncIdle(): Promise<void> {
  // Wait for any ongoing sync to complete
  while (syncState.syncInProgress) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Inventory Management Features

**Bulk Operations**:
- Select multiple items across worksheets
- Bulk status updates (e.g., mark all as "owned")
- Export/import inventory data
- Template application to multiple items

**Search and Filter**:
- Full-text search across inventory
- Column-specific filtering
- Saved filter presets
- Cross-worksheet searching

**Progression Tracking**:
- Mastery rank tracking
- Item completion status
- Crafting requirements
- Resource farming tracking

## Epic Seven Implementation

### Core Concepts

**Game Accounts**: User's Epic Seven game accounts
- Multiple accounts per user (different servers)
- Account-specific progression tracking
- Server-specific data (Global, Asia, etc.)

**Base Catalog**: Reference data for heroes and artifacts
- Static list of all heroes and artifacts
- Metadata: rarity, element, role, zodiac
- Curated manually (not synced from external source)

**Account Collections**: User-owned heroes and artifacts
- Tracks which heroes/artifacts user has obtained
- Progression data: stars, level, awakening
- Notes and custom metadata

### Data Model

```typescript
// /packages/games/epic7/src/types.ts
interface GameAccount {
  id: string;
  user_id: string;
  server: 'global' | 'asia' | 'europe' | 'korea';
  account_name: string;
  created_at: number;
  updated_at: number;
}

interface BaseHero {
  id: string;
  name: string;
  rarity: '3' | '4' | '5';
  element: 'fire' | 'ice' | 'earth' | 'wind' | 'light' | 'dark';
  role: 'warrior' | 'knight' | 'ranger' | 'mage' | 'soul-weaver' | 'assassin';
  zodiac?: string;
  created_at: number;
}

interface BaseArtifact {
  id: string;
  name: string;
  rarity: '3' | '4' | '5';
  slot: 'weapon' | 'helm' | 'armor' | 'necklace' | 'ring' | 'boots';
  set_effect?: string;
  created_at: number;
}

interface AccountHero {
  id: string;
  account_id: string;
  hero_id: string;
  obtained_at: number;
  stars: 1 | 2 | 3 | 4 | 5 | 6;
  level: number;
  awakening?: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'SS';
  notes?: string;
  created_at: number;
  updated_at: number;
}

interface AccountArtifact {
  id: string;
  account_id: string;
  artifact_id: string;
  obtained_at: number;
  level: number;
  main_stat?: string;
  substats?: string[]; // JSON array
  notes?: string;
  created_at: number;
  updated_at: number;
}
```

### Collection Management Features

**Hero Progression**:
- Star promotion tracking (3★ → 4★ → 5★ → 6★)
- Level tracking (1-60)
- Awakening progression (S1-S6, SS)
- Skill enhancement tracking

**Artifact Management**:
- Level tracking (1-85)
- Main stat and substat recording
- Set completion tracking
- Enhancement level tracking

**Collection Analysis**:
- Completion percentage by rarity
- Element distribution
- Role balance
- Missing heroes/artifacts

### Account Management

**Multiple Account Support**:
```typescript
// User can have accounts on different servers
const accounts = [
  { server: 'global', account_name: 'Player1' },
  { server: 'asia', account_name: 'PlayerAsia' },
  { server: 'europe', account_name: 'PlayerEU' }
];
```

**Account Switching**:
- Seamless switching between accounts
- Shared base catalog across accounts
- Account-specific collection data
- Cross-account statistics

## Common Patterns

### Game Package Structure

Each game package follows a consistent structure:

```
packages/games/{game-name}/
├── src/
│   ├── db/                    # Database schema and queries
│   │   ├── schema.ts          # SQL table definitions
│   │   ├── queries.ts         # Prepared statements
│   │   └── migrations/        # Schema migrations
│   ├── types/                 # TypeScript type definitions
│   ├── api/                   # API handlers
│   ├── sync/                  # External data synchronization
│   └── index.ts               # Package exports
├── dist/                      # Compiled output
└── package.json               # Package configuration
```

### Database Initialization

**Schema Validation**:
```typescript
// Each game package exports initialization function
export function initializeDatabase(db: Database): void {
  db.exec(schemaSql);
  createIndexes(db);
  seedReferenceData(db);
}
```

**Reference Data Seeding**:
```typescript
// Epic Seven base hero seeding
export function seedReferenceData(db: Database): void {
  const heroes: BaseHero[] = [
    {
      id: 'hero-1',
      name: 'Arbiter Vildred',
      rarity: '5',
      element: 'dark',
      role: 'warrior',
      created_at: Date.now()
    },
    // ... more heroes
  ];
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO base_heroes 
    (id, name, rarity, element, role, zodiac, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const hero of heroes) {
    stmt.run(
      hero.id,
      hero.name,
      hero.rarity,
      hero.element,
      hero.role,
      hero.zodiac,
      hero.created_at
    );
  }
}
```

### API Integration

**Game-Specific Routes**:
```typescript
// /server/games/warframe/routes.ts
import { Router } from 'express';
import { 
  getWorksheets, 
  createWorksheet,
  updateWorksheet,
  deleteWorksheet 
} from '@codex/game-warframe';

const router = Router();

router.get('/worksheets', getWorksheets);
router.post('/worksheets', createWorksheet);
router.put('/worksheets/:id', updateWorksheet);
router.delete('/worksheets/:id', deleteWorksheet);

export default router;
```

**Middleware Integration**:
```typescript
// Game-specific middleware
import { requireWarframeAccess } from './middleware';

router.use('/warframe/*', requireWarframeAccess);
```

## Adding New Games

### Requirements for New Game Support

1. **Data Model Design**:
   - Define game-specific entities
   - Design database schema
   - Create TypeScript types

2. **Package Implementation**:
   - Create `packages/games/{game-name}/`
   - Implement database schema and queries
   - Create API handlers
   - Add data synchronization if needed

3. **Server Integration**:
   - Add game routes to server
   - Configure database connections
   - Add game-specific middleware

4. **Client Integration**:
   - Create feature directory `features/{game-name}/`
   - Implement UI components
   - Add to navigation and routing
   - Create game context if needed

### Example: Adding "Game X"

**Step 1 - Create Package**:
```bash
mkdir -p packages/games/gamex
cd packages/games/gamex
pnpm init
# Update package.json with @codex/game-gamex name
# Add dependency on @codex/core
```

**Step 2 - Implement Schema**:
```typescript
// packages/games/gamex/src/db/schema.ts
export const schemaSql = `
CREATE TABLE gamex_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT,
  -- game-specific columns
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
```

**Step 3 - Add to Workspace**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/core'
  - 'packages/games/warframe'
  - 'packages/games/epic7'
  - 'packages/games/gamex'  # Add new game
```

**Step 4 - Update Root Package**:
```json
{
  "dependencies": {
    "@codex/core": "workspace:*",
    "@codex/game-warframe": "workspace:*",
    "@codex/game-epic7": "workspace:*",
    "@codex/game-gamex": "workspace:*"  // Add new game
  }
}
```

**Step 5 - Add Server Routes**:
```typescript
// server/games/gamex/routes.ts
import { Router } from 'express';
import { getItems, createItem } from '@codex/game-gamex';

const router = Router();
router.get('/items', getItems);
router.post('/items', createItem);
export default router;

// Add to main router
import gamexRouter from './games/gamex/routes';
app.use('/api/gamex', gamexRouter);
```

**Step 6 - Add Client Features**:
```typescript
// client/features/gamex/GamexInventory.tsx
export default function GamexInventory() {
  return <div>Game X Inventory</div>;
}

// Add to routing
// client/app/gamex/page.tsx
```

## Game-Specific Business Logic

### Warframe Business Rules

**Inventory Validation**:
- Weapon mastery tracking requires specific data points
- Frame components must be tracked for crafting
- Resource requirements validation
- Trade eligibility rules

**Sync Rules**:
- Read-only access to Armory data
- User modifications preserved during sync
- Conflict resolution precedence
- Sync frequency limits

### Epic Seven Business Rules

**Hero Progression Rules**:
- Star promotion path: 3★ → 4★ → 5★ → 6★
- Level cap by stars: 30 (3★), 40 (4★), 50 (5★), 60 (6★)
- Awakening material requirements
- Skill enhancement costs

**Artifact Rules**:
- Level cap: 85 for 5★ artifacts
- Main stat types by slot
- Substats generation rules
- Enhancement cost scaling

## Source References

- Warframe package: `/packages/games/warframe/`
- Epic Seven package: `/packages/games/epic7/`
- Game routes: `/server/games/`
- Warframe types: `/packages/games/warframe/src/types.ts`
- Epic Seven types: `/packages/games/epic7/src/types.ts`
- Sync state management: `/server/services/warframeSyncState.ts`
- Database schemas: `/packages/games/*/src/db/schema.ts`
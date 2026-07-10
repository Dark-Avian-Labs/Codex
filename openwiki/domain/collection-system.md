# Collection System

## Overview

Codex implements a **flexible, table-based collection tracking system** that powers both Warframe inventory management and Epic Seven collection tracking. The system is designed to be extensible for different game types while maintaining consistent patterns for data organization, user interaction, and progress tracking.

## Core Collection Concepts

### Table-Based Organization

**Worksheets as Containers**:

- Top-level organizational units
- User-defined categorization (e.g., "Primary Weapons", "5★ Heroes")
- Contain columns (structure) and rows (items)
- Support hierarchical organization

**Columns Define Structure**:

```typescript
interface ColumnDefinition {
  id: string;
  name: string;
  data_type: 'text' | 'number' | 'boolean' | 'date' | 'reference';
  order_index: number;
  // Game-specific metadata
  metadata?: Record<string, any>;
}
```

**Rows as Collection Items**:

```typescript
interface CollectionItem {
  id: string;
  // Reference to external catalog (Armory, base heroes)
  reference_id?: string;
  // User-defined metadata
  metadata: Record<string, any>;
  // Collection state
  state: 'unowned' | 'owned' | 'mastered' | 'completed';
  // Progression tracking
  progression?: ProgressionData;
}
```

### Collection State Machine

**Item States**:

```
Unowned → Owned → Mastered → Completed
    ↑         ↑         ↑
    └─────────┴─────────┴─── User progression
```

**State Transitions**:

- `unowned`: Item not in collection
- `owned`: Item obtained but not fully progressed
- `mastered`: Item fully leveled/ranked (game-specific)
- `completed`: All possible progression achieved

### Progression Tracking

**Multi-dimensional Progression**:

```typescript
interface ProgressionData {
  // Level-based progression
  level?: {
    current: number;
    max: number;
    percentage: number;
  };

  // Rank/star progression
  rank?: {
    current: number;
    max: number;
    promotions: PromotionRecord[];
  };

  // Enhancement progression
  enhancements?: {
    count: number;
    max: number;
    materials: MaterialRequirement[];
  };

  // Custom game-specific progression
  custom?: Record<string, any>;
}
```

## Warframe Collection System

### Inventory Organization

**Worksheet Hierarchy**:

```
Warframe Inventory/
├── Primary Weapons/
│   ├── Assault Rifles
│   ├── Shotguns
│   └── Sniper Rifles
├── Warframes/
│   ├️── Starter Frames
│   └── Prime Frames
├── Companions/
│   ├── Sentinels
│   └── Pets
└── Resources/
    ├── Common
    └── Rare
```

**Column Templates**:

```typescript
const weaponColumns: ColumnDefinition[] = [
  { name: 'Weapon Name', data_type: 'text', order: 0 },
  { name: 'Mastery Rank', data_type: 'number', order: 1 },
  { name: 'Owned', data_type: 'boolean', order: 2 },
  { name: 'Mastered', data_type: 'boolean', order: 3 },
  { name: 'Forma Used', data_type: 'number', order: 4 },
  { name: 'Catalyst Installed', data_type: 'boolean', order: 5 },
  { name: 'Riven Mod', data_type: 'boolean', order: 6 },
  { name: 'Notes', data_type: 'text', order: 7 },
];
```

### Mastery Tracking

**Mastery Rank Calculation**:

```typescript
function calculateMasteryProgress(inventory: WarframeItem[]): {
  totalMastery: number;
  earnedMastery: number;
  progressPercentage: number;
  nextRankThreshold: number;
} {
  const totalMastery = inventory.reduce((sum, item) => sum + (item.masteryValue || 0), 0);

  const earnedMastery = inventory
    .filter((item) => item.mastered)
    .reduce((sum, item) => sum + (item.masteryValue || 0), 0);

  return {
    totalMastery,
    earnedMastery,
    progressPercentage: (earnedMastery / totalMastery) * 100,
    nextRankThreshold: getNextRankThreshold(earnedMastery),
  };
}
```

### Resource Tracking

**Crafting Components**:

```typescript
interface CraftingComponent {
  itemId: string;
  name: string;
  quantityRequired: number;
  quantityOwned: number;
  source: 'drops' | 'market' | 'trading';
  farmingLocation?: string;
  dropRate?: number;
}

function getCraftingRequirements(item: WarframeItem): CraftingComponent[] {
  // Query Armory database for component requirements
  // Check user inventory for owned quantities
  // Calculate missing components
}
```

## Epic Seven Collection System

### Hero Collection

**Collection Organization**:

```
Epic Seven Collection/
├── By Rarity/
│   ├── 5★ Heroes (Natural)
│   ├── 5★ Heroes (Moonlight)
│   ├── 4★ Heroes
│   └── 3★ Heroes
├── By Element/
│   ├── Fire
│   ├── Ice
│   ├── Earth
│   └── Wind
├── By Role/
│   ├── Warriors
│   ├── Knights
│   ├── Rangers
│   └── Mages
└── Special/
    ├── Limited Heroes
    └── Collaboration Heroes
```

**Hero Progression Tracking**:

```typescript
interface HeroProgression {
  // Basic info
  heroId: string;
  accountId: string;

  // Star progression
  stars: {
    current: 1 | 2 | 3 | 4 | 5 | 6;
    natural: 3 | 4 | 5; // Base rarity
    promotions: {
      from: number;
      to: number;
      date: number;
      materialsUsed: MaterialUsage[];
    }[];
  };

  // Level progression
  level: {
    current: number;
    max: number; // Based on stars: 30(3★), 40(4★), 50(5★), 60(6★)
    experience: number;
  };

  // Awakening progression
  awakening: {
    stage: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'SS';
    materials: AwakeningMaterial[];
    completed: boolean;
  };

  // Skill enhancements
  skills: {
    s1: { level: number; max: number };
    s2: { level: number; max: number };
    s3: { level: number; max: number };
    imprint: { level: number; max: number };
  };

  // Equipment
  equipment: {
    weapon?: ArtifactReference;
    helmet?: ArtifactReference;
    armor?: ArtifactReference;
    necklace?: ArtifactReference;
    ring?: ArtifactReference;
    boots?: ArtifactReference;
  };
}
```

### Collection Completion Metrics

**Completion Calculations**:

```typescript
function calculateCollectionCompletion(
  account: GameAccount,
  heroes: AccountHero[],
): CollectionMetrics {
  const totalHeroes = getTotalHeroCount();
  const ownedHeroes = heroes.length;

  // By rarity
  const byRarity = {
    '5★': calculateCompletionForRarity('5', heroes),
    '4★': calculateCompletionForRarity('4', heroes),
    '3★': calculateCompletionForRarity('3', heroes),
  };

  // By element
  const byElement = {
    fire: calculateCompletionForElement('fire', heroes),
    ice: calculateCompletionForElement('ice', heroes),
    earth: calculateCompletionForElement('earth', heroes),
    wind: calculateCompletionForElement('wind', heroes),
    light: calculateCompletionForElement('light', heroes),
    dark: calculateCompletionForElement('dark', heroes),
  };

  return {
    overall: (ownedHeroes / totalHeroes) * 100,
    byRarity,
    byElement,
    sixStarCount: heroes.filter((h) => h.stars === 6).length,
    fullyAwakenedCount: heroes.filter((h) => h.awakening === 'SS').length,
  };
}
```

## Collection Operations

### Bulk Operations

**Mass Updates**:

```typescript
// Update multiple items at once
async function bulkUpdateItems(
  itemIds: string[],
  updates: Partial<CollectionItem>,
): Promise<BulkUpdateResult> {
  const db = getGameDatabase();
  const transaction = db.transaction(() => {
    const results: BulkUpdateResultItem[] = [];

    for (const itemId of itemIds) {
      try {
        const updated = updateItem(itemId, updates);
        results.push({ itemId, success: true, updated });
      } catch (error) {
        results.push({ itemId, success: false, error: error.message });
      }
    }

    return results;
  });

  return transaction();
}
```

**Template Application**:

```typescript
// Apply template to multiple items
function applyTemplateToItems(itemIds: string[], template: CollectionTemplate): void {
  const updates = templateToUpdates(template);
  bulkUpdateItems(itemIds, updates);
}

interface CollectionTemplate {
  name: string;
  columnUpdates: Record<string, any>;
  stateUpdates?: Partial<CollectionItem>;
  metadataUpdates?: Record<string, any>;
}
```

### Search and Filter System

**Advanced Filtering**:

```typescript
interface CollectionFilter {
  // State filters
  states?: ItemState[];

  // Progression filters
  minLevel?: number;
  maxLevel?: number;
  minStars?: number;
  maxStars?: number;
  awakeningStage?: AwakeningStage[];

  // Metadata filters
  metadata?: Record<string, any>;

  // Text search
  searchText?: string;
  searchFields?: string[];

  // Date filters
  obtainedAfter?: number;
  obtainedBefore?: number;

  // Pagination
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function filterCollection(items: CollectionItem[], filter: CollectionFilter): CollectionItem[] {
  return items.filter((item) => {
    // Apply all filter conditions
    if (filter.states && !filter.states.includes(item.state)) {
      return false;
    }

    if (filter.searchText) {
      const searchableText = getSearchableText(item);
      if (!searchableText.includes(filter.searchText.toLowerCase())) {
        return false;
      }
    }

    // ... other filter conditions

    return true;
  });
}
```

### Import/Export System

**Export Formats**:

```typescript
interface ExportOptions {
  format: 'json' | 'csv' | 'excel';
  includeMetadata: boolean;
  includeProgression: boolean;
  includeReferences: boolean;
  compress: boolean;
}

async function exportCollection(
  collection: CollectionItem[],
  options: ExportOptions,
): Promise<ExportResult> {
  switch (options.format) {
    case 'json':
      return exportAsJson(collection, options);
    case 'csv':
      return exportAsCsv(collection, options);
    case 'excel':
      return exportAsExcel(collection, options);
  }
}
```

**Import Validation**:

```typescript
interface ImportValidationResult {
  valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  stats: {
    totalItems: number;
    validItems: number;
    newItems: number;
    updatedItems: number;
    skippedItems: number;
  };
}

async function validateImport(data: any, format: ImportFormat): Promise<ImportValidationResult> {
  // Validate data structure
  // Check required fields
  // Validate references exist
  // Check for duplicates
  // Return validation results
}
```

## Data Relationships

### Cross-Collection References

**Item References**:

```typescript
// Reference from collection item to catalog item
interface CatalogReference {
  catalog: 'warframe' | 'epic7' | 'generic';
  itemId: string;
  version?: string; // For versioned catalogs
}

// Example: Warframe item referencing Armory catalog
const weaponReference: CatalogReference = {
  catalog: 'warframe',
  itemId: 'weapon_primary_boltor',
  version: 'armory_v2.5',
};
```

**Collection Relationships**:

```typescript
// Relationships between collection items
interface CollectionRelationship {
  sourceId: string;
  targetId: string;
  type: 'component' | 'upgrade' | 'prerequisite' | 'alternative';
  metadata?: {
    quantity?: number;
    order?: number;
    requirementType?: 'mandatory' | 'optional';
  };
}

// Example: Warframe requires components
const craftingRelationship: CollectionRelationship = {
  sourceId: 'warframe_rhino',
  targetId: 'resource_neural_sensors',
  type: 'component',
  metadata: { quantity: 1, requirementType: 'mandatory' },
};
```

### Derived Collections

**Smart Collections**:

```typescript
// Dynamically generated collections based on rules
interface SmartCollectionRule {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}

interface SmartCollection {
  id: string;
  name: string;
  description?: string;
  rules: SmartCollectionRule[];
  autoUpdate: boolean;
  itemCount: number;
}

// Example: "Weapons Needing Forma"
const formaNeededCollection: SmartCollection = {
  id: 'smart_forma_needed',
  name: 'Weapons Needing Forma',
  rules: [
    { field: 'formaUsed', operator: 'lessThan', value: 3 },
    { field: 'mastered', operator: 'equals', value: false },
  ],
  autoUpdate: true,
  itemCount: 0, // Calculated dynamically
};
```

**Collection Views**:

```typescript
// Different ways to view the same collection
interface CollectionView {
  id: string;
  collectionId: string;
  name: string;
  type: 'grid' | 'list' | 'table' | 'chart';
  columns: string[]; // Which columns to show
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: CollectionFilter[];
  grouping?: {
    field: string;
    collapsed?: boolean;
  };
}
```

## Performance Optimization

### Collection Indexing

**Database Indexes**:

```sql
-- Indexes for common collection queries
CREATE INDEX idx_collection_items_user ON collection_items(user_id);
CREATE INDEX idx_collection_items_state ON collection_items(state);
CREATE INDEX idx_collection_items_reference ON collection_items(reference_id);
CREATE INDEX idx_collection_items_updated ON collection_items(updated_at);

-- Composite indexes for specific queries
CREATE INDEX idx_collection_search ON collection_items(
  user_id,
  state,
  updated_at
);
```

### Caching Strategy

**Collection Cache**:

```typescript
interface CollectionCache {
  // Cache user's collection data
  userCollections: Map<string, CachedCollection>;

  // Cache collection metadata
  collectionMetadata: Map<string, CollectionMetadata>;

  // Cache filter results
  filterResults: Map<string, FilterCache>;
}

class CollectionCacheManager {
  getCachedCollection(userId: string): CachedCollection | null {
    const key = `collection:${userId}`;
    return this.userCollections.get(key);
  }

  setCachedCollection(userId: string, collection: CachedCollection): void {
    const key = `collection:${userId}`;
    this.userCollections.set(key, collection);

    // Set expiration
    setTimeout(
      () => {
        this.userCollections.delete(key);
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }
}
```

### Pagination and Lazy Loading

**Incremental Loading**:

```typescript
interface PaginatedCollection {
  items: CollectionItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

async function loadCollectionPage(
  userId: string,
  page: number,
  pageSize: number,
  filter?: CollectionFilter,
): Promise<PaginatedCollection> {
  const offset = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    getCollectionItems(userId, filter, offset, pageSize),
    getCollectionCount(userId, filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: offset + items.length < total,
  };
}
```

## Customization and Extensibility

### Custom Fields

**User-Defined Fields**:

```typescript
interface CustomField {
  id: string;
  name: string;
  dataType: 'text' | 'number' | 'boolean' | 'date' | 'select';
  defaultValue?: any;
  options?: string[]; // For select fields
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

function addCustomField(collectionId: string, field: CustomField): void {
  // Add column to database
  // Update collection schema
  // Migrate existing items
}
```

### Collection Templates

**Template System**:

```typescript
interface CollectionTemplate {
  id: string;
  name: string;
  description?: string;
  game: string;
  columns: ColumnDefinition[];
  defaultFilters?: CollectionFilter[];
  views?: CollectionView[];
  metadata?: Record<string, any>;
}

// Pre-defined templates
const warframeWeaponTemplate: CollectionTemplate = {
  id: 'warframe_weapons',
  name: 'Warframe Weapons',
  game: 'warframe',
  columns: weaponColumns,
  defaultFilters: [{ states: ['owned', 'mastered'] }],
};
```

### Plugin System

**Collection Plugins**:

```typescript
interface CollectionPlugin {
  id: string;
  name: string;
  version: string;

  // Hooks
  beforeSave?: (item: CollectionItem) => CollectionItem | Promise<CollectionItem>;
  afterSave?: (item: CollectionItem) => void | Promise<void>;
  beforeDelete?: (item: CollectionItem) => boolean | Promise<boolean>;
  afterDelete?: (item: CollectionItem) => void | Promise<void>;

  // Custom operations
  operations?: Record<string, (item: CollectionItem, ...args: any[]) => any>;

  // UI extensions
  uiComponents?: Record<string, React.ComponentType>;
}

class CollectionPluginManager {
  private plugins: Map<string, CollectionPlugin> = new Map();

  registerPlugin(plugin: CollectionPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  async applyBeforeSaveHooks(item: CollectionItem): Promise<CollectionItem> {
    let modifiedItem = item;

    for (const plugin of this.plugins.values()) {
      if (plugin.beforeSave) {
        modifiedItem = await plugin.beforeSave(modifiedItem);
      }
    }

    return modifiedItem;
  }
}
```

## Source References

- Collection data models: `/packages/games/*/src/types.ts`
- Database schemas: `/packages/games/*/src/db/schema.ts`
- Collection operations: `/server/services/`
- Filter implementations: `/client/features/*/components/`
- Template definitions: `/client/lib/templates/`
- Cache management: `/client/lib/cache/`

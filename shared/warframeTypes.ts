export type WarframeWorksheet = { id: number; name: string };

export type WarframeColumn = { id: number; name: string };

export type WarframeAdvancedProgressVariant = {
  level: number;
  valence_percent: number | null;
  has_element: boolean;
  has_orokin: boolean;
  has_arcane: boolean;
  has_exilus: boolean;
};

export type WarframeAdvancedRelevanceVariant = {
  max_level: number;
  valence: boolean;
  element: boolean;
  orokin: boolean;
  arcane: boolean;
  exilus: boolean;
  auto_orokin: boolean;
};

export type WarframeRow = {
  id: number;
  name?: string;
  item_name?: string;
  orphaned?: boolean;
  values?: Record<string, string>;
  market_href?: string | null;
  market_href_normal?: string | null;
  market_href_prime?: string | null;
  advanced_progress?: {
    normal: WarframeAdvancedProgressVariant;
    prime: WarframeAdvancedProgressVariant;
  };
  advanced_relevance?: {
    normal: WarframeAdvancedRelevanceVariant;
    prime: WarframeAdvancedRelevanceVariant;
    has_prime_variant: boolean;
  };
};

export type WarframeWorksheetData = {
  columns: WarframeColumn[];
  rows: WarframeRow[];
};

export type WarframeSettings = {
  hide_completed: boolean;
  market_links: boolean;
  advanced_mode: boolean;
  show_all_variants: boolean;
};

export type WarframeWorksheetSyncResult = {
  worksheet: string;
  added: string[];
  deleted: string[];
  markedUnavailable: string[];
  mismatched: number[];
};

export type WarframeMarketLinkSyncPayload =
  | { ran: false }
  | {
      ran: true;
      rowsProcessed: number;
      rowsWithLink: number;
      failedWorksheets: Array<{ clerkUserId: string; worksheet: string }>;
    };

export type WarframeSyncCleanupRow = {
  worksheet: string;
  itemName: string;
  rowId: number;
  canonicalKey: string;
};

export type WarframeSyncResult = {
  mode: 'preview' | 'execute';
  users: Array<{
    clerkUserId: string;
    worksheets: WarframeWorksheetSyncResult[];
  }>;
  summary: {
    added: number;
    deleted: number;
    markedUnavailable: number;
    mismatched: number;
  };
  cleanup?: {
    deleted: number;
    requiresConfirmation: number;
    deletedRows: WarframeSyncCleanupRow[];
    requiresConfirmationRows: WarframeSyncCleanupRow[];
  };
  marketLinkSync?: WarframeMarketLinkSyncPayload;
};

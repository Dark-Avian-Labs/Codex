export type SummaryOutcome = 'ok' | 'skipped' | 'failed' | 'partial';

export interface StepSummaryBase {
  outcome: SummaryOutcome;
  detail: string;
  error?: string;
}

export interface ImportPipelineStats {
  requiredCount: number;
  downloaded: string[];
  skippedUnchanged: string[];
  failed: Array<{ category: string; error: string }>;
}

export interface StartupPipelineSummary {
  durationMs: number;
  schema: StepSummaryBase;
  officialExports: StepSummaryBase & {
    stats?: ImportPipelineStats;
  };
  sqliteFromExports: StepSummaryBase & {
    rows?: {
      warframes: number;
      weapons: number;
      companions: number;
      mods: number;
      modSets: number;
      arcanes: number;
      abilities: number;
    };
    modDescriptionsBackfilled?: number;
  };
  warframeRankExceptions: StepSummaryBase & {
    entryCount?: number;
  };
  exaltedStanceMods: StepSummaryBase & {
    found?: number;
    insertedOrUpdated?: number;
    wikiImagesApplied?: number;
  };
  atragraphMods: StepSummaryBase & {
    setsFound?: number;
    modsUpdated?: number;
    imagesDownloaded?: number;
    attempted?: number;
  };
  images: StepSummaryBase & {
    total?: number;
    downloaded?: number;
    skipped?: number;
    failed?: number;
    sampleErrors?: string[];
  };
  hiddenCompanionWeapons: StepSummaryBase & {
    found?: number;
    insertedOrUpdated?: number;
  };
  overframe: StepSummaryBase & {
    totalIndexed?: number;
    matchedNeedingWork?: number;
    pagesScraped?: number;
    merge?: {
      warframesUpdated: number;
      weaponsUpdated: number;
      companionsUpdated: number;
      helminthUpdated: number;
    };
  };
  wiki: StepSummaryBase & {
    merge?: {
      abilitiesUpdated: number;
      passivesUpdated: number;
      augmentsUpdated: number;
      shardTypes: number;
      shardBuffs: number;
      rivenDispositionsSyncedFromOmega: number;
      rivenDispositionsWikiFallback: number;
      weaponsProjectileSpeedsUpdated: number;
    };
  };
  helminthWiki: StepSummaryBase & {
    wikiNamesFound?: number;
    abilitiesFlagged?: number;
    fetchOk?: boolean;
  };
  incarnonWiki: StepSummaryBase & {
    pagesScraped?: number;
    pagesFailed?: number;
    weaponsTagged?: number;
    imagesDownloaded?: number;
    imagesSkipped?: number;
    fetchOk?: boolean;
  };
  warframeMarketLinks: StepSummaryBase & {
    rowsUpserted?: number;
    slugCount?: number;
  };
  blockingIssues: string[];
}

import { fetchOverframePageJson } from '../http/fetchOverframe.js';
import { FETCH_TIMEOUT_MS, isAbortError } from '../http/fetchWithTimeout.js';
import type { OverframeIndexEntry } from './indexScraper.js';

export interface ScrapedAbilityStat {
  label: string;
  value: string;
}

export interface ScrapedAbility {
  name: string;
  description: string;
  stats: ScrapedAbilityStat[];
}

export interface ScrapedItemData {
  entry: OverframeIndexEntry;
  nextData: Record<string, unknown>;
  itemData: Record<string, unknown>;
  artifactSlots: string[];
  abilities: ScrapedAbility[];
  fireBehaviors: Record<string, unknown>[];
}

interface OverframeDetailJson {
  pageProps?: {
    item?: {
      data?: Record<string, unknown>;
    };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pagePathForEntry(entry: OverframeIndexEntry): string {
  return `/build/new/${entry.overframeId}/${entry.slug}/`;
}

function parseItemData(payload: OverframeDetailJson): Record<string, unknown> {
  return payload.pageProps?.item?.data ?? {};
}

export async function scrapeItemPage(entry: OverframeIndexEntry): Promise<ScrapedItemData> {
  const pagePath = pagePathForEntry(entry);
  const url = `https://overframe.gg${pagePath}`;

  let payload: OverframeDetailJson;
  try {
    payload = await fetchOverframePageJson<OverframeDetailJson>(
      pagePath,
      FETCH_TIMEOUT_MS.overframeDetailHtml,
    );
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(
        `Failed to fetch ${url}: timed out after ${FETCH_TIMEOUT_MS.overframeDetailHtml}ms`,
      );
    }
    throw error;
  }

  const itemData = parseItemData(payload);
  const nextData = {
    props: {
      pageProps: payload.pageProps ?? {},
    },
  };

  const artifactSlots = Array.isArray(itemData.ArtifactSlots)
    ? itemData.ArtifactSlots.filter((slot): slot is string => typeof slot === 'string')
    : [];
  const fireBehaviors = Array.isArray(itemData.Behaviors)
    ? itemData.Behaviors.filter(
        (behavior): behavior is Record<string, unknown> =>
          !!behavior && typeof behavior === 'object' && !Array.isArray(behavior),
      )
    : [];

  return {
    entry,
    nextData,
    itemData,
    artifactSlots,
    abilities: [],
    fireBehaviors,
  };
}

export interface ScrapeProgress {
  current: number;
  total: number;
  currentItem: string;
  phase: 'index' | 'items' | 'merging' | 'done';
}

export async function scrapeItems(
  entries: OverframeIndexEntry[],
  delayMs = 1500,
  onProgress?: (progress: ScrapeProgress) => void,
): Promise<ScrapedItemData[]> {
  const results: ScrapedItemData[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    onProgress?.({
      current: i + 1,
      total: entries.length,
      currentItem: entry.name,
      phase: 'items',
    });

    try {
      const data = await scrapeItemPage(entry);
      results.push(data);
    } catch (err) {
      console.warn(
        `[Scraper] Failed to scrape ${entry.name}:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (i < entries.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

export async function scrapeItemPageByPath(
  pagePath: string,
  label: string,
): Promise<{ itemData: Record<string, unknown>; nextData: Record<string, unknown> } | null> {
  try {
    const payload = await fetchOverframePageJson<OverframeDetailJson>(
      pagePath,
      FETCH_TIMEOUT_MS.overframeDetailHtml,
    );
    const item = payload.pageProps?.item;
    if (!item || typeof item !== 'object') return null;

    const itemData = parseItemData(payload);
    return {
      itemData,
      nextData: {
        props: {
          pageProps: payload.pageProps ?? {},
        },
      },
    };
  } catch (error) {
    console.warn(
      `[Scraper] Failed to scrape ${label} (${pagePath}):`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  isAbortError,
} from '../http/fetchWithTimeout.js';

const ITEMS_URL = 'https://api.warframe.market/v2/items';

const FETCH_HEADERS = {
  Accept: 'application/json',
  Language: 'en',
  Platform: 'pc',
  'User-Agent': 'ArmoryDataPipeline/1.0',
} as const;

export async function fetchWarframeMarketSlugSet(): Promise<ReadonlySet<string>> {
  let response: Response;
  let body: Buffer;
  try {
    const result = await fetchBounded(
      ITEMS_URL,
      {
        headers: FETCH_HEADERS as unknown as HeadersInit,
      },
      FETCH_TIMEOUT_MS.warframeMarketItems,
      FETCH_BYTE_LIMITS.manifest,
    );
    response = result.response;
    body = result.body;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(
        `warframe.market items fetch timed out after ${FETCH_TIMEOUT_MS.warframeMarketItems}ms`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`warframe.market items fetch failed: HTTP ${response.status}`);
  }
  const json = JSON.parse(body.toString('utf-8')) as {
    data?: { slug?: string }[];
  };
  const rows = Array.isArray(json.data) ? json.data : [];
  const slugs = new Set<string>();
  for (const row of rows) {
    if (typeof row.slug === 'string' && row.slug.length > 0) {
      slugs.add(row.slug);
    }
  }
  return slugs;
}

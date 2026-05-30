import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  WarframeColumn as Column,
  WarframeRow as Row,
  WarframeSettings,
  WarframeWorksheet as Worksheet,
  WarframeWorksheetData as WorksheetData,
} from '../../../../shared/warframeTypes.js';
import { apiFetch } from '../../../utils/api';
import { TAB_ORDER } from '../warframeConstants.js';

export type WarframeInitialSettings = Pick<
  WarframeSettings,
  'hide_completed' | 'market_links' | 'advanced_mode' | 'show_all_variants'
>;

export function useWarframeWorksheetData(
  onSettingsLoaded?: (settings: WarframeInitialSettings) => void,
) {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [worksheetId, setWorksheetId] = useState<number | null>(null);
  const [data, setData] = useState<WorksheetData>({ columns: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const worksheetIdRef = useRef<number | null>(worksheetId);

  useEffect(() => {
    worksheetIdRef.current = worksheetId;
  }, [worksheetId]);

  const fetchWorksheets = useCallback(async (): Promise<Worksheet[]> => {
    const response = await apiFetch('/api/warframe/worksheets');
    if (!response.ok) {
      throw new Error('Failed to load worksheets');
    }
    const body = (await response.json()) as { worksheets?: Worksheet[] };
    return Array.isArray(body.worksheets) ? body.worksheets : [];
  }, []);

  const fetchSettings = useCallback(async (): Promise<WarframeInitialSettings> => {
    const response = await apiFetch('/api/warframe/settings');
    if (!response.ok) {
      throw new Error('Failed to load Warframe settings');
    }
    const body = (await response.json()) as Partial<WarframeSettings> | null;
    return {
      hide_completed: Boolean(body?.hide_completed),
      market_links: Boolean(body?.market_links),
      advanced_mode: Boolean(body?.advanced_mode),
      show_all_variants: Boolean(body?.show_all_variants),
    };
  }, []);

  const fetchWorksheetData = useCallback(
    async (targetWorksheetId: number, signal?: AbortSignal): Promise<WorksheetData> => {
      const response = await apiFetch(`/api/warframe/worksheets/${targetWorksheetId}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error('Failed to load worksheet data');
      }
      const body = (await response.json()) as {
        columns?: Column[];
        rows?: Row[];
      };
      return {
        columns: Array.isArray(body.columns) ? body.columns : [],
        rows: Array.isArray(body.rows) ? body.rows : [],
      };
    },
    [],
  );

  const loadWorksheets = useCallback(async (): Promise<WarframeInitialSettings | null> => {
    setLoading(true);
    setLoadError(null);
    try {
      const [worksheetItems, settings] = await Promise.all([fetchWorksheets(), fetchSettings()]);
      const items = worksheetItems
        .map((worksheet) => ({
          ...worksheet,
          name: worksheet.name.replace(/^\uFEFF/, '').trim(),
        }))
        .sort((a, b) => {
          const indexA = TAB_ORDER.indexOf(a.name as (typeof TAB_ORDER)[number]);
          const indexB = TAB_ORDER.indexOf(b.name as (typeof TAB_ORDER)[number]);
          return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });
      setWorksheets(items);
      setWorksheetId(items[0]?.id ?? null);
      onSettingsLoaded?.(settings);
      return settings;
    } catch {
      setLoadError('Could not load Warframe worksheets.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchSettings, fetchWorksheets, onSettingsLoaded]);

  const loadWorksheetData = useCallback(
    async (targetWorksheetId: number, signal?: AbortSignal): Promise<void> => {
      setLoading(true);
      setLoadError(null);
      setData({ columns: [], rows: [] });
      try {
        const worksheetData = await fetchWorksheetData(targetWorksheetId, signal);
        if (signal?.aborted || worksheetIdRef.current !== targetWorksheetId) {
          return;
        }
        setData(worksheetData);
      } catch (error_) {
        if (
          signal?.aborted ||
          (error_ instanceof Error && error_.name === 'AbortError') ||
          worksheetIdRef.current !== targetWorksheetId
        ) {
          return;
        }
        setLoadError('Could not load worksheet data.');
      } finally {
        if (!signal?.aborted && worksheetIdRef.current === targetWorksheetId) {
          setLoading(false);
        }
      }
    },
    [fetchWorksheetData],
  );

  useEffect(() => {
    void loadWorksheets();
  }, [loadWorksheets]);

  useEffect(() => {
    let controller: AbortController | null = null;
    if (worksheetId === null) {
      setData({ columns: [], rows: [] });
    } else {
      controller = new AbortController();
      const currentWorksheetId = worksheetId;
      void loadWorksheetData(currentWorksheetId, controller.signal);
    }
    return () => {
      controller?.abort();
    };
  }, [worksheetId, loadWorksheetData]);

  const retryLoad = useCallback((): void => {
    setLoadError(null);
    if (worksheetId === null) {
      void loadWorksheets();
      return;
    }
    void loadWorksheetData(worksheetId);
  }, [worksheetId, loadWorksheets, loadWorksheetData]);

  return {
    worksheets,
    worksheetId,
    setWorksheetId,
    data,
    setData,
    loading,
    loadError,
    loadWorksheets,
    loadWorksheetData,
    retryLoad,
  };
}

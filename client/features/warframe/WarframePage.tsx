import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  WarframeColumn as Column,
  WarframeRow as Row,
} from '../../../shared/warframeTypes.js';
import { HeaderSearch } from '../../components/Layout/HeaderSearch';
import { useLayoutSlots } from '../../components/Layout/useLayoutSlots';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { apiFetch } from '../../utils/api';
import {
  useWarframeWorksheetData,
  type WarframeInitialSettings,
} from './hooks/useWarframeWorksheetData.js';
import { tableScrollStyle, WORKSHEET_LABELS, type ExitRowPhase } from './warframeConstants.js';
import { WarframeTableRow, type AdvancedPatch } from './WarframeTableRow';
import {
  clamp,
  isHelminthNonSubsumableRow,
  isRowAdvancedCompleted,
  isRowCompleted,
  nextStatus,
} from './warframeUtils.js';

export function WarframePage() {
  const { setHeaderCenter, setHeaderActions } = useLayoutSlots();
  const [search, setSearch] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [marketLinks, setMarketLinks] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [exitingRows, setExitingRows] = useState<Record<number, ExitRowPhase>>({});
  const [operationError, setOperationError] = useState<string | null>(null);

  const applyInitialSettings = useCallback((settings: WarframeInitialSettings): void => {
    setHideCompleted(settings.hide_completed);
    setMarketLinks(settings.market_links);
    setAdvancedMode(settings.advanced_mode);
    setShowAllVariants(settings.show_all_variants);
  }, []);

  const {
    worksheets,
    worksheetId,
    setWorksheetId,
    data,
    setData,
    loading,
    loadError,
    loadWorksheetData,
    retryLoad,
  } = useWarframeWorksheetData(applyInitialSettings);

  const exitTimersRef = useRef<Map<number, number[]>>(new Map());
  const holdIntervalRef = useRef<number | null>(null);
  const holdSessionRef = useRef<{
    latest: number;
    commit: (value: number) => void;
  } | null>(null);

  const clearExitTimers = useCallback((rowId: number): void => {
    const timers = exitTimersRef.current.get(rowId);
    if (!timers) return;
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    exitTimersRef.current.delete(rowId);
  }, []);

  const clearAllExitTimers = useCallback((): void => {
    for (const [rowId, timers] of exitTimersRef.current.entries()) {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      exitTimersRef.current.delete(rowId);
    }
  }, []);

  const stopHoldStep = useCallback((commitFinal = true): void => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    const session = holdSessionRef.current;
    holdSessionRef.current = null;
    if (commitFinal && session) {
      session.commit(session.latest);
    }
  }, []);

  const cancelExitAnimation = useCallback(
    (rowId: number): void => {
      clearExitTimers(rowId);
      setExitingRows((previous) => {
        if (!(rowId in previous)) return previous;
        const next = { ...previous };
        delete next[rowId];
        return next;
      });
    },
    [clearExitTimers],
  );

  const startExitAnimation = useCallback(
    (rowId: number): void => {
      clearExitTimers(rowId);
      setExitingRows((previous) => ({ ...previous, [rowId]: 'fill' }));
      const fillTimer = window.setTimeout(() => {
        setExitingRows((previous) => {
          if (!(rowId in previous)) return previous;
          return { ...previous, [rowId]: 'push' };
        });
      }, 250);
      const cleanupTimer = window.setTimeout(() => {
        setExitingRows((previous) => {
          if (!(rowId in previous)) return previous;
          const next = { ...previous };
          delete next[rowId];
          return next;
        });
        exitTimersRef.current.delete(rowId);
      }, 500);
      exitTimersRef.current.set(rowId, [fillTimer, cleanupTimer]);
    },
    [clearExitTimers],
  );

  useEffect(() => {
    return () => {
      clearAllExitTimers();
      stopHoldStep();
    };
  }, [clearAllExitTimers, stopHoldStep]);

  useEffect(() => {
    let timeoutId: number | null = null;
    if (operationError) {
      timeoutId = window.setTimeout(() => {
        setOperationError(null);
      }, 5000);
    }
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [operationError]);

  useEffect(() => {
    clearAllExitTimers();
    setExitingRows({});
  }, [worksheetId, clearAllExitTimers]);

  useEffect(() => {
    if (!hideCompleted || search.trim().length > 0) {
      clearAllExitTimers();
      setExitingRows({});
    }
  }, [hideCompleted, search, clearAllExitTimers]);

  const currentWorksheetName =
    worksheets.find((worksheet) => worksheet.id === worksheetId)?.name ?? '';
  const isArcanesSheet = currentWorksheetName === 'Arcanes';

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const hasSearch = query.length > 0;
    const exitingRowIds = new Set(Object.keys(exitingRows).map((rowId) => Number(rowId)));
    return data.rows.filter((row) => {
      const matchesSearch = (row.name || row.item_name || '').toLowerCase().includes(query);
      if (!matchesSearch) {
        return false;
      }
      if (!hideCompleted || hasSearch) {
        return true;
      }
      if (!isRowCompleted(row, data.columns, advancedMode, showAllVariants)) {
        return true;
      }
      return exitingRowIds.has(row.id);
    });
  }, [advancedMode, showAllVariants, data.columns, data.rows, hideCompleted, search, exitingRows]);

  const hasDualVariantColumns = useMemo(() => {
    const nonHelminth = data.columns.filter((column) => column.name !== 'Helminth');
    return (
      nonHelminth.some((column) => /prime/i.test(column.name)) &&
      nonHelminth.some((column) => !/prime/i.test(column.name))
    );
  }, [data.columns]);

  const stats = useMemo(() => {
    if (advancedMode) {
      const total = data.rows.length;
      const complete = data.rows.filter((row) =>
        isRowAdvancedCompleted(row, showAllVariants),
      ).length;
      const percent = total > 0 ? Math.round((complete / total) * 100) : 0;
      return [{ name: 'Completed', complete, total, percent, obtained: 0 }];
    }
    const byColumn: Record<string, { total: number; complete: number; obtained: number }> = {};
    for (const column of data.columns) {
      if (column.name === 'Helminth') continue;
      byColumn[String(column.id)] = { total: 0, complete: 0, obtained: 0 };
    }
    for (const row of data.rows) {
      for (const column of data.columns) {
        if (column.name === 'Helminth') continue;
        const key = String(column.id);
        const value = row.values?.[key] ?? '';
        if (value === 'Unavailable') {
          continue;
        }
        byColumn[key].total += 1;
        if (value === 'Complete') {
          byColumn[key].complete += 1;
        } else if (value === 'Obtained') {
          byColumn[key].obtained += 1;
        }
      }
    }
    return data.columns
      .filter((column) => column.name !== 'Helminth')
      .map((column) => {
        const entry = byColumn[String(column.id)];
        const percent = entry.total > 0 ? Math.round((entry.complete / entry.total) * 100) : 0;
        return {
          name: column.name,
          complete: entry.complete,
          total: entry.total,
          percent,
          obtained: entry.obtained,
        };
      });
  }, [advancedMode, showAllVariants, data.columns, data.rows]);

  const handleToggle = useCallback(
    async (row: Row, column: Column): Promise<void> => {
      const oldValue = row.values?.[String(column.id)] ?? '';
      if (oldValue === 'Unavailable') {
        return;
      }
      if (column.name === 'Helminth' && isHelminthNonSubsumableRow(row)) {
        return;
      }
      const value = nextStatus(oldValue, column.name);
      const rowId = row.id;
      const wasCompleted = isRowCompleted(row, data.columns, advancedMode, showAllVariants);
      const updatedRowForCompletionCheck: Row = {
        ...row,
        values: {
          ...row.values,
          [String(column.id)]: value,
        },
      };
      const nowCompleted = isRowCompleted(
        updatedRowForCompletionCheck,
        data.columns,
        advancedMode,
        showAllVariants,
      );
      const shouldAnimateExit =
        hideCompleted && search.trim().length === 0 && !wasCompleted && nowCompleted;
      if (!shouldAnimateExit) {
        cancelExitAnimation(rowId);
      }
      setData((previous) => ({
        ...previous,
        rows: previous.rows.map((candidate) =>
          candidate.id === row.id
            ? {
                ...candidate,
                values: {
                  ...candidate.values,
                  [String(column.id)]: value,
                },
              }
            : candidate,
        ),
      }));
      if (shouldAnimateExit) {
        startExitAnimation(rowId);
      }
      try {
        const response = await apiFetch('/api/warframe/cells', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            row_id: rowId,
            column_id: column.id,
            value,
          }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Update failed');
        }
      } catch {
        cancelExitAnimation(rowId);
        setData((previous) => ({
          ...previous,
          rows: previous.rows.map((candidate) =>
            candidate.id === row.id
              ? {
                  ...candidate,
                  values: {
                    ...candidate.values,
                    [String(column.id)]: oldValue,
                  },
                }
              : candidate,
          ),
        }));
        setOperationError('Failed to save Warframe update.');
      }
    },
    [
      data.columns,
      advancedMode,
      showAllVariants,
      hideCompleted,
      search,
      cancelExitAnimation,
      startExitAnimation,
      setData,
    ],
  );

  const handleAdvancedPatch = useCallback(
    async (row: Row, patch: AdvancedPatch): Promise<void> => {
      const oldProgress = row.advanced_progress ?? {
        normal: {
          level: 0,
          valence_percent: null,
          has_element: false,
          has_orokin: false,
          has_arcane: false,
          has_exilus: false,
        },
        prime: {
          level: 0,
          valence_percent: null,
          has_element: false,
          has_orokin: false,
          has_arcane: false,
          has_exilus: false,
        },
      };
      const nextProgress = {
        normal: {
          ...oldProgress.normal,
          level: patch.level ?? oldProgress.normal.level,
          valence_percent: patch.valence_percent ?? oldProgress.normal.valence_percent,
          has_element: patch.has_element ?? oldProgress.normal.has_element,
          has_orokin: patch.has_orokin ?? oldProgress.normal.has_orokin,
          has_arcane: patch.has_arcane ?? oldProgress.normal.has_arcane,
          has_exilus: patch.has_exilus ?? oldProgress.normal.has_exilus,
        },
        prime: {
          ...oldProgress.prime,
          level: patch.level_prime ?? oldProgress.prime.level,
          valence_percent: patch.valence_percent_prime ?? oldProgress.prime.valence_percent,
          has_element: patch.has_element_prime ?? oldProgress.prime.has_element,
          has_orokin: patch.has_orokin_prime ?? oldProgress.prime.has_orokin,
          has_arcane: patch.has_arcane_prime ?? oldProgress.prime.has_arcane,
          has_exilus: patch.has_exilus_prime ?? oldProgress.prime.has_exilus,
        },
      };
      const rowId = row.id;
      const wasCompleted = isRowCompleted(row, data.columns, true, showAllVariants);
      const nowCompleted = isRowCompleted(
        { ...row, advanced_progress: nextProgress },
        data.columns,
        true,
        showAllVariants,
      );
      const shouldAnimateExit =
        hideCompleted && search.trim().length === 0 && !wasCompleted && nowCompleted;
      if (!shouldAnimateExit) {
        cancelExitAnimation(rowId);
      }
      setData((previous) => ({
        ...previous,
        rows: previous.rows.map((candidate) =>
          candidate.id === row.id ? { ...candidate, advanced_progress: nextProgress } : candidate,
        ),
      }));
      if (shouldAnimateExit) {
        startExitAnimation(rowId);
      }
      try {
        const response = await apiFetch('/api/warframe/advanced-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            row_id: row.id,
            ...patch,
          }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          advanced_progress?: NonNullable<Row['advanced_progress']>;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Update failed');
        }
        if (body?.advanced_progress) {
          setData((previous) => ({
            ...previous,
            rows: previous.rows.map((candidate) =>
              candidate.id === row.id
                ? { ...candidate, advanced_progress: body.advanced_progress }
                : candidate,
            ),
          }));
        }
      } catch {
        cancelExitAnimation(rowId);
        setData((previous) => ({
          ...previous,
          rows: previous.rows.map((candidate) =>
            candidate.id === row.id ? { ...candidate, advanced_progress: oldProgress } : candidate,
          ),
        }));
        setOperationError('Failed to save advanced Warframe update.');
      }
    },
    [
      data.columns,
      showAllVariants,
      hideCompleted,
      search,
      cancelExitAnimation,
      startExitAnimation,
      setData,
    ],
  );

  const handleDeleteOrphanRow = useCallback(
    async (row: Row): Promise<void> => {
      const rowId = row.id;
      setData((previous) => ({
        ...previous,
        rows: previous.rows.filter((candidate) => candidate.id !== rowId),
      }));
      try {
        const response = await apiFetch(`/api/warframe/rows/${rowId}`, {
          method: 'DELETE',
        });
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Delete failed');
        }
      } catch {
        setData((previous) =>
          previous.rows.some((candidate) => candidate.id === rowId)
            ? previous
            : { ...previous, rows: [...previous.rows, row] },
        );
        setOperationError('Failed to remove orphaned row.');
      }
    },
    [setData],
  );

  const updateAdvancedProgressLocal = useCallback(
    (
      rowId: number,
      patch: Partial<{
        level: number;
        level_prime: number;
        valence_percent: number | null;
        valence_percent_prime: number | null;
      }>,
    ): void => {
      setData((previous) => ({
        ...previous,
        rows: previous.rows.map((candidate) => {
          if (candidate.id !== rowId) return candidate;
          const current = candidate.advanced_progress;
          if (!current) return candidate;
          return {
            ...candidate,
            advanced_progress: {
              normal: {
                ...current.normal,
                level: patch.level ?? current.normal.level,
                valence_percent: patch.valence_percent ?? current.normal.valence_percent,
              },
              prime: {
                ...current.prime,
                level: patch.level_prime ?? current.prime.level,
                valence_percent: patch.valence_percent_prime ?? current.prime.valence_percent,
              },
            },
          };
        }),
      }));
    },
    [],
  );

  const startHoldStep = useCallback(
    (
      initialValue: number,
      direction: 1 | -1,
      min: number,
      max: number,
      applyLocal: (next: number) => void,
      commitRemote: (next: number) => void,
    ): void => {
      stopHoldStep(false);
      let current = clamp(initialValue + direction, min, max);
      applyLocal(current);
      holdSessionRef.current = {
        latest: current,
        commit: commitRemote,
      };
      holdIntervalRef.current = window.setInterval(() => {
        current = clamp(current + direction, min, max);
        applyLocal(current);
        if (holdSessionRef.current) {
          holdSessionRef.current.latest = current;
        }
      }, 150);
    },
    [stopHoldStep],
  );

  const handleHideCompletedChange = useCallback(
    async (nextValue: boolean): Promise<void> => {
      const previousValue = hideCompleted;
      setHideCompleted(nextValue);
      try {
        const response = await apiFetch('/api/warframe/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hide_completed: nextValue }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to save Warframe settings');
        }
      } catch {
        setHideCompleted(previousValue);
        setOperationError('Failed to save "Hide completed" setting.');
      }
    },
    [hideCompleted],
  );

  const handleMarketLinksChange = useCallback(
    async (nextValue: boolean): Promise<void> => {
      const previousValue = marketLinks;
      setMarketLinks(nextValue);
      try {
        const response = await apiFetch('/api/warframe/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ market_links: nextValue }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to save Warframe settings');
        }
      } catch {
        setMarketLinks(previousValue);
        setOperationError('Failed to save "Market links" setting.');
        return;
      }
      if (nextValue && worksheetId !== null) {
        void loadWorksheetData(worksheetId);
      }
    },
    [marketLinks, worksheetId, loadWorksheetData],
  );

  const handleAdvancedModeChange = useCallback(
    async (nextValue: boolean): Promise<void> => {
      const previousValue = advancedMode;
      setAdvancedMode(nextValue);
      try {
        const response = await apiFetch('/api/warframe/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ advanced_mode: nextValue }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to save Warframe settings');
        }
      } catch {
        setAdvancedMode(previousValue);
        setOperationError('Failed to save "Advanced" setting.');
      }
    },
    [advancedMode],
  );

  const handleShowAllVariantsChange = useCallback(
    async (nextValue: boolean): Promise<void> => {
      const previousValue = showAllVariants;
      setShowAllVariants(nextValue);
      try {
        const response = await apiFetch('/api/warframe/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ show_all_variants: nextValue }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to save Warframe settings');
        }
      } catch {
        setShowAllVariants(previousValue);
        setOperationError('Failed to save "Show all variants" setting.');
      }
    },
    [showAllVariants],
  );

  useEffect(() => {
    setHeaderActions(null);
  }, [setHeaderActions]);

  useEffect(() => {
    setHeaderCenter(
      <HeaderSearch
        inputId="codex-warframe-header-search"
        ariaLabel="Search Warframe items"
        value={search}
        onChange={setSearch}
      />,
    );
    return () => {
      setHeaderCenter(null);
    };
  }, [search, setHeaderCenter]);

  function handleRetry(): void {
    retryLoad();
  }

  if (loading && worksheets.length === 0) {
    return (
      <div className="loading" role="status" aria-live="polite">
        Loading Warframe...
      </div>
    );
  }
  if (loadError && worksheets.length === 0) {
    return (
      <div className="space-y-3">
        <p className="error" role="alert">
          {loadError}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const effectiveMarketLinks = marketLinks && (!advancedMode || isArcanesSheet);
  const inlineMarketLayout = effectiveMarketLinks && (hasDualVariantColumns || isArcanesSheet);
  const activePanelId =
    worksheetId === null ? 'warframe-panel-empty' : `warframe-panel-${worksheetId}`;

  return (
    <section className="space-y-4">
      {operationError ? (
        <div className="error flex items-center justify-between gap-3" role="alert">
          <span>{operationError}</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setOperationError(null)}
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {loadError ? (
        <div className="error flex items-center justify-between gap-3" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-secondary" onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : null}
      <div className="tabs" role="tablist" aria-label="Warframe categories">
        {worksheets.map((worksheet) => {
          const tabId = `warframe-tab-${worksheet.id}`;
          const panelId = `warframe-panel-${worksheet.id}`;
          return (
            <button
              key={worksheet.id}
              id={tabId}
              type="button"
              className={`tab ${worksheetId === worksheet.id ? 'active' : ''}`}
              role="tab"
              aria-selected={worksheetId === worksheet.id}
              aria-controls={panelId}
              onClick={() => setWorksheetId(worksheet.id)}
            >
              {WORKSHEET_LABELS[worksheet.name] ?? worksheet.name}
            </button>
          );
        })}
      </div>
      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={worksheetId === null ? undefined : `warframe-tab-${worksheetId}`}
        className="space-y-4"
      >
        <div className="stats-bar">
          <div className="stats-bar-stats">
            {stats.map((entry) => (
              <div key={entry.name} className="stat">
                <span>{entry.name}:</span>
                <span className="stat-value stat-complete">{entry.complete}</span>
                <span>/</span>
                <span className="stat-value">{entry.total}</span>
                <span>({entry.percent}%)</span>
                {entry.obtained > 0 ? (
                  <span className="stat-value stat-obtained">+{entry.obtained}</span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="stats-bar-actions">
            <button
              type="button"
              onClick={() => {
                void handleHideCompletedChange(!hideCompleted);
              }}
              aria-pressed={hideCompleted}
              className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-200"
              title='Toggle "Hide completed"'
            >
              <span>Hide completed</span>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                  hideCompleted
                    ? 'bg-success/20 text-success hover:bg-success/30'
                    : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                }`}
                aria-hidden="true"
              >
                {hideCompleted ? (
                  <MaterialSymbol
                    name="check"
                    filled
                    className="leading-none"
                    style={{ fontSize: 15 }}
                  />
                ) : (
                  <MaterialSymbol name="close" className="leading-none" style={{ fontSize: 15 }} />
                )}
              </span>
            </button>
            {advancedMode ? (
              <button
                type="button"
                onClick={() => {
                  void handleShowAllVariantsChange(!showAllVariants);
                }}
                aria-pressed={showAllVariants}
                className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-200"
                title={
                  showAllVariants
                    ? 'Showing Normal and Prime for items that have both'
                    : 'Hiding duplicate variant: Normal when Prime exists, Prime when it does not'
                }
              >
                <span>Show all</span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                    showAllVariants
                      ? 'bg-success/20 text-success hover:bg-success/30'
                      : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                  }`}
                  aria-hidden="true"
                >
                  {showAllVariants ? (
                    <MaterialSymbol
                      name="check"
                      filled
                      className="leading-none"
                      style={{ fontSize: 15 }}
                    />
                  ) : (
                    <MaterialSymbol
                      name="close"
                      className="leading-none"
                      style={{ fontSize: 15 }}
                    />
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void handleMarketLinksChange(!marketLinks);
                }}
                aria-pressed={marketLinks}
                className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-200"
                title='Toggle "Market links"'
              >
                <span>Market links</span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                    marketLinks
                      ? 'bg-success/20 text-success hover:bg-success/30'
                      : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                  }`}
                  aria-hidden="true"
                >
                  {marketLinks ? (
                    <MaterialSymbol
                      name="check"
                      filled
                      className="leading-none"
                      style={{ fontSize: 15 }}
                    />
                  ) : (
                    <MaterialSymbol
                      name="close"
                      className="leading-none"
                      style={{ fontSize: 15 }}
                    />
                  )}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void handleAdvancedModeChange(!advancedMode);
              }}
              aria-pressed={advancedMode}
              className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-200"
              title='Toggle "Advanced"'
            >
              <span>Advanced</span>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                  advancedMode
                    ? 'bg-success/20 text-success hover:bg-success/30'
                    : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                }`}
                aria-hidden="true"
              >
                {advancedMode ? (
                  <MaterialSymbol
                    name="check"
                    filled
                    className="leading-none"
                    style={{ fontSize: 15 }}
                  />
                ) : (
                  <MaterialSymbol name="close" className="leading-none" style={{ fontSize: 15 }} />
                )}
              </span>
            </button>
          </div>
        </div>
        <div className="table-container">
          <div className="table-scroll" style={tableScrollStyle}>
            <table style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 'auto' }} />
                {advancedMode ? (
                  isArcanesSheet ? (
                    <col style={{ width: effectiveMarketLinks ? '248px' : '128px' }} />
                  ) : (
                    <>
                      <col style={{ width: '64px' }} />
                      <col style={{ width: '128px' }} />
                      <col style={{ width: '128px' }} />
                      <col style={{ width: '128px' }} />
                      <col style={{ width: '128px' }} />
                      <col style={{ width: '128px' }} />
                      <col style={{ width: '128px' }} />
                    </>
                  )
                ) : (
                  data.columns.map((column) => (
                    <col
                      key={`col-${column.id}`}
                      style={{
                        width:
                          column.name === 'Helminth'
                            ? '150px'
                            : inlineMarketLayout && column.name !== 'Helminth'
                              ? '248px'
                              : '200px',
                      }}
                    />
                  ))
                )}
                {effectiveMarketLinks && !inlineMarketLayout ? (
                  <col style={{ width: '96px' }} />
                ) : null}
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  {advancedMode ? (
                    isArcanesSheet ? (
                      <th className="text-center">Rank</th>
                    ) : (
                      <>
                        <th
                          className="text-muted text-center text-xs font-normal"
                          aria-label="Variant"
                        >
                          &nbsp;
                        </th>
                        <th className="text-center">Level</th>
                        <th className="text-center">Valence</th>
                        <th className="text-center">Ele Vice</th>
                        <th className="text-center">Orokin</th>
                        <th className="text-center">Arcane</th>
                        <th className="text-center">Exilus</th>
                      </>
                    )
                  ) : (
                    data.columns.map((column) => (
                      <th key={column.id} className="text-center">
                        {column.name}
                      </th>
                    ))
                  )}
                  {effectiveMarketLinks && !inlineMarketLayout ? (
                    <th className="text-center">Market</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <WarframeTableRow
                    key={row.id}
                    row={row}
                    columns={data.columns}
                    advancedMode={advancedMode}
                    isArcanesSheet={isArcanesSheet}
                    showAllVariants={showAllVariants}
                    effectiveMarketLinks={effectiveMarketLinks}
                    inlineMarketLayout={inlineMarketLayout}
                    currentWorksheetName={currentWorksheetName}
                    exitPhase={exitingRows[row.id]}
                    onToggle={handleToggle}
                    onAdvancedPatch={handleAdvancedPatch}
                    onDeleteOrphanRow={handleDeleteOrphanRow}
                    onHoldStart={startHoldStep}
                    onHoldStop={stopHoldStep}
                    updateAdvancedProgressLocal={updateAdvancedProgressLocal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

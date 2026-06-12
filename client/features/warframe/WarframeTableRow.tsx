import { memo } from 'react';

import type {
  WarframeColumn as Column,
  WarframeRow as Row,
} from '../../../shared/warframeTypes.js';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import type { ExitRowPhase } from './warframeConstants.js';
import {
  advancedToggleClass,
  advancedToggleGlyph,
  advancedVariantsVisible,
  helminthCellGlyph,
  isHelminthNonSubsumableRow,
  isRowCompleted,
  statusClass,
} from './warframeUtils.js';

export type AdvancedPatch = Partial<{
  level: number;
  level_prime: number;
  valence_percent: number | null;
  valence_percent_prime: number | null;
  has_element: boolean;
  has_element_prime: boolean;
  has_orokin: boolean;
  has_orokin_prime: boolean;
  has_arcane: boolean;
  has_arcane_prime: boolean;
  has_exilus: boolean;
  has_exilus_prime: boolean;
}>;

export type AdvancedLocalPatch = Partial<{
  level: number;
  level_prime: number;
  valence_percent: number | null;
  valence_percent_prime: number | null;
}>;

interface WarframeTableRowProps {
  row: Row;
  columns: Column[];
  advancedMode: boolean;
  isArcanesSheet: boolean;
  showAllVariants: boolean;
  effectiveMarketLinks: boolean;
  inlineMarketLayout: boolean;
  currentWorksheetName: string;
  exitPhase: ExitRowPhase | undefined;
  onToggle: (row: Row, column: Column) => void | Promise<void>;
  onAdvancedPatch: (row: Row, patch: AdvancedPatch) => void | Promise<void>;
  onDeleteOrphanRow: (row: Row) => void | Promise<void>;
  onHoldStart: (
    initialValue: number,
    direction: 1 | -1,
    min: number,
    max: number,
    applyLocal: (next: number) => void,
    commitRemote: (next: number) => void,
  ) => void;
  onHoldStop: (commitFinal?: boolean) => void;
  updateAdvancedProgressLocal: (rowId: number, patch: AdvancedLocalPatch) => void;
}

export const WarframeTableRow = memo(function WarframeTableRow({
  row,
  columns,
  advancedMode,
  isArcanesSheet,
  showAllVariants,
  effectiveMarketLinks,
  inlineMarketLayout,
  currentWorksheetName,
  exitPhase,
  onToggle,
  onAdvancedPatch,
  onDeleteOrphanRow,
  onHoldStart,
  onHoldStop,
  updateAdvancedProgressLocal,
}: WarframeTableRowProps) {
  const isCompletedRow = isRowCompleted(row, columns, advancedMode, showAllVariants);
  const rowClassName = `${isCompletedRow ? 'warframe-completed-row ' : ''}${
    row.orphaned ? 'sync-mismatch-row ' : ''
  }${exitPhase === 'fill' ? 'warframe-row-exit-fill ' : ''}${
    exitPhase === 'push' ? 'warframe-row-exit-push' : ''
  }`.trim();
  const visibleVariants = advancedVariantsVisible(row, showAllVariants);

  return (
    <tr className={rowClassName}>
      <td className="item-name">
        <div className="flex items-center gap-2">
          <span>{row.name || row.item_name || 'Unnamed'}</span>
          {row.orphaned ? (
            <button
              type="button"
              className="text-muted hover:text-danger inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors"
              onClick={() => {
                void onDeleteOrphanRow(row);
              }}
              aria-label={`Remove ${row.name || row.item_name || 'item'} from worksheet`}
              title="Remove item no longer in catalog"
            >
              <MaterialSymbol name="delete" style={{ fontSize: 16 }} />
            </button>
          ) : null}
        </div>
      </td>
      {advancedMode && isArcanesSheet ? (
        <td className="status-cell">
          <div className={`status-cell-inner ${effectiveMarketLinks ? '' : 'justify-center'}`}>
            {(() => {
              const relevance = row.advanced_relevance?.normal;
              const progress = row.advanced_progress?.normal;
              const max = relevance?.max_level ?? 5;
              const current = progress?.level ?? 0;
              const levelMaxed = current >= max;
              const rowLabel = row.name || row.item_name || 'item';
              return (
                <>
                  <button
                    type="button"
                    className={`status-btn helminth-btn ${
                      levelMaxed ? 'yes' : 'empty'
                    } min-w-[82px] px-2 py-1 text-xs`}
                    onMouseDown={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const direction: 1 | -1 = event.clientY < rect.top + rect.height / 2 ? 1 : -1;
                      onHoldStart(
                        current,
                        direction,
                        0,
                        max,
                        (next) => {
                          updateAdvancedProgressLocal(row.id, { level: next });
                        },
                        (next) => {
                          void onAdvancedPatch(row, { level: next });
                        },
                      );
                    }}
                    onMouseUp={() => onHoldStop(true)}
                    onMouseLeave={() => onHoldStop(true)}
                    onTouchEnd={() => onHoldStop(true)}
                    aria-label={`Rank for ${rowLabel}`}
                  >
                    <span className="flex w-full min-w-0 items-center justify-between gap-1">
                      <span className="tabular-nums">{current}</span>
                      <span
                        className={`inline-flex shrink-0 flex-col text-[9px] leading-[0.7] ${
                          levelMaxed ? 'opacity-90' : 'opacity-80'
                        }`}
                      >
                        <span>▲</span>
                        <span>▼</span>
                      </span>
                    </span>
                  </button>
                  {effectiveMarketLinks ? (
                    row.market_href ? (
                      <a
                        href={row.market_href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="status-btn helminth-btn empty text-primary hover:text-primary/90 inline-flex shrink-0 no-underline"
                        aria-label={`Warframe Market for ${rowLabel}`}
                        title="Open Warframe Market"
                      >
                        <MaterialSymbol
                          name="link_2"
                          className="leading-none"
                          style={{ fontSize: 15 }}
                        />
                      </a>
                    ) : (
                      <span
                        className="status-btn helminth-btn unavailable inline-flex shrink-0 cursor-not-allowed"
                        aria-disabled="true"
                        title="Not listed on Warframe Market"
                        aria-label={`No Warframe Market listing for ${rowLabel}`}
                      >
                        <MaterialSymbol
                          name="link_2"
                          className="leading-none"
                          style={{ fontSize: 15 }}
                        />
                      </span>
                    )
                  ) : null}
                </>
              );
            })()}
          </div>
        </td>
      ) : advancedMode ? (
        <>
          <td className="status-cell align-middle">
            <div className="status-cell-inner justify-end pr-1">
              <div className="text-muted flex flex-col gap-1 text-end text-[10px] leading-tight">
                {visibleVariants.map((variant) => (
                  <span
                    key={`${row.id}-vl-${variant}`}
                    className="flex min-h-[29px] items-center justify-end"
                  >
                    {variant === 'prime' ? 'Prime' : 'Normal'}
                  </span>
                ))}
              </div>
            </div>
          </td>
          <td className="status-cell">
            <div className="status-cell-inner justify-center">
              <div className="flex flex-col gap-1">
                {visibleVariants.map((variant) => {
                  const isPrime = variant === 'prime';
                  const relevance = row.advanced_relevance?.[variant];
                  const progress = row.advanced_progress?.[variant];
                  const enabled = isPrime
                    ? Boolean(row.advanced_relevance?.has_prime_variant)
                    : true;
                  const max = relevance?.max_level ?? 30;
                  const current = progress?.level ?? 0;
                  const levelMaxed = enabled && current >= max;
                  const key = isPrime ? 'level_prime' : 'level';
                  return (
                    <button
                      key={`level-${variant}`}
                      type="button"
                      className={`status-btn helminth-btn ${
                        !enabled ? 'unavailable' : levelMaxed ? 'yes' : 'empty'
                      } min-w-[82px] px-2 py-1 text-xs`}
                      disabled={!enabled}
                      onMouseDown={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const direction: 1 | -1 =
                          event.clientY < rect.top + rect.height / 2 ? 1 : -1;
                        onHoldStart(
                          current,
                          direction,
                          0,
                          max,
                          (next) => {
                            updateAdvancedProgressLocal(row.id, {
                              [key]: next,
                            } as AdvancedLocalPatch);
                          },
                          (next) => {
                            void onAdvancedPatch(row, { [key]: next } as AdvancedPatch);
                          },
                        );
                      }}
                      onMouseUp={() => onHoldStop(true)}
                      onMouseLeave={() => onHoldStop(true)}
                      onTouchEnd={() => onHoldStop(true)}
                      aria-label={`${isPrime ? 'Prime' : 'Normal'} level for ${row.name || row.item_name || 'item'}`}
                    >
                      <span className="flex w-full min-w-0 items-center justify-between gap-1">
                        <span className="tabular-nums">{current}</span>
                        <span
                          className={`inline-flex shrink-0 flex-col text-[9px] leading-[0.7] ${
                            levelMaxed ? 'opacity-90' : 'opacity-80'
                          }`}
                        >
                          <span>▲</span>
                          <span>▼</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </td>
          <td className="status-cell">
            <div className="status-cell-inner justify-center">
              <div className="flex flex-col gap-1">
                {visibleVariants.map((variant) => {
                  const isPrime = variant === 'prime';
                  const relevance = row.advanced_relevance?.[variant];
                  const progress = row.advanced_progress?.[variant];
                  const enabled = Boolean(relevance?.valence);
                  const current = progress?.valence_percent ?? 25;
                  const valenceMax = 60;
                  const valenceMaxed = enabled && current >= valenceMax;
                  const key = isPrime ? 'valence_percent_prime' : 'valence_percent';
                  return (
                    <button
                      key={`valence-${variant}`}
                      type="button"
                      className={`status-btn helminth-btn ${
                        !enabled ? 'unavailable' : valenceMaxed ? 'yes' : 'empty'
                      } min-w-[82px] px-2 py-1 text-xs`}
                      disabled={!enabled}
                      onMouseDown={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const direction: 1 | -1 =
                          event.clientY < rect.top + rect.height / 2 ? 1 : -1;
                        onHoldStart(
                          current,
                          direction,
                          25,
                          valenceMax,
                          (next) => {
                            updateAdvancedProgressLocal(row.id, {
                              [key]: next,
                            } as AdvancedLocalPatch);
                          },
                          (next) => {
                            void onAdvancedPatch(row, { [key]: next } as AdvancedPatch);
                          },
                        );
                      }}
                      onMouseUp={() => onHoldStop(true)}
                      onMouseLeave={() => onHoldStop(true)}
                      onTouchEnd={() => onHoldStop(true)}
                      aria-label={`${isPrime ? 'Prime' : 'Normal'} valence for ${row.name || row.item_name || 'item'}`}
                    >
                      <span className="flex w-full min-w-0 items-center justify-between gap-1">
                        <span className="tabular-nums">{current}</span>
                        <span
                          className={`inline-flex shrink-0 flex-col text-[9px] leading-[0.7] ${
                            valenceMaxed ? 'opacity-90' : 'opacity-80'
                          }`}
                        >
                          <span>▲</span>
                          <span>▼</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </td>
          {(
            [
              ['has_element', 'element'],
              ['has_orokin', 'orokin'],
              ['has_arcane', 'arcane'],
              ['has_exilus', 'exilus'],
            ] as const
          ).map(([field, relevanceField]) => (
            <td key={`${row.id}-${field}`} className="status-cell">
              <div className="status-cell-inner justify-center">
                <div className="flex flex-col gap-1">
                  {visibleVariants.map((variant) => {
                    const isPrime = variant === 'prime';
                    const checked = Boolean(
                      isPrime
                        ? row.advanced_progress?.prime[
                            field as keyof NonNullable<Row['advanced_progress']>['prime']
                          ]
                        : row.advanced_progress?.normal[
                            field as keyof NonNullable<Row['advanced_progress']>['normal']
                          ],
                    );
                    const relevant = Boolean(
                      row.advanced_relevance?.[variant][
                        relevanceField as keyof NonNullable<Row['advanced_relevance']>['normal']
                      ],
                    );
                    const variantRelevance = row.advanced_relevance?.[variant];
                    const lockedOrokinAuto =
                      field === 'has_orokin' && checked && Boolean(variantRelevance?.auto_orokin);
                    const lockedWarframeArcaneAuto =
                      field === 'has_arcane' && relevant && currentWorksheetName === 'Warframes';
                    const interactive = relevant && !lockedOrokinAuto && !lockedWarframeArcaneAuto;
                    const lockedActive = lockedOrokinAuto || (lockedWarframeArcaneAuto && checked);
                    const key = isPrime ? `${field}_prime` : field;
                    return (
                      <button
                        key={`${row.id}-${key}`}
                        type="button"
                        className={`${advancedToggleClass(checked, interactive, lockedActive)} min-w-[82px] px-2 py-1 text-xs`}
                        disabled={!interactive}
                        tabIndex={lockedActive ? -1 : undefined}
                        onClick={() => {
                          void onAdvancedPatch(row, {
                            [key]: !checked,
                          } as AdvancedPatch);
                        }}
                        aria-label={`${isPrime ? 'Prime' : 'Normal'} ${field.replace('has_', '')} for ${row.name || row.item_name || 'item'}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span>{advancedToggleGlyph(checked, interactive, lockedActive)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </td>
          ))}
        </>
      ) : (
        columns.map((column) => {
          const value = row.values?.[String(column.id)] ?? '';
          const rowLabel = row.name || row.item_name || 'item';
          const showInlineMarket = inlineMarketLayout && column.name !== 'Helminth';
          const variantHref = showInlineMarket
            ? isArcanesSheet || !/prime/i.test(column.name)
              ? (row.market_href_normal ?? row.market_href)
              : row.market_href_prime
            : undefined;

          const helminthLocked = column.name === 'Helminth' && isHelminthNonSubsumableRow(row);
          const helminthAria =
            column.name === 'Helminth'
              ? value === 'Yes'
                ? `Helminth subsumed for ${rowLabel}`
                : value === 'Unavailable' || helminthLocked
                  ? `Helminth not applicable for ${rowLabel}`
                  : `Helminth not completed for ${rowLabel}`
              : `${column.name} status for ${rowLabel}`;
          const statusButton = (
            <button
              type="button"
              className={statusClass(value, column.name, row)}
              onClick={() => {
                void onToggle(row, column);
              }}
              aria-label={helminthAria}
              disabled={value === 'Unavailable' || helminthLocked}
            >
              {column.name === 'Helminth' ? helminthCellGlyph(value, row) : value || '—'}
            </button>
          );

          return (
            <td key={`${row.id}-${column.id}`} className="status-cell">
              {showInlineMarket ? (
                <div className="status-cell-inner">
                  {statusButton}
                  {variantHref ? (
                    <a
                      href={variantHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="status-btn helminth-btn empty text-primary hover:text-primary/90 inline-flex shrink-0 no-underline"
                      aria-label={`Warframe Market (${column.name}) for ${rowLabel}`}
                      title="Open Warframe Market"
                    >
                      <MaterialSymbol
                        name="link_2"
                        className="leading-none"
                        style={{ fontSize: 15 }}
                      />
                    </a>
                  ) : (
                    <span
                      className="status-btn helminth-btn unavailable inline-flex shrink-0 cursor-not-allowed"
                      aria-disabled="true"
                      title="Not listed on Warframe Market"
                      aria-label={`No Warframe Market listing (${column.name}) for ${rowLabel}`}
                    >
                      <MaterialSymbol
                        name="link_2"
                        className="leading-none"
                        style={{ fontSize: 15 }}
                      />
                    </span>
                  )}
                </div>
              ) : (
                statusButton
              )}
            </td>
          );
        })
      )}
      {effectiveMarketLinks && !inlineMarketLayout ? (
        <td className="status-cell">
          {row.market_href ? (
            <a
              href={row.market_href}
              target="_blank"
              rel="noopener noreferrer"
              className="status-btn empty text-primary hover:text-primary/90 inline-flex shrink-0 no-underline"
              aria-label={`Warframe Market sell listings for ${row.name || row.item_name || 'item'}`}
              title="Open Warframe Market"
            >
              <MaterialSymbol name="link_2" className="leading-none" style={{ fontSize: 15 }} />
            </a>
          ) : (
            <span
              className="status-btn unavailable inline-flex shrink-0 cursor-not-allowed"
              aria-disabled="true"
              title="Not listed on Warframe Market"
              aria-label={`No Warframe Market listing for ${row.name || row.item_name || 'item'}`}
            >
              <MaterialSymbol name="link_2" className="leading-none" style={{ fontSize: 15 }} />
            </span>
          )}
        </td>
      ) : null}
    </tr>
  );
});

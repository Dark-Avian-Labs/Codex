import { isHelminthNonSubsumableItemName } from '@codex/game-warframe/helminth-exceptions';

import type { WarframeColumn, WarframeRow } from '../../../shared/warframeTypes.js';
import { HELMINTH_CYCLE, STATUS_CYCLE } from './warframeConstants.js';

export function rowItemLabel(row: WarframeRow): string {
  return row.name || row.item_name || '';
}

export function isHelminthNonSubsumableRow(row: WarframeRow): boolean {
  return isHelminthNonSubsumableItemName(rowItemLabel(row));
}

export function helminthCellGlyph(value: string, row: WarframeRow): string {
  if (value === 'Yes') return '\u2713';
  if (value === 'Unavailable' || isHelminthNonSubsumableRow(row)) return '\u2717';
  return '\u2014';
}

export function nextStatus(current: string, columnName: string): string {
  const cycle = columnName === 'Helminth' ? HELMINTH_CYCLE : STATUS_CYCLE;
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1 + cycle.length) % cycle.length];
}

export function statusClass(value: string, columnName: string, row?: WarframeRow): string {
  if (columnName === 'Helminth') {
    if (row && isHelminthNonSubsumableRow(row)) {
      return 'status-btn helminth-btn unavailable';
    }
    if (value === 'Yes') return 'status-btn helminth-btn yes';
    if (value === 'Unavailable') return 'status-btn helminth-btn unavailable';
    return 'status-btn helminth-btn empty';
  }
  return `status-btn ${value.toLowerCase() || 'empty'}`;
}

export function advancedToggleClass(
  checked: boolean,
  interactive: boolean,
  lockedActive?: boolean,
): string {
  if (lockedActive && checked) {
    return 'status-btn helminth-btn yes cursor-default border-success/35 bg-success/10 text-success/80';
  }
  if (!interactive) return 'status-btn helminth-btn unavailable';
  if (checked) return 'status-btn helminth-btn yes';
  return 'status-btn helminth-btn empty';
}

export function advancedToggleGlyph(
  checked: boolean,
  interactive: boolean,
  lockedActive?: boolean,
): string {
  if (lockedActive && checked) return '\u2713';
  if (!interactive) return '\u2717';
  if (checked) return '\u2713';
  return '\u2014';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isRowClassicCompleted(row: WarframeRow, columns: WarframeColumn[]): boolean {
  const coreColumns = columns.filter((column) => column.name !== 'Helminth');
  if (coreColumns.length === 0) {
    return false;
  }

  const relevantCoreColumns = coreColumns.filter((column) => {
    const value = row.values?.[String(column.id)] ?? '';
    return value !== 'Unavailable';
  });
  if (relevantCoreColumns.length === 0) {
    return false;
  }

  const hasAllCoreComplete = relevantCoreColumns.every((column) => {
    const value = row.values?.[String(column.id)] ?? '';
    return value === 'Complete';
  });
  if (!hasAllCoreComplete) {
    return false;
  }

  const helminthColumn = columns.find((column) => column.name === 'Helminth');
  if (!helminthColumn) {
    return true;
  }

  const helminthValue = row.values?.[String(helminthColumn.id)] ?? '';
  if (isHelminthNonSubsumableItemName(rowItemLabel(row))) {
    return helminthValue === 'Unavailable' || helminthValue === '';
  }
  return helminthValue === 'Yes';
}

export function advancedVariantsVisible(
  row: WarframeRow,
  showAllVariants: boolean,
): Array<'normal' | 'prime'> {
  const hasPrime = Boolean(row.advanced_relevance?.has_prime_variant);
  if (showAllVariants) {
    return hasPrime ? ['normal', 'prime'] : ['normal'];
  }
  return hasPrime ? ['prime'] : ['normal'];
}

export function isRowAdvancedCompleted(row: WarframeRow, showAllVariants: boolean): boolean {
  const progress = row.advanced_progress;
  const relevance = row.advanced_relevance;
  if (!progress || !relevance) return false;
  const variants = advancedVariantsVisible(row, showAllVariants);
  for (const variant of variants) {
    const p = progress[variant];
    const r = relevance[variant];
    if (p.level < r.max_level) return false;
    if (r.valence && (p.valence_percent ?? 0) < 60) return false;
    if (r.element && !p.has_element) return false;
    if (r.orokin && !p.has_orokin) return false;
    if (r.arcane && !p.has_arcane) return false;
    if (r.exilus && !p.has_exilus) return false;
  }
  return true;
}

export function isRowCompleted(
  row: WarframeRow,
  columns: WarframeColumn[],
  advancedMode: boolean,
  showAllVariants: boolean,
): boolean {
  return advancedMode
    ? isRowAdvancedCompleted(row, showAllVariants)
    : isRowClassicCompleted(row, columns);
}

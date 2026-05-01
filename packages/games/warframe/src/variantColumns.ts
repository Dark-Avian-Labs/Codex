const HELMINTH = 'Helminth';

export type VariantColumns = {
  baseColumnIds: number[];
  primeColumnIds: number[];
};

export function resolveVariantColumns(
  columns: Array<{ id: number; name: string }>,
): VariantColumns {
  const baseColumnIds: number[] = [];
  const primeColumnIds: number[] = [];
  for (const column of columns) {
    if (column.name === HELMINTH) continue;
    if (/prime/i.test(column.name)) {
      primeColumnIds.push(column.id);
      continue;
    }
    baseColumnIds.push(column.id);
  }
  return { baseColumnIds, primeColumnIds };
}

export function worksheetHasNormalAndPrimeColumns(
  columns: Array<{ id: number; name: string }>,
): boolean {
  const { baseColumnIds, primeColumnIds } = resolveVariantColumns(columns);
  return baseColumnIds.length > 0 && primeColumnIds.length > 0;
}

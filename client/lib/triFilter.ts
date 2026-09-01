export type FilterTriState = 'off' | 'include' | 'exclude';

export type TriFilterMap = Record<string, 'include' | 'exclude'>;

export function cycleTriState(state: FilterTriState): FilterTriState {
  if (state === 'off') return 'include';
  if (state === 'include') return 'exclude';
  return 'off';
}

export function cycleTriFilter(map: TriFilterMap, key: string): TriFilterMap {
  const current = map[key];
  if (current === undefined) {
    return { ...map, [key]: 'include' };
  }
  if (current === 'include') {
    return { ...map, [key]: 'exclude' };
  }
  const next = { ...map };
  delete next[key];
  return next;
}

export function triFilterState(map: TriFilterMap, key: string): FilterTriState {
  return map[key] ?? 'off';
}

export function pruneTriFilter(map: TriFilterMap, allowedKeys: readonly string[]): TriFilterMap {
  const allowed = new Set(allowedKeys);
  let changed = false;
  const next: TriFilterMap = {};
  for (const [key, mode] of Object.entries(map)) {
    if (!allowed.has(key)) {
      changed = true;
      continue;
    }
    next[key] = mode;
  }
  return changed ? next : map;
}

function splitTriFilter(map: TriFilterMap): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const [key, mode] of Object.entries(map)) {
    if (mode === 'include') include.push(key);
    else if (mode === 'exclude') exclude.push(key);
  }
  return { include, exclude };
}

export function matchesAnyTriFilter(
  values: readonly (string | number | null | undefined)[],
  map: TriFilterMap,
): boolean {
  const present = values
    .filter((value): value is string | number => value != null && value !== '')
    .map((value) => String(value));
  const { include, exclude } = splitTriFilter(map);
  if (exclude.some((key) => present.includes(key))) return false;
  if (include.length > 0 && !include.some((key) => present.includes(key))) return false;
  return true;
}

export function matchesTriFilter(
  value: string | number | null | undefined,
  map: TriFilterMap,
): boolean {
  return matchesAnyTriFilter(value == null || value === '' ? [] : [value], map);
}

export function matchesBoolTri(flag: boolean, state: FilterTriState): boolean {
  if (state === 'include') return flag;
  if (state === 'exclude') return !flag;
  return true;
}

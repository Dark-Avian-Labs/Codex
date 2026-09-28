export function abilityPathBasename(uniqueName: string): string {
  const i = uniqueName.lastIndexOf('/');
  return i >= 0 ? uniqueName.slice(i + 1) : uniqueName;
}

export function helminthPathTier(uniqueName: string): number {
  if (uniqueName.includes('/Abilities/')) return 0;
  if (uniqueName.includes('/PowersuitAbilities/')) return 1;
  return 2;
}

export function compareHelminthAbilityPaths(
  a: { unique_name: string },
  b: { unique_name: string },
): number {
  const ta = helminthPathTier(a.unique_name);
  const tb = helminthPathTier(b.unique_name);
  if (ta !== tb) return ta - tb;
  return a.unique_name.localeCompare(b.unique_name);
}

export function resolveHelminthReplacementAbility<T extends { unique_name: string }>(
  storedUniqueName: string,
  candidates: readonly T[],
): T | undefined {
  if (!storedUniqueName || candidates.length === 0) return undefined;

  const base = abilityPathBasename(storedUniqueName);
  const basenameMatches = candidates.filter((c) => abilityPathBasename(c.unique_name) === base);
  if (basenameMatches.length > 0) {
    return [...basenameMatches].sort(compareHelminthAbilityPaths)[0];
  }

  return candidates.find((c) => c.unique_name === storedUniqueName);
}

export function dedupeHelminthAbilityRows<T extends { unique_name: string; name?: string }>(
  rows: T[],
): T[] {
  const byBasename = new Map<string, T[]>();
  for (const row of rows) {
    const base = abilityPathBasename(row.unique_name);
    const list = byBasename.get(base);
    if (list) list.push(row);
    else byBasename.set(base, [row]);
  }
  const out: T[] = [];
  for (const list of byBasename.values()) {
    out.push([...list].sort(compareHelminthAbilityPaths)[0]);
  }
  out.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  return out;
}

export function canonicalHelminthReplacementUniqueName(
  storedUniqueName: string,
  candidates: readonly { unique_name: string }[],
): string {
  return (
    resolveHelminthReplacementAbility(storedUniqueName, candidates)?.unique_name ?? storedUniqueName
  );
}

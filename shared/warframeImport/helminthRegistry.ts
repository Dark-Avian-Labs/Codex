import {
  abilityPathBasename,
  resolveHelminthReplacementAbility,
} from './helminthAbilityResolve.js';
import {
  HELMINTH_REGISTRY_ENTRIES,
  type HelminthRegistryEntry,
} from './helminthRegistry.generated.js';

export type { HelminthRegistryEntry };
export { HELMINTH_REGISTRY_ENTRIES };

const ARMORY_HELMINTH_PREFIX = '/Armory/Helminth/';

const byArmoryKey = new Map<string, HelminthRegistryEntry>();
const byDePath = new Map<string, HelminthRegistryEntry>();

for (const entry of HELMINTH_REGISTRY_ENTRIES) {
  byArmoryKey.set(entry.armory_key, entry);
  for (const dePath of entry.de_paths) {
    byDePath.set(dePath, entry);
  }
}

export function buildHelminthKey(slug: string): string {
  return `${ARMORY_HELMINTH_PREFIX}${slug}`;
}

export function parseHelminthKey(key: string): string | null {
  if (!key.startsWith(ARMORY_HELMINTH_PREFIX)) return null;
  const slug = key.slice(ARMORY_HELMINTH_PREFIX.length);
  return slug.length > 0 ? slug : null;
}

export function helminthEntryByArmoryKey(key: string): HelminthRegistryEntry | undefined {
  return byArmoryKey.get(key);
}

export function helminthEntryByDePath(dePath: string): HelminthRegistryEntry | undefined {
  const direct = byDePath.get(dePath);
  if (direct) return direct;

  const base = abilityPathBasename(dePath);
  for (const entry of HELMINTH_REGISTRY_ENTRIES) {
    if (entry.de_paths.some((p) => abilityPathBasename(p) === base)) {
      return entry;
    }
  }
  return undefined;
}

export function resolveHelminthArmoryKey(stored: string, displayName?: string): string | undefined {
  if (stored.startsWith(ARMORY_HELMINTH_PREFIX)) {
    const entry = helminthEntryByArmoryKey(stored);
    if (entry) return entry.armory_key;
  } else {
    const entry = helminthEntryByDePath(stored);
    if (entry) return entry.armory_key;
  }

  if (displayName) {
    const normalized = displayName.trim().toLowerCase();
    const byName = HELMINTH_REGISTRY_ENTRIES.find(
      (e) => e.name.trim().toLowerCase() === normalized,
    );
    if (byName) return byName.armory_key;
  }

  return undefined;
}

export function resolveHelminthDePath(
  armoryKey: string,
  candidates?: readonly { unique_name: string }[],
): string | undefined {
  const entry = helminthEntryByArmoryKey(armoryKey);
  if (!entry) return undefined;
  if (!candidates || candidates.length === 0) {
    return entry.de_paths[0];
  }
  const resolved = resolveHelminthReplacementAbility(entry.de_paths[0], candidates);
  if (resolved) return resolved.unique_name;
  for (const dePath of entry.de_paths) {
    const match = resolveHelminthReplacementAbility(dePath, candidates);
    if (match) return match.unique_name;
  }
  return entry.de_paths[0];
}

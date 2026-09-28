export const AP_DISABLED = 'AP_DISABLED' as const;

export const ARTIFACT_SLOT_STORAGE_VALUES = new Set([
  'AP_UNIVERSAL',
  AP_DISABLED,
  'AP_ATTACK',
  'AP_DEFENSE',
  'AP_TACTIC',
  'AP_WARD',
  'AP_POWER',
  'AP_PRECEPT',
  'AP_UMBRA',
  'AP_ANY',
]);

export function isArtifactSlotDisabled(ap: string | undefined): boolean {
  return ap === AP_DISABLED;
}

export function hasMeaningfulArtifactSlotOverrides(artifactSlots: string[]): boolean {
  return artifactSlots.some((ap) => ap === AP_DISABLED || (ap !== 'AP_UNIVERSAL' && ap.length > 0));
}

export function isArtifactSlotVisible(
  artifactSlots: string[],
  index: number,
  hasArtifactSlots: boolean,
): boolean {
  if (!hasArtifactSlots) return true;
  if (index >= artifactSlots.length) return false;
  return !isArtifactSlotDisabled(artifactSlots[index]);
}

export function warframeSecondAuraArtifactIndex(generalSlots = 8): number {
  return generalSlots + 1;
}

export function warframeExilusArtifactIndex(artifactSlots: string[], generalSlots = 8): number {
  const normalized = normalizeWarframeArtifactSlotsForLoad(artifactSlots, generalSlots);
  return normalized.length >= WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT
    ? generalSlots + 2
    : generalSlots + 1;
}

export function normalizeWarframeArtifactSlotsForLoad(
  artifactSlots: string[],
  generalSlots = 8,
): string[] {
  if (artifactSlots.length < WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT) {
    return [...artifactSlots];
  }

  const secondAuraIndex = warframeSecondAuraArtifactIndex(generalSlots);
  const exilusIndex = generalSlots + 2;
  const ap9 = artifactSlots[secondAuraIndex];
  const ap10 = artifactSlots[exilusIndex];

  if (ap9 === AP_DISABLED) {
    return [...artifactSlots];
  }

  if (ap9 !== 'AP_UNIVERSAL' && ap9 !== AP_DISABLED) {
    return [...artifactSlots];
  }

  if (ap10 === 'AP_UNIVERSAL' || ap10 === AP_DISABLED) {
    const exilusAp = ap10 === AP_DISABLED ? 'AP_UNIVERSAL' : ap10;
    return [...artifactSlots.slice(0, secondAuraIndex), exilusAp];
  }

  return [...artifactSlots];
}

export function warframeUsesExtendedArtifactLayout(
  artifactSlots: string[],
  generalSlots = 8,
): boolean {
  return (
    normalizeWarframeArtifactSlotsForLoad(artifactSlots, generalSlots).length >=
    WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT
  );
}

export function warframeSecondAuraApFromStorage(artifactSlots: string[], generalSlots = 8): string {
  const normalized = normalizeWarframeArtifactSlotsForLoad(artifactSlots, generalSlots);
  if (!warframeUsesExtendedArtifactLayout(artifactSlots, generalSlots)) return AP_DISABLED;
  return normalized[warframeSecondAuraArtifactIndex(generalSlots)] ?? AP_DISABLED;
}

export function isWarframeSecondAuraSlotActive(artifactSlots: string[], generalSlots = 8): boolean {
  if (!warframeUsesExtendedArtifactLayout(artifactSlots, generalSlots)) return false;
  return !isArtifactSlotDisabled(warframeSecondAuraApFromStorage(artifactSlots, generalSlots));
}

export function warframeArtifactWriteIndex(
  rowId: string,
  artifactIndex: number,
  extendedLayout: boolean,
  generalSlots = 8,
): number {
  if (rowId === 'aura-2') return warframeSecondAuraArtifactIndex(generalSlots);
  if (rowId === 'exilus') return extendedLayout ? generalSlots + 2 : generalSlots + 1;
  return artifactIndex;
}

export const WARFRAME_COMPACT_ARTIFACT_SLOT_COUNT = 10;
export const WARFRAME_EXTENDED_ARTIFACT_SLOT_COUNT = 11;

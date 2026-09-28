export const UNRELEASED_ARCANE_UNIQUE_NAMES = [
  '/Lotus/Upgrades/CosmeticEnhancers/Utility/SlowerBleedOutOnPredeath',
] as const;

export function isUnreleasedArcane(uniqueName: string): boolean {
  return (UNRELEASED_ARCANE_UNIQUE_NAMES as readonly string[]).includes(uniqueName);
}

export function resolveArcaneImportRarity(rarity: unknown): string {
  if (typeof rarity === 'string' && rarity.trim() !== '') {
    return rarity.trim();
  }
  return 'COMMON';
}

export const ARCANE_PUBLIC_LIST_SQL = `unique_name NOT LIKE '%Sub'
  AND unique_name NOT IN (${UNRELEASED_ARCANE_UNIQUE_NAMES.map(() => '?').join(', ')})`;

export function bindArcanePublicListParams(): string[] {
  return [...UNRELEASED_ARCANE_UNIQUE_NAMES];
}

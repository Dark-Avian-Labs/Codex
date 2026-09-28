export function isOperatorOnlyArcane(uniqueNameRaw: unknown, nameRaw?: unknown): boolean {
  const uniqueName = String(uniqueNameRaw ?? '').toLowerCase();
  const name = String(nameRaw ?? '').toLowerCase();
  return (
    uniqueName.includes('/operatoramps/') ||
    uniqueName.includes('/operatorarmour/') ||
    name.startsWith('magus ') ||
    name.startsWith('virtuos ')
  );
}

export type ArcaneCompatTag =
  | 'warframe'
  | 'primary'
  | 'secondary'
  | 'melee'
  | 'weapon'
  | 'kitgun'
  | 'zaw'
  | 'operator'
  | 'amp';

export function classifyArcaneCompatTags(
  uniqueNameRaw: unknown,
  nameRaw: unknown,
): ArcaneCompatTag[] {
  const uniqueName = String(uniqueNameRaw ?? '').toLowerCase();
  const name = String(nameRaw ?? '').toLowerCase();
  const tags = new Set<ArcaneCompatTag>();

  if (uniqueName.includes('/operatoramps/') || name.startsWith('virtuos ')) {
    tags.add('amp');
  }
  if (
    uniqueName.includes('/operatorarmour/') ||
    (uniqueName.includes('/operator') &&
      !uniqueName.includes('/operatoramps/') &&
      !uniqueName.includes('/operatorarmour/')) ||
    name.startsWith('magus ') ||
    name.includes(' operator ')
  ) {
    tags.add('operator');
  }
  if (name.startsWith('pax ')) {
    tags.add('kitgun');
    tags.add('secondary');
    tags.add('weapon');
  }
  if (name.startsWith('exodia ')) {
    tags.add('zaw');
    tags.add('melee');
    tags.add('weapon');
  }
  if (
    name.startsWith('primary ') ||
    name.startsWith('fractalized ') ||
    name.includes('longbow') ||
    uniqueName.includes('longbow')
  ) {
    tags.add('primary');
  }
  if (
    name.startsWith('secondary ') ||
    name.startsWith('akimbo ') ||
    name.startsWith('cascadia ') ||
    name.startsWith('conjunction ') ||
    uniqueName.includes('secondary')
  ) {
    tags.add('secondary');
  }
  if (name.startsWith('melee ') || name.includes(' melee ')) {
    tags.add('melee');
  }
  const lacksPrimarySecondaryMelee =
    !tags.has('primary') && !tags.has('secondary') && !tags.has('melee');
  if (
    name.startsWith('residual ') ||
    name.startsWith('theorem ') ||
    (lacksPrimarySecondaryMelee &&
      (name.includes('merciless') || name.includes('dexterity') || name.includes('deadhead')))
  ) {
    tags.add('weapon');
  }

  if (uniqueName.includes('/zariman/')) {
    if (/\bamp\b/i.test(name)) tags.add('amp');
    if (/\boperator\b/i.test(name)) tags.add('operator');
    if (/\bprimary\b/i.test(name)) tags.add('primary');
    if (/\bsecondary\b/i.test(name)) tags.add('secondary');
    if (/\bmelee\b/i.test(name)) tags.add('melee');
  }

  if (
    !isOperatorOnlyArcane(uniqueName, name) &&
    !tags.has('amp') &&
    !tags.has('operator') &&
    !tags.has('kitgun') &&
    !tags.has('zaw') &&
    !tags.has('primary') &&
    !tags.has('secondary') &&
    !tags.has('melee')
  ) {
    tags.add('warframe');
  }

  return Array.from(tags).sort();
}

export const HELMINTH_NON_SUBSUMABLE_ITEM_NAMES = ['Excalibur Umbra'] as const;

export function isHelminthNonSubsumableItemName(itemName: string): boolean {
  return (HELMINTH_NON_SUBSUMABLE_ITEM_NAMES as readonly string[]).includes(itemName.trim());
}

export function isValidHelminthCellValue(itemName: string, value: string): boolean {
  if (isHelminthNonSubsumableItemName(itemName)) {
    return value === 'Unavailable';
  }
  return value === '' || value === 'Yes';
}

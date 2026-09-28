export const SIRIUS_ORION_PICKER_LABEL = 'Sirius & Orion';

export const SIRIUS_SUIT_UNIQUE_NAME = '/Lotus/Powersuits/SiriusOrion/SiriusSuit';
export const ORION_SUIT_UNIQUE_NAME = '/Lotus/Powersuits/SiriusOrion/OrionSuit';

export type SiriusOrionFormId = 'sirius' | 'orion';

export type SiriusOrionForm = {
  id: SiriusOrionFormId;
  uniqueName: typeof SIRIUS_SUIT_UNIQUE_NAME | typeof ORION_SUIT_UNIQUE_NAME;
  formLabel: string;
  catalogName: string;
};

export const SIRIUS_ORION_FORMS: readonly SiriusOrionForm[] = [
  {
    id: 'sirius',
    uniqueName: SIRIUS_SUIT_UNIQUE_NAME,
    formLabel: 'Sirius',
    catalogName: 'Sirius & Orion',
  },
  {
    id: 'orion',
    uniqueName: ORION_SUIT_UNIQUE_NAME,
    formLabel: 'Orion',
    catalogName: 'Orion & Sirius',
  },
] as const;

export const DEFAULT_SIRIUS_ORION_FORM = SIRIUS_ORION_FORMS[0];

const FORM_BY_UNIQUE_NAME = new Map<string, SiriusOrionForm>(
  SIRIUS_ORION_FORMS.map((form) => [form.uniqueName, form]),
);

export const SIRIUS_ORION_SCRAPE_NAME_ALIASES: Readonly<Record<string, string>> = {
  'sirius & orion': SIRIUS_SUIT_UNIQUE_NAME,
  'orion & sirius': ORION_SUIT_UNIQUE_NAME,
};

export function isSiriusOrionUniqueName(uniqueName: string): boolean {
  return FORM_BY_UNIQUE_NAME.has(uniqueName);
}

export function getSiriusOrionFormByUniqueName(uniqueName: string): SiriusOrionForm | null {
  return FORM_BY_UNIQUE_NAME.get(uniqueName) ?? null;
}

export function getSiriusOrionSiblingForm(uniqueName: string): SiriusOrionForm | null {
  const form = getSiriusOrionFormByUniqueName(uniqueName);
  if (!form) return null;
  return SIRIUS_ORION_FORMS.find((entry) => entry.id !== form.id) ?? null;
}

export function resolveSiriusOrionUniqueNameFromScrapeName(name: string): string | null {
  const key = name.trim().toLowerCase();
  return SIRIUS_ORION_SCRAPE_NAME_ALIASES[key] ?? null;
}

export function formatSiriusOrionBuildDisplayName(uniqueName: string): string | null {
  const form = getSiriusOrionFormByUniqueName(uniqueName);
  if (!form) return null;
  return `${SIRIUS_ORION_PICKER_LABEL} (${form.formLabel})`;
}

export function formatSiriusOrionWarframeHeading(equipment: {
  unique_name: string;
  name?: string | null;
}): string {
  return formatSiriusOrionBuildDisplayName(equipment.unique_name) ?? equipment.name?.trim() ?? '';
}

export function siriusOrionEquipmentSaveName(equipment: {
  unique_name: string;
  name?: string | null;
}): string {
  return formatSiriusOrionWarframeHeading(equipment);
}

export function isPlayableWarframeCatalogItem(item: {
  unique_name: string;
  product_category?: string | null;
}): boolean {
  if (isSiriusOrionUniqueName(item.unique_name)) return true;
  const cat = item.product_category?.trim();
  return !cat || cat === 'Suits';
}

export function prepareSiriusOrionWarframePickerItems<
  T extends { unique_name: string; name: string },
>(items: T[]): T[] {
  return items.map((item) => {
    const label = formatSiriusOrionBuildDisplayName(item.unique_name);
    if (!label) return item;
    return { ...item, name: label };
  });
}

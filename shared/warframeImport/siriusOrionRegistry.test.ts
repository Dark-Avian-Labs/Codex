import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SIRIUS_ORION_FORM,
  ORION_SUIT_UNIQUE_NAME,
  SIRIUS_ORION_PICKER_LABEL,
  SIRIUS_SUIT_UNIQUE_NAME,
  formatSiriusOrionBuildDisplayName,
  getSiriusOrionSiblingForm,
  isPlayableWarframeCatalogItem,
  isSiriusOrionUniqueName,
  prepareSiriusOrionWarframePickerItems,
  resolveSiriusOrionUniqueNameFromScrapeName,
  siriusOrionEquipmentSaveName,
} from './siriusOrionRegistry.js';

describe('siriusOrionRegistry', () => {
  it('identifies both catalog forms', () => {
    expect(isSiriusOrionUniqueName(SIRIUS_SUIT_UNIQUE_NAME)).toBe(true);
    expect(isSiriusOrionUniqueName(ORION_SUIT_UNIQUE_NAME)).toBe(true);
    expect(isSiriusOrionUniqueName('/Lotus/Powersuits/Excalibur/Excalibur')).toBe(false);
  });

  it('returns the sibling form', () => {
    expect(getSiriusOrionSiblingForm(SIRIUS_SUIT_UNIQUE_NAME)?.uniqueName).toBe(ORION_SUIT_UNIQUE_NAME);
    expect(getSiriusOrionSiblingForm(ORION_SUIT_UNIQUE_NAME)?.uniqueName).toBe(SIRIUS_SUIT_UNIQUE_NAME);
  });

  it('formats both forms with the shared picker prefix', () => {
    expect(formatSiriusOrionBuildDisplayName(SIRIUS_SUIT_UNIQUE_NAME)).toBe(`${SIRIUS_ORION_PICKER_LABEL} (Sirius)`);
    expect(formatSiriusOrionBuildDisplayName(ORION_SUIT_UNIQUE_NAME)).toBe(`${SIRIUS_ORION_PICKER_LABEL} (Orion)`);
    expect(siriusOrionEquipmentSaveName({ unique_name: ORION_SUIT_UNIQUE_NAME, name: 'Orion & Sirius' })).toBe(
      `${SIRIUS_ORION_PICKER_LABEL} (Orion)`,
    );
  });

  it('includes both forms in the playable warframe catalog filter', () => {
    expect(
      isPlayableWarframeCatalogItem({
        unique_name: SIRIUS_SUIT_UNIQUE_NAME,
        product_category: 'Suits',
      }),
    ).toBe(true);
    expect(
      isPlayableWarframeCatalogItem({
        unique_name: ORION_SUIT_UNIQUE_NAME,
        product_category: 'SpecialItems',
      }),
    ).toBe(true);
    expect(
      isPlayableWarframeCatalogItem({
        unique_name: '/Lotus/Powersuits/Excalibur/Excalibur',
        product_category: 'Suits',
      }),
    ).toBe(true);
    expect(
      isPlayableWarframeCatalogItem({
        unique_name: '/Lotus/Powersuits/Sevagoth/SevagothShadow',
        product_category: 'SpecialItems',
      }),
    ).toBe(false);
  });

  it('labels both picker entries distinctly', () => {
    const items = prepareSiriusOrionWarframePickerItems([
      { unique_name: SIRIUS_SUIT_UNIQUE_NAME, name: 'Sirius & Orion' },
      { unique_name: ORION_SUIT_UNIQUE_NAME, name: 'Orion & Sirius' },
      { unique_name: '/Lotus/Powersuits/Excalibur/Excalibur', name: 'Excalibur' },
    ]);
    expect(items.map((item) => item.name)).toEqual([
      `${SIRIUS_ORION_PICKER_LABEL} (Sirius)`,
      `${SIRIUS_ORION_PICKER_LABEL} (Orion)`,
      'Excalibur',
    ]);
  });

  it('maps scrape names to unique names', () => {
    expect(resolveSiriusOrionUniqueNameFromScrapeName('Sirius & Orion')).toBe(SIRIUS_SUIT_UNIQUE_NAME);
    expect(resolveSiriusOrionUniqueNameFromScrapeName('Orion & Sirius')).toBe(ORION_SUIT_UNIQUE_NAME);
  });

  it('defaults to Sirius', () => {
    expect(DEFAULT_SIRIUS_ORION_FORM.uniqueName).toBe(SIRIUS_SUIT_UNIQUE_NAME);
  });
});

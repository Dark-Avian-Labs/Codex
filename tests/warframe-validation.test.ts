import { describe, expect, it } from 'vitest';

import {
  MAX_WARFRAME_CELL_VALUE_LENGTH,
  MAX_WARFRAME_ITEM_NAME_LENGTH,
  addRowSchema,
  adminUpdateSchema,
  deleteRowSchema,
  editRowSchema,
  patchSettingsSchema,
  updateAdvancedProgressSchema,
  updateSchema,
} from '../packages/games/warframe/src/routes/validation.js';

describe('Warframe validation schemas', () => {
  describe('updateSchema', () => {
    it('rejects structurally invalid bodies (upgrade / client bugs)', () => {
      expect(updateSchema.safeParse({ row_id: [], column_id: 1, value: 'x' }).success).toBe(false);
      expect(updateSchema.safeParse({ row_id: 1, column_id: {}, value: 'x' }).success).toBe(false);
      expect(updateSchema.safeParse({ row_id: Number.NaN, column_id: 1 }).success).toBe(false);
    });

    it('accepts valid input', () => {
      const r = updateSchema.safeParse({
        row_id: 1,
        column_id: 2,
        value: 'Obtained',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.row_id).toBe(1);
        expect(r.data.column_id).toBe(2);
        expect(r.data.value).toBe('Obtained');
      }
    });

    it('defaults empty value to ""', () => {
      const r = updateSchema.safeParse({ row_id: 1, column_id: 2 });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.value).toBe('');
    });

    it('trims value', () => {
      const r = updateSchema.safeParse({
        row_id: 1,
        column_id: 2,
        value: '  Complete  ',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.value).toBe('Complete');
    });

    it('rejects non-positive row_id', () => {
      expect(updateSchema.safeParse({ row_id: 0, column_id: 1, value: '' }).success).toBe(false);
    });

    it('coerces string IDs', () => {
      const r = updateSchema.safeParse({
        row_id: '3',
        column_id: '7',
        value: '',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.row_id).toBe(3);
        expect(r.data.column_id).toBe(7);
      }
    });
  });

  describe('addRowSchema', () => {
    it('accepts valid input', () => {
      const r = addRowSchema.safeParse({
        worksheet_id: 1,
        item_name: 'Excalibur',
        values: { '1': 'Obtained' },
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.item_name).toBe('Excalibur');
        expect(r.data.values).toEqual({ '1': 'Obtained' });
      }
    });

    it('defaults values to empty object', () => {
      const r = addRowSchema.safeParse({
        worksheet_id: 1,
        item_name: 'Mag',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.values).toEqual({});
    });

    it('rejects empty item_name', () => {
      expect(addRowSchema.safeParse({ worksheet_id: 1, item_name: '' }).success).toBe(false);
    });

    it('rejects non-positive worksheet_id', () => {
      expect(addRowSchema.safeParse({ worksheet_id: -1, item_name: 'Test' }).success).toBe(false);
    });

    it('rejects zero worksheet_id', () => {
      expect(addRowSchema.safeParse({ worksheet_id: 0, item_name: 'Test' }).success).toBe(false);
    });
  });

  describe('editRowSchema', () => {
    it('accepts valid input', () => {
      const r = editRowSchema.safeParse({
        row_id: 5,
        item_name: 'Rhino',
        values: {},
      });
      expect(r.success).toBe(true);
    });

    it('accepts null item_name', () => {
      const r = editRowSchema.safeParse({ row_id: 5, item_name: null });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.item_name).toBeNull();
    });

    it('defaults item_name to null when absent', () => {
      const r = editRowSchema.safeParse({ row_id: 5 });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.item_name).toBeNull();
    });
  });

  describe('deleteRowSchema', () => {
    it('accepts positive row_id', () => {
      expect(deleteRowSchema.safeParse({ row_id: 10 }).success).toBe(true);
    });

    it('rejects zero', () => {
      expect(deleteRowSchema.safeParse({ row_id: 0 }).success).toBe(false);
    });

    it('rejects negative row_id', () => {
      expect(deleteRowSchema.safeParse({ row_id: -1 }).success).toBe(false);
    });
  });

  describe('adminUpdateSchema', () => {
    it('accepts valid input', () => {
      const r = adminUpdateSchema.safeParse({
        row_id: 1,
        column_id: 2,
        value: 'Unavailable',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('updateAdvancedProgressSchema', () => {
    it('rejects empty patch with no fields', () => {
      expect(updateAdvancedProgressSchema.safeParse({ row_id: 1 }).success).toBe(false);
    });

    it('accepts single-field updates', () => {
      expect(updateAdvancedProgressSchema.safeParse({ row_id: 1, level: 5 }).success).toBe(true);
      expect(updateAdvancedProgressSchema.safeParse({ row_id: 1, has_arcane: true }).success).toBe(true);
    });

    it('accepts each additional optional field as a valid single-field patch', () => {
      const singleFieldPatches = [
        { row_id: 1, level_prime: 5 },
        { row_id: 1, valence_percent_prime: 25 },
        { row_id: 1, has_element: true },
        { row_id: 1, has_element_prime: true },
        { row_id: 1, has_orokin: true },
        { row_id: 1, has_orokin_prime: true },
        { row_id: 1, has_arcane_prime: true },
        { row_id: 1, has_exilus: true },
        { row_id: 1, has_exilus_prime: true },
      ];

      for (const patch of singleFieldPatches) {
        expect(updateAdvancedProgressSchema.safeParse(patch).success).toBe(true);
      }
    });

    it('rejects out-of-range level', () => {
      expect(updateAdvancedProgressSchema.safeParse({ row_id: 1, level: 999 }).success).toBe(false);
    });

    it('rejects out-of-range valence_percent', () => {
      expect(updateAdvancedProgressSchema.safeParse({ row_id: 1, valence_percent: 999 }).success).toBe(false);
    });
  });

  describe('string length limits', () => {
    it('rejects item names over MAX_WARFRAME_ITEM_NAME_LENGTH', () => {
      expect(
        addRowSchema.safeParse({
          worksheet_id: 1,
          item_name: 'n'.repeat(MAX_WARFRAME_ITEM_NAME_LENGTH + 1),
        }).success,
      ).toBe(false);
    });

    it('rejects cell values over MAX_WARFRAME_CELL_VALUE_LENGTH', () => {
      expect(
        updateSchema.safeParse({
          row_id: 1,
          column_id: 2,
          value: 'x'.repeat(MAX_WARFRAME_CELL_VALUE_LENGTH + 1),
        }).success,
      ).toBe(false);
    });

    it('requires at least one settings field in patchSettingsSchema', () => {
      expect(patchSettingsSchema.safeParse({}).success).toBe(false);
      expect(patchSettingsSchema.safeParse({ hide_completed: true }).success).toBe(true);
    });
  });
});

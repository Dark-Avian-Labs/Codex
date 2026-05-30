import { positiveInt, z } from '@codex/core/validation';

import { ABSOLUTE_MAX_ADVANCED_LEVEL } from '../advancedRules.js';
import { VALENCE_PERCENT_MAX_STORED, VALENCE_PERCENT_MIN } from '../config.js';

export const MAX_WARFRAME_ITEM_NAME_LENGTH = 255;
export const MAX_WARFRAME_CELL_VALUE_LENGTH = 64;
export const MAX_WARFRAME_RECORD_VALUE_LENGTH = 64;

const cellValue = z.string().trim().max(MAX_WARFRAME_CELL_VALUE_LENGTH).default('');
const recordValue = z.string().trim().max(MAX_WARFRAME_RECORD_VALUE_LENGTH);
const itemName = z
  .string()
  .trim()
  .min(1, 'Item name is required.')
  .max(MAX_WARFRAME_ITEM_NAME_LENGTH);
const itemNameNullable = z
  .string()
  .trim()
  .max(MAX_WARFRAME_ITEM_NAME_LENGTH)
  .nullable()
  .default(null);

export const patchSettingsSchema = z
  .object({
    hide_completed: z.boolean().optional(),
    market_links: z.boolean().optional(),
    advanced_mode: z.boolean().optional(),
    show_all_variants: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.hide_completed === undefined &&
      value.market_links === undefined &&
      value.advanced_mode === undefined &&
      value.show_all_variants === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide at least one of hide_completed, market_links, advanced_mode, show_all_variants as a boolean.',
      });
    }
  });

export const updateSchema = z.object({
  row_id: positiveInt,
  column_id: positiveInt,
  value: cellValue,
});

export const addRowSchema = z.object({
  worksheet_id: positiveInt,
  item_name: itemName,
  values: z.record(z.string(), recordValue).optional().default({}),
});

export const editRowSchema = z.object({
  row_id: positiveInt,
  item_name: itemNameNullable,
  values: z.record(z.string(), recordValue).optional().default({}),
});

export const deleteRowSchema = z.object({
  row_id: positiveInt,
});

export const adminUpdateSchema = updateSchema;

export const updateAdvancedProgressSchema = z
  .object({
    row_id: positiveInt,
    level: z.number().int().min(0).max(ABSOLUTE_MAX_ADVANCED_LEVEL).optional(),
    level_prime: z.number().int().min(0).max(ABSOLUTE_MAX_ADVANCED_LEVEL).optional(),
    valence_percent: z
      .number()
      .int()
      .min(VALENCE_PERCENT_MIN)
      .max(VALENCE_PERCENT_MAX_STORED)
      .nullable()
      .optional(),
    valence_percent_prime: z
      .number()
      .int()
      .min(VALENCE_PERCENT_MIN)
      .max(VALENCE_PERCENT_MAX_STORED)
      .nullable()
      .optional(),
    has_element: z.boolean().optional(),
    has_element_prime: z.boolean().optional(),
    has_orokin: z.boolean().optional(),
    has_orokin_prime: z.boolean().optional(),
    has_arcane: z.boolean().optional(),
    has_arcane_prime: z.boolean().optional(),
    has_exilus: z.boolean().optional(),
    has_exilus_prime: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.level === undefined &&
      value.level_prime === undefined &&
      value.valence_percent === undefined &&
      value.valence_percent_prime === undefined &&
      value.has_element === undefined &&
      value.has_element_prime === undefined &&
      value.has_orokin === undefined &&
      value.has_orokin_prime === undefined &&
      value.has_arcane === undefined &&
      value.has_arcane_prime === undefined &&
      value.has_exilus === undefined &&
      value.has_exilus_prime === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one advanced progress field.',
      });
    }
  });

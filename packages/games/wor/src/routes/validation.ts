import { optionalPositiveInt, positiveInt, z } from '@codex/core/validation';

import { ARTIFACT_PROMOTION_MAX, HERO_AWAKENING_MAX } from '../config.js';

export const MAX_WOR_NAME_LENGTH = 255;
export const MAX_WOR_ACCOUNT_NAME_LENGTH = 128;

const worName = z
  .string()
  .trim()
  .min(1, 'Name is required.')
  .max(MAX_WOR_NAME_LENGTH, `Name must be at most ${MAX_WOR_NAME_LENGTH} characters.`);
const worAccountName = z
  .string()
  .trim()
  .min(1, 'Account name is required.')
  .max(
    MAX_WOR_ACCOUNT_NAME_LENGTH,
    `Account name must be at most ${MAX_WOR_ACCOUNT_NAME_LENGTH} characters.`,
  );

export const updateOwnedSchema = z.object({
  owned: z.coerce.number().int().min(0).max(1),
});

export const updateHeroGaugeSchema = z.object({
  hero_id: positiveInt,
  gauge_level: z.coerce.number().int().min(0).max(HERO_AWAKENING_MAX),
});

export const updateArtifactGaugeSchema = z.object({
  artifact_id: positiveInt,
  gauge_level: z.coerce.number().int().min(0).max(ARTIFACT_PROMOTION_MAX),
});

export const updateDemonGaugeSchema = z.object({
  demon_id: positiveInt,
  gauge_level: z.coerce.number().int().min(0).max(20),
});

export const switchAccountSchema = z.object({
  account_id: positiveInt,
});

export const addAccountSchema = z.object({
  account_name: worAccountName,
});

export const updateAccountSchema = z.object({
  account_id: positiveInt,
  account_name: worAccountName,
});

export const deleteAccountSchema = z.object({
  account_id: positiveInt,
});

export const adminImportRunSchema = z.object({
  forceImport: z.boolean().optional(),
  forceImages: z.boolean().optional(),
  forceSteps: z.array(z.string()).optional(),
});

export const adminOverridesSchema = z.object({
  heroes: z.record(z.string(), z.unknown()).optional(),
  artifacts: z.record(z.string(), z.unknown()).optional(),
  demons: z.record(z.string(), z.unknown()).optional(),
});

const optionalCatalogSlug = z.string().trim().min(1).optional();

export const addHeroSchema = z.object({
  name: worName,
  catalog_hero_slug: optionalCatalogSlug,
});

export const addArtifactSchema = z.object({
  name: worName,
  catalog_artifact_slug: optionalCatalogSlug,
});

export const addDemonSchema = z.object({
  name: worName,
  catalog_demon_slug: optionalCatalogSlug,
});

export const deleteHeroSchema = z.object({
  hero_id: positiveInt,
});

export const deleteArtifactSchema = z.object({
  artifact_id: positiveInt,
});

export const deleteDemonSchema = z.object({
  demon_id: positiveInt,
});

export const updateHeroDetailsSchema = z.object({
  hero_id: positiveInt,
  name: worName,
});

export const updateArtifactDetailsSchema = z.object({
  artifact_id: positiveInt,
  name: worName,
});

export const updateDemonDetailsSchema = z.object({
  demon_id: positiveInt,
  name: worName,
});

export const ownedParamSchemas = {
  hero_id: positiveInt,
  artifact_id: positiveInt,
  demon_id: positiveInt,
};

export { optionalPositiveInt };

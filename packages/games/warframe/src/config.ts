import path from 'path';

export const WARFRAME_DB_PATH =
  process.env.WARFRAME_DB_PATH?.trim() ||
  path.join(process.env.DATA_DIR ?? './data', 'warframe.db');

export const VALID_STATUSES = ['', 'Obtained', 'Complete', 'Unavailable'] as const;
export type ValidStatus = (typeof VALID_STATUSES)[number];

export const VALENCE_PERCENT_MIN = 25;
export const VALENCE_PERCENT_MAX_STORED = 60;
export const VALENCE_COMPLETE_THRESHOLD = 58;

export function isValidStatus(value: string): value is ValidStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

export const HELMINTH_VALUES = ['', 'Yes'] as const;
export type HelminthValue = (typeof HELMINTH_VALUES)[number];

export function isHelminthValue(value: string): value is HelminthValue {
  return (HELMINTH_VALUES as readonly string[]).includes(value);
}

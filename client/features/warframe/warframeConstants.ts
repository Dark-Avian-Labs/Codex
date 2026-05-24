import type { CSSProperties } from 'react';

export type ExitRowPhase = 'fill' | 'push';

export const STATUS_CYCLE = ['', 'Obtained', 'Complete'];
export const HELMINTH_CYCLE = ['', 'Yes'];

export const TAB_ORDER = [
  'Warframes',
  'Primary Weapons',
  'Secondary Weapons',
  'Melee Weapons',
  'Modular Weapons',
  'K-Drives',
  'Companions',
  'Companion Weapons',
  'Archwing Weapons',
  'Accessories',
] as const;

export const WORKSHEET_LABELS: Record<string, string> = {
  Warframes: 'Warframes',
  'Primary Weapons': 'Primary',
  'Secondary Weapons': 'Secondary',
  'Melee Weapons': 'Melee',
  'Modular Weapons': 'Modular',
  'K-Drives': 'K-Drives',
  Companions: 'Companions',
  'Companion Weapons': 'Companion Weapons',
  'Archwing Weapons': 'Archwing',
  Accessories: 'Accessories',
};

export const tableScrollStyle = {
  '--header-offset': '320px',
} as CSSProperties;

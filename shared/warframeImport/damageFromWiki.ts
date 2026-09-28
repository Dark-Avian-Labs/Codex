import { DAMAGE_PER_SHOT_LENGTH } from './damageFromFireBehaviors.js';

export const WIKI_DAMAGE_TYPE_TO_INDEX: Record<string, number> = {
  Impact: 0,
  Puncture: 1,
  Slash: 2,
  Heat: 3,
  Cold: 4,
  Electricity: 5,
  Toxin: 6,
  Blast: 7,
  Radiation: 8,
  Gas: 9,
  Magnetic: 10,
  Viral: 11,
  Corrosive: 12,
};

export interface WikiDamageEntry {
  type: string;
  value: number;
}

export function parseWikiDamageCellText(text: string): WikiDamageEntry[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const pattern =
    /\b(Impact|Puncture|Slash|Heat|Cold|Electricity|Toxin|Blast|Radiation|Gas|Magnetic|Viral|Corrosive)\b\s+(\d+(?:\.\d+)?)/gi;

  const entries: WikiDamageEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    entries.push({
      type: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(),
      value: Number.parseFloat(match[2]),
    });
  }

  return entries;
}

export function damagePerShotFromWikiEntries(entries: WikiDamageEntry[]): number[] | null {
  const damage = Array.from({ length: DAMAGE_PER_SHOT_LENGTH }, () => 0);

  for (const entry of entries) {
    const index = WIKI_DAMAGE_TYPE_TO_INDEX[entry.type];
    if (index == null || entry.value <= 0) continue;
    damage[index] += entry.value;
  }

  return damage.some((value) => value > 0) ? damage : null;
}

export function serializeDamagePerShot(damage: number[]): string {
  return JSON.stringify(damage);
}

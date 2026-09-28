import type { IncarnonStatModifier, IncarnonStatName } from './incarnonTypes.js';

const STAT_PATTERNS: Array<{
  pattern: RegExp;
  stat: IncarnonStatName;
  mode: 'flat' | 'percent';
  group?: number;
}> = [
  {
    pattern: /Increase Base Damage by \+(\d+(?:\.\d+)?)/i,
    stat: 'baseDamage',
    mode: 'flat',
  },
  {
    pattern: /Increase Base Magazine Capacity by \+(\d+)/i,
    stat: 'magazineSize',
    mode: 'flat',
  },
  {
    pattern: /Increase Base Critical Chance by \+(\d+(?:\.\d+)?)%/i,
    stat: 'critChance',
    mode: 'percent',
  },
  {
    pattern: /Increase Base Status Chance by \+(\d+(?:\.\d+)?)%/i,
    stat: 'statusChance',
    mode: 'percent',
  },
  {
    pattern: /\+(\d+(?:\.\d+)?)% Critical Chance/i,
    stat: 'critChance',
    mode: 'percent',
  },
  {
    pattern: /\+(\d+(?:\.\d+)?)% Status Chance/i,
    stat: 'statusChance',
    mode: 'percent',
  },
  {
    pattern: /\+(\d+(?:\.\d+)?)% Reload Speed/i,
    stat: 'reloadSpeed',
    mode: 'percent',
  },
  {
    pattern: /\+(\d+(?:\.\d+)?)% Projectile Speed/i,
    stat: 'projectileSpeed',
    mode: 'percent',
  },
  {
    pattern: /\+(\d+(?:\.\d+)?)% Accuracy/i,
    stat: 'accuracy',
    mode: 'percent',
  },
  {
    pattern: /\+(\d+(?:\.\d+)?)% Fire Rate/i,
    stat: 'fireRate',
    mode: 'percent',
  },
  {
    pattern: /Punch Through \+(\d+(?:\.\d+)?)/i,
    stat: 'punchThrough',
    mode: 'flat',
  },
];

export function extractStatModifiers(description: string): IncarnonStatModifier[] {
  const modifiers: IncarnonStatModifier[] = [];
  const seen = new Set<string>();

  for (const { pattern, stat, mode } of STAT_PATTERNS) {
    const match = description.match(pattern);
    if (!match) continue;
    const value = parseFloat(match[1]);
    if (!Number.isFinite(value)) continue;
    const key = `${stat}:${mode}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    modifiers.push({ stat, mode, value: mode === 'percent' ? value / 100 : value });
  }

  return modifiers;
}

export function substitutePlaceholders(template: string, valueCell: string): string {
  const trimmed = valueCell.trim();
  if (!trimmed || trimmed === '-') {
    return template.replace(/\b[XY]\b/g, '?');
  }

  let result = template;
  const xMatch = trimmed.match(/X\s*=\s*(\d+(?:\.\d+)?%?)/i);
  const yMatch = trimmed.match(/Y\s*=\s*(\d+(?:\.\d+)?%?)/i);

  if (xMatch) {
    const xVal = xMatch[1];
    result = result
      .replace(/\+X%/gi, `+${xVal.endsWith('%') ? xVal : `${xVal}%`}`)
      .replace(/\+X\b/gi, `+${xVal.replace(/%$/, '')}`)
      .replace(/\bX%/gi, xVal.endsWith('%') ? xVal : `${xVal}%`)
      .replace(/\bX\b/gi, xVal.replace(/%$/, ''));
  }

  if (yMatch) {
    const yVal = yMatch[1].replace(/%$/, '');
    result = result
      .replace(/\+Y%/gi, `+${yVal}%`)
      .replace(/\+Y\b/gi, `+${yVal}`)
      .replace(/\bY%/gi, `${yVal}%`)
      .replace(/\bY(?=x\b)/gi, yVal)
      .replace(/\bY\b/gi, yVal);
  }

  if (!xMatch && !yMatch && !template.includes('X') && !template.includes('Y')) {
    return template;
  }

  if (!xMatch && !yMatch) {
    return `${template} (${trimmed})`;
  }

  return result;
}

export function normalizeWikiText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

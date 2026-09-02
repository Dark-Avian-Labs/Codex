export type WikiHeroBaseStats = {
  hp: number | null;
  atk: number | null;
  def: number | null;
  mdef: number | null;
  block: number | null;
  cost: number | null;
  atkInterval: number | null;
  rrAuto: number | null;
  rrAttack: number | null;
  rrAttacked: number | null;
};

const FIELD_MAP = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  mdef: 'mdef',
  block: 'block',
  cost: 'cost',
  atkinterval: 'atkInterval',
  rr_auto: 'rrAuto',
  rr_attack: 'rrAttack',
  rr_attacked: 'rrAttacked',
} as const satisfies Record<string, keyof WikiHeroBaseStats>;

function parseWikiNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function extractHeroTemplate(wikitext: string): string | null {
  const start = wikitext.search(/\{\{Hero[\s|]/);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i += 1) {
    const pair = wikitext.slice(i, i + 2);
    if (pair === '{{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (pair === '}}') {
      depth -= 1;
      i += 1;
      if (depth === 0) {
        return wikitext.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseHeroInfobox(wikitext: string): WikiHeroBaseStats | null {
  const template = extractHeroTemplate(wikitext);
  if (!template) return null;

  const stats: WikiHeroBaseStats = {
    hp: null,
    atk: null,
    def: null,
    mdef: null,
    block: null,
    cost: null,
    atkInterval: null,
    rrAuto: null,
    rrAttack: null,
    rrAttacked: null,
  };

  const fieldPattern = /\|\s*([A-Za-z0-9_]+)\s*=\s*([^\n]*)/g;
  for (const match of template.matchAll(fieldPattern)) {
    const key = match[1]?.trim().toLowerCase();
    const mapped = key ? FIELD_MAP[key as keyof typeof FIELD_MAP] : undefined;
    if (!mapped) continue;
    stats[mapped] = parseWikiNumber(match[2] ?? '');
  }

  const hasAny = Object.values(stats).some((value) => value != null);
  return hasAny ? stats : null;
}

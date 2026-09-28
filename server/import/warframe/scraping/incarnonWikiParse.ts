import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

import {
  extractStatModifiers,
  normalizeWikiText,
  substitutePlaceholders,
} from './incarnonStatModifiers.js';
import type {
  IncarnonEvolutionTier,
  IncarnonPerkOption,
  ParsedGenesisPage,
  ParsedIntrinsicPage,
} from './incarnonTypes.js';

const EVO_TIER_RE = /^EVO(\d+)$/i;
const CHALLENGE_RE = /^Evolution(?:\s+[IVXLCDM]+)?\s+Challenge$/i;

export function extractFileNameFromCell($: CheerioAPI, cell: Element): string | null {
  const fileLink = $(cell).find('a[href*="/File:"]').first();
  const href = fileLink.attr('href');
  if (!href) return null;
  const match = href.match(/\/File:(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function parseCompatibleWeaponNames($: CheerioAPI): string[] {
  const intro = $('#mw-content-text p')
    .filter((_, p) => normalizeWikiText($(p).text()).includes('add Incarnon upgrades to the'))
    .first();

  const names = new Set<string>();
  intro.find('a[href^="/w/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (
      href.includes('Incarnon') ||
      href.includes('The_') ||
      href.includes('Steel_Path') ||
      href.includes('Cavalero')
    ) {
      return;
    }
    const title = normalizeWikiText($(a).attr('title') || $(a).text());
    if (title && title.length > 1 && title.length < 80) {
      names.add(title);
    }
  });

  return [...names];
}

function mapHeaderToWeaponName(header: string, compatibleWeaponNames: string[]): string | null {
  const normalizedHeader = normalizeWikiText(header);
  if (!normalizedHeader || normalizedHeader.toLowerCase() === 'evolution') {
    return null;
  }
  if (normalizedHeader.toLowerCase() === 'notes') {
    return null;
  }

  const exact = compatibleWeaponNames.find(
    (name) => name.toLowerCase() === normalizedHeader.toLowerCase(),
  );
  if (exact) return exact;

  const startsWith = compatibleWeaponNames.find((name) =>
    name.toLowerCase().startsWith(normalizedHeader.toLowerCase()),
  );
  if (startsWith) return startsWith;

  const endsWith = compatibleWeaponNames.find((name) =>
    name.toLowerCase().endsWith(normalizedHeader.toLowerCase()),
  );
  if (endsWith) return endsWith;

  const contains = compatibleWeaponNames.find((name) =>
    name.toLowerCase().includes(normalizedHeader.toLowerCase()),
  );
  return contains ?? null;
}

function parseGenesisRowLayout(texts: string[]): {
  perkNameIndex: number;
  templateIndex: number;
  weaponValueStart: number;
  notesIndex: number;
} {
  const hasTierCell = parseTierNumber(texts[0] ?? '') !== null;
  const notesIndex = Math.max(0, texts.length - 1);
  if (hasTierCell) {
    return { perkNameIndex: 1, templateIndex: 2, weaponValueStart: 3, notesIndex };
  }
  return { perkNameIndex: 0, templateIndex: 1, weaponValueStart: 2, notesIndex };
}

function extractWeaponValuesFromRow(
  cells: Element[],
  texts: string[],
  weaponValueStart: number,
  weaponCount: number,
  $: CheerioAPI,
): string[] {
  const values = Array.from({ length: weaponCount }, () => '-');
  let logicalCol = 0;

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
    const colspan = parseInt($(cells[cellIndex]).attr('colspan') ?? '1', 10);
    const text = texts[cellIndex] ?? '-';
    for (let w = 0; w < weaponCount; w++) {
      const weaponCol = weaponValueStart + w;
      if (weaponCol >= logicalCol && weaponCol < logicalCol + colspan) {
        values[w] = text;
      }
    }
    logicalCol += colspan;
  }

  return values;
}

function resolveWeaponNamesFromHeaders(
  headerWeaponLabels: string[],
  compatibleWeaponNames: string[],
): string[] {
  const names: string[] = [];
  for (const label of headerWeaponLabels) {
    const resolved = mapHeaderToWeaponName(label, compatibleWeaponNames);
    if (resolved) names.push(resolved);
  }
  return names;
}

function parseTierNumber(cell: string): number | null {
  const match = normalizeWikiText(cell).match(EVO_TIER_RE);
  return match ? parseInt(match[1], 10) : null;
}

function makePerkOption(
  $: CheerioAPI,
  name: string,
  description: string,
  notes: string | undefined,
  nameCell: Element | null,
): IncarnonPerkOption & { imageFile?: string } {
  const fileName = nameCell ? extractFileNameFromCell($, nameCell) : null;
  const resolvedDescription = normalizeWikiText(description);
  return {
    name: normalizeWikiText(name),
    description: resolvedDescription,
    notes: notes ? normalizeWikiText(notes) : undefined,
    imageFile: fileName ?? undefined,
    statModifiers: extractStatModifiers(resolvedDescription),
  };
}

function findEvolutionsTable($: CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  const h3 = $('#Evolutions').closest('.mw-heading');
  const table = h3.nextAll('table.wikitable').first();
  return table.length > 0 ? table : null;
}

function parseGenesisTableFromCheerio(
  $: CheerioAPI,
  compatibleWeaponNames: string[],
): {
  weaponColumnNames: string[];
  tiers: IncarnonEvolutionTier[];
  weaponEvolutions: Map<string, IncarnonEvolutionTier[]>;
} {
  type ExtendedPerkOption = IncarnonPerkOption & {
    imageFile?: string;
    weaponDescriptions?: Map<string, string>;
  };

  const table = findEvolutionsTable($);
  if (!table) {
    return { weaponColumnNames: [], tiers: [], weaponEvolutions: new Map() };
  }

  const headerCells: string[] = [];
  table
    .find('tr')
    .first()
    .find('th,td')
    .each((_, c) => {
      headerCells.push(normalizeWikiText($(c).text()));
    });

  const weaponColumnNames = headerCells.slice(1, -1);
  const resolvedWeaponNames = resolveWeaponNamesFromHeaders(
    weaponColumnNames,
    compatibleWeaponNames,
  );

  const tierData = new Map<number, IncarnonEvolutionTier>();
  let currentTier: IncarnonEvolutionTier | null = null;

  table
    .find('tr')
    .slice(1)
    .each((_, tr) => {
      const cells: Element[] = [];
      $(tr)
        .find('th,td')
        .each((__, c) => {
          cells.push(c);
        });
      if (cells.length === 0) return;

      const texts = cells.map((c) => normalizeWikiText($(c).text()));
      const first = texts[0] ?? '';

      if (CHALLENGE_RE.test(first)) {
        if (currentTier) {
          currentTier.challenge = normalizeWikiText(texts[1] ?? texts.slice(1).join(' '));
        }
        return;
      }

      const tierFromFirst = parseTierNumber(first);
      if (tierFromFirst) {
        currentTier = { tier: tierFromFirst, options: [] };
        tierData.set(tierFromFirst, currentTier);
      }
      if (!currentTier) return;

      const layout = parseGenesisRowLayout(texts);
      const perkName = texts[layout.perkNameIndex] ?? '';
      if (!perkName || CHALLENGE_RE.test(perkName)) return;

      const template = texts[layout.templateIndex] ?? '';
      const notes = texts[layout.notesIndex] || undefined;
      const nameCell = cells[layout.perkNameIndex] ?? null;
      const fileName = nameCell ? extractFileNameFromCell($, nameCell) : null;

      const weaponValues = extractWeaponValuesFromRow(
        cells,
        texts,
        layout.weaponValueStart,
        resolvedWeaponNames.length,
        $,
      );

      const weaponDescriptions = new Map<string, string>();
      for (let w = 0; w < resolvedWeaponNames.length; w++) {
        weaponDescriptions.set(
          resolvedWeaponNames[w],
          substitutePlaceholders(template, weaponValues[w] ?? '-'),
        );
      }

      currentTier.options.push({
        name: normalizeWikiText(perkName),
        description: template,
        notes: notes ? normalizeWikiText(notes) : undefined,
        imageFile: fileName ?? undefined,
        statModifiers: extractStatModifiers(template),
        weaponDescriptions,
      } as ExtendedPerkOption);
    });

  const sortedTiers = [...tierData.values()].sort((a, b) => a.tier - b.tier);

  const tiers: IncarnonEvolutionTier[] = sortedTiers.map((tier) => ({
    tier: tier.tier,
    challenge: tier.challenge,
    options: tier.options.map((opt) => {
      const extended = opt as ExtendedPerkOption;
      return {
        name: opt.name,
        description: extended.description,
        notes: opt.notes,
        imageFile: extended.imageFile,
        statModifiers: opt.statModifiers,
      };
    }),
  }));

  const weaponEvolutions = new Map<string, IncarnonEvolutionTier[]>();
  for (const weaponName of compatibleWeaponNames) {
    const evolutions: IncarnonEvolutionTier[] = [];
    for (const tier of sortedTiers) {
      evolutions.push({
        tier: tier.tier,
        challenge: tier.challenge,
        options: tier.options.map((opt) => {
          const extended = opt as ExtendedPerkOption;
          const description = extended.weaponDescriptions?.get(weaponName) ?? extended.description;
          return {
            name: opt.name,
            description,
            notes: opt.notes,
            imageFile: extended.imageFile,
            statModifiers: extractStatModifiers(description),
          } as ExtendedPerkOption;
        }),
      });
    }
    weaponEvolutions.set(weaponName, evolutions);
  }

  return { weaponColumnNames, tiers, weaponEvolutions };
}

export function parseGenesisPageWithWeaponValues(
  html: string,
  overview?: string,
): ParsedGenesisPage & { weaponEvolutions: Map<string, IncarnonEvolutionTier[]> } {
  const $ = cheerio.load(html);
  const compatibleWeaponNames = parseCompatibleWeaponNames($);
  const { weaponColumnNames, tiers, weaponEvolutions } = parseGenesisTableFromCheerio(
    $,
    compatibleWeaponNames,
  );

  return {
    compatibleWeaponNames,
    weaponColumnNames,
    overview,
    tiers,
    weaponEvolutions,
  };
}

export function parseIntrinsicEvolutionTable($: CheerioAPI): IncarnonEvolutionTier[] {
  const table = findEvolutionsTable($);
  if (!table) return [];

  const tiers: IncarnonEvolutionTier[] = [];
  let currentTier: IncarnonEvolutionTier | null = null;

  table
    .find('tr')
    .slice(1)
    .each((_, tr) => {
      const cells: Element[] = [];
      $(tr)
        .find('th,td')
        .each((__, c) => {
          cells.push(c);
        });
      if (cells.length === 0) return;

      const texts = cells.map((c) => normalizeWikiText($(c).text()));
      const first = texts[0] ?? '';

      if (CHALLENGE_RE.test(first)) {
        if (currentTier) {
          currentTier.challenge = normalizeWikiText(texts[1] ?? texts.slice(1).join(' '));
        }
        return;
      }

      const tierFromFirst = parseTierNumber(first);
      if (tierFromFirst) {
        currentTier = { tier: tierFromFirst, options: [] };
        tiers.push(currentTier);
      }
      if (!currentTier) return;

      const perkName = tierFromFirst ? texts[1] : first;
      if (!perkName) return;

      const description = texts[2] ?? texts[1] ?? '';
      const notes = texts[3] || texts[cells.length - 1] || undefined;
      const nameCell = tierFromFirst ? cells[1] : cells[0];

      currentTier.options.push(
        makePerkOption(
          $,
          perkName,
          description,
          notes !== description ? notes : undefined,
          nameCell,
        ),
      );
    });

  return tiers;
}

export function parseIntrinsicPageHtml(html: string, weaponName: string): ParsedIntrinsicPage {
  const $ = cheerio.load(html);
  const overview = normalizeWikiText($('#Overview').closest('.mw-heading').next('ul').text());
  return {
    weaponName,
    overview: overview || undefined,
    tiers: parseIntrinsicEvolutionTable($),
  };
}

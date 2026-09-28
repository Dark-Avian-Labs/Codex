import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { lookupBeastClawByCompanionName } from '../../../../shared/warframeImport/beastClawRegistry.js';
import {
  damagePerShotFromWikiEntries,
  parseWikiDamageCellText,
  serializeDamagePerShot,
} from '../../../../shared/warframeImport/damageFromWiki.js';

export const BEAST_CLAWS_WIKI_PAGE = 'Claws_(Beast)';

export interface ParsedBeastClawWikiRow {
  companionName: string;
  clawsName: string;
  uniqueName: string;
  totalDamage: number;
  damagePerShot: number[];
  criticalChance: number;
  criticalMultiplier: number;
  procChance: number;
}

export interface ParsedBeastClawsWikiPage {
  revisionId: string | null;
  rows: ParsedBeastClawWikiRow[];
}

function normalizeHeader(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parsePercent(value: string): number {
  const match = value.match(/([\d.]+)/);
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function parseMultiplier(value: string): number {
  const match = value.match(/([\d.]+)/);
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTotalDamage(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTableHeaderIndexes(
  $: cheerio.CheerioAPI,
  table: Element,
): Record<string, number> | null {
  const headerRow = $(table)
    .find('tr')
    .filter((_, row) => $(row).find('th').length > 0)
    .first();
  if (headerRow.length === 0) return null;

  const indexes: Record<string, number> = {};
  headerRow.find('th').each((index, cell) => {
    const key = normalizeHeader($(cell).text());
    if (key) indexes[key] = index;
  });

  if (indexes['companion'] == null || indexes['damage'] == null) {
    return null;
  }

  return indexes;
}

function readCompanionName($: cheerio.CheerioAPI, cell: cheerio.Cheerio<Element>): string {
  const anchor = cell.find('a').first();
  const titled = anchor.attr('title')?.trim();
  if (titled) return titled;
  return cell.text().replace(/\s+/g, ' ').trim();
}

function parseStatsTable($: cheerio.CheerioAPI, table: Element): ParsedBeastClawWikiRow[] {
  const indexes = getTableHeaderIndexes($, table);
  if (!indexes) return [];

  const rows: ParsedBeastClawWikiRow[] = [];

  $(table)
    .find('tr')
    .each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;

      const companionName = readCompanionName($, cells.eq(indexes['companion']));
      if (!companionName) return;

      const registry = lookupBeastClawByCompanionName(companionName);
      if (!registry) return;

      const damageEntries = parseWikiDamageCellText(cells.eq(indexes['damage']).text());
      const damagePerShot = damagePerShotFromWikiEntries(damageEntries);
      if (!damagePerShot) return;

      const totalCell =
        indexes['total damage'] != null ? cells.eq(indexes['total damage']).text() : '';
      const totalDamage =
        parseTotalDamage(totalCell) || damagePerShot.reduce((sum, value) => sum + value, 0);

      const critChanceCell =
        indexes['crit chance (%)'] != null ? cells.eq(indexes['crit chance (%)']).text() : '0';
      const critMultCell =
        indexes['crit multiplier (x)'] != null
          ? cells.eq(indexes['crit multiplier (x)']).text()
          : '0';
      const statusCell =
        indexes['status chance (%)'] != null ? cells.eq(indexes['status chance (%)']).text() : '0';

      rows.push({
        companionName,
        clawsName: registry.clawsName,
        uniqueName: registry.uniqueName,
        totalDamage,
        damagePerShot,
        criticalChance: parsePercent(critChanceCell),
        criticalMultiplier: parseMultiplier(critMultCell),
        procChance: parsePercent(statusCell),
      });
    });

  return rows;
}

export function extractBeastClawsWikiRevisionId(html: string): string | null {
  const oldIdMatch =
    html.match(/Claws_%28Beast%29\?oldid=(\d+)/i) ?? html.match(/Claws_\(Beast\)\?oldid=(\d+)/i);
  if (oldIdMatch?.[1]) return oldIdMatch[1];

  const wgRevisionMatch = html.match(/wgRevisionId:\s*(\d+)/);
  return wgRevisionMatch?.[1] ?? null;
}

export function parseBeastClawsFromWikiHtml(html: string): ParsedBeastClawsWikiPage {
  const $ = cheerio.load(html);
  const rows: ParsedBeastClawWikiRow[] = [];

  $('table.wikitable').each((_, table) => {
    rows.push(...parseStatsTable($, table));
  });

  const byUniqueName = new Map<string, ParsedBeastClawWikiRow>();
  for (const row of rows) {
    byUniqueName.set(row.uniqueName, row);
  }

  return {
    revisionId: extractBeastClawsWikiRevisionId(html),
    rows: [...byUniqueName.values()].sort((a, b) => a.clawsName.localeCompare(b.clawsName)),
  };
}

export function serializeParsedBeastClawDamagePerShot(row: ParsedBeastClawWikiRow): string {
  return serializeDamagePerShot(row.damagePerShot);
}

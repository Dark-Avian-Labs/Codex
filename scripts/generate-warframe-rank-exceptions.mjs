import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(root, 'scripts/data/warframe-rank-exceptions.json');
const outPath = path.join(root, 'shared/warframeImport/warframeRankExceptions.generated.ts');

function formatTsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatBonuses(bonuses) {
  return `{
      health: ${bonuses.health},
      shield: ${bonuses.shield},
      armor: ${bonuses.armor},
      energy: ${bonuses.energy},
    }`;
}

function formatEntries(rows) {
  const items = rows.map(
    (row) => `  {
    uniqueName: ${formatTsString(row.uniqueName)},
    name: ${formatTsString(row.name)},
    bonuses: ${formatBonuses(row.bonuses)},
  }`,
  );
  return `[\n${items.join(',\n')},\n]`;
}

function formatByUniqueName(byUniqueName) {
  const items = Object.entries(byUniqueName).map(
    ([uniqueName, bonuses]) => `  ${formatTsString(uniqueName)}: {
    health: ${bonuses.health},
    shield: ${bonuses.shield},
    armor: ${bonuses.armor},
    energy: ${bonuses.energy},
  }`,
  );
  return `{\n${items.join(',\n')},\n}`;
}

function readSourceRows() {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) {
    throw new Error('warframe-rank-exceptions.json must be an array');
  }

  const byUniqueName = {};
  for (const row of rows) {
    if (!row?.uniqueName || !row?.bonuses) {
      throw new Error(`Invalid row: ${JSON.stringify(row)}`);
    }
    if (byUniqueName[row.uniqueName]) {
      throw new Error(`Duplicate uniqueName: ${row.uniqueName}`);
    }
    byUniqueName[row.uniqueName] = row.bonuses;
  }

  return rows;
}

const rows = readSourceRows();
const byUniqueName = Object.fromEntries(rows.map((row) => [row.uniqueName, row.bonuses]));

const body = `import type { RankStatBonuses } from './equipmentRankStats.js';

export interface WarframeRankExceptionEntry {
  uniqueName: string;
  name: string;
  bonuses: RankStatBonuses;
}

export const WARFRAME_RANK_EXCEPTION_ENTRIES: readonly WarframeRankExceptionEntry[] = ${formatEntries(rows)};

export const WARFRAME_RANK_EXCEPTIONS_BY_UNIQUE_NAME: Readonly<Record<string, RankStatBonuses>> = ${formatByUniqueName(byUniqueName)};
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(`Wrote ${rows.length} entries to ${path.relative(root, outPath)}`);

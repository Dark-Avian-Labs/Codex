import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isUsableEnvValue(value) {
  const trimmed = value?.trim();
  return Boolean(trimmed && !trimmed.startsWith('encrypted:'));
}

function loadEnv() {
  const candidates = [
    path.join(root, '.github', 'ci.env.development'),
    path.join(root, '.env'),
    path.join(root, '.env.development'),
  ];
  for (const file of candidates) {
    parseEnvFile(file);
  }
}

function resolveGameDbPath(envKey, defaultFilename) {
  const raw = isUsableEnvValue(process.env[envKey]) ? process.env[envKey].trim() : '';
  const resolved = raw
    ? path.isAbsolute(raw)
      ? raw
      : path.resolve(root, raw)
    : path.join(root, 'data', defaultFilename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function applyDefaultPragmas(db, pragmas) {
  db.pragma('foreign_keys = ON');
  for (const p of pragmas) {
    db.pragma(p);
  }
}

async function importBuilt(modulePath) {
  const url = pathToFileURL(modulePath).href;
  return import(url);
}

function initDatabase(dbPath, label, runLifecycle) {
  const db = new Database(dbPath);
  try {
    runLifecycle(db);
    console.log(`[db:init] ${label}: ${dbPath}`);
  } finally {
    db.close();
  }
}

loadEnv();
process.env.DATA_DIR = process.env.DATA_DIR?.trim() || path.join(root, 'data');

const warframeDbPath = resolveGameDbPath('WARFRAME_DB_PATH', 'warframe.db');
const epic7DbPath = resolveGameDbPath('EPIC7_DB_PATH', 'epic7.db');
process.env.WARFRAME_DB_PATH = warframeDbPath;
process.env.EPIC7_DB_PATH = epic7DbPath;

const coreDist = path.join(root, 'packages/core/dist/db/sqlitePragmas.js');
const warframeDist = path.join(root, 'packages/games/warframe/dist/db/schema.js');
const epic7Dist = path.join(root, 'packages/games/epic7/dist/db/schema.js');

for (const file of [coreDist, warframeDist, epic7Dist]) {
  if (!fs.existsSync(file)) {
    console.error(
      `[db:init] Missing ${file}. Run: pnpm --filter @codex/core --filter @codex/game-warframe --filter @codex/game-epic7 run build`,
    );
    process.exit(1);
  }
}

const { DEFAULT_SQLITE_PRAGMAS } = await importBuilt(coreDist);
const warframeSchema = await importBuilt(warframeDist);
const epic7Schema = await importBuilt(epic7Dist);

const {
  ensureWarframeCoreTables,
  ensureWarframeCatalogMasterTable,
  ensureWarframeCatalogActiveColumn,
  ensureWarframeRowMarketHrefColumns,
  ensureWarframeRowOrphanColumn,
  ensureWarframeAdvancedProgressTable,
  createSchema: createWarframeSchema,
} = warframeSchema;

const { ensureEpic7CoreTables, ensureUniqueBaseNameIndexes } = epic7Schema;

initDatabase(warframeDbPath, 'warframe', (db) => {
  applyDefaultPragmas(db, DEFAULT_SQLITE_PRAGMAS);
  ensureWarframeCoreTables(db);
  ensureWarframeCatalogMasterTable(db);
  ensureWarframeCatalogActiveColumn(db);
  ensureWarframeRowMarketHrefColumns(db);
  ensureWarframeRowOrphanColumn(db);
  ensureWarframeAdvancedProgressTable(db);
  createWarframeSchema(db, false);
});

initDatabase(epic7DbPath, 'epic7', (db) => {
  applyDefaultPragmas(db, DEFAULT_SQLITE_PRAGMAS);
  ensureEpic7CoreTables(db);
  ensureUniqueBaseNameIndexes(db);
});

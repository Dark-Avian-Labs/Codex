import path from 'path';

import Database from 'better-sqlite3';

import { migrateArtifactSlotsFromOverframe } from './migrateArtifactSlotsFromOverframe.js';

function resolveDbPath(): string {
  const arg = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.db'));
  if (arg) return path.resolve(arg);
  const env = process.env.WARFRAME_CATALOG_DB_PATH?.trim();
  if (env) return path.resolve(env);
  return path.resolve('data', 'warframe-catalog.db');
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  const summary = migrateArtifactSlotsFromOverframe(db, { dryRun });
  db.close();

  const prefix = dryRun ? '[dry-run] ' : '';
  console.log(`${prefix}Artifact slot migration (${dbPath})`);
  console.log(
    `${prefix}Warframes converted: ${summary.warframesConverted}, Jade: ${summary.warframesJadeUpdated}, ` +
      `Necramechs: ${summary.warframesNecramechUpdated}, skipped: ${summary.warframesSkipped}`,
  );
  console.log(
    `${prefix}Weapons converted: ${summary.weaponsConverted}, companions: ${summary.companionsConverted}, ` +
      `weapons skipped: ${summary.weaponsSkipped}`,
  );
}

main();

import { log } from '@codex/core';
import { getWarframeDb } from '@codex/game-warframe';
import Database from 'better-sqlite3';

import { WARFRAME_CATALOG_DB_PATH } from '../../config.js';
import { loadWorksheetSource, syncCatalogMasterFromSource } from '../../services/warframeSync.js';

/**
 * Copy worksheet names from warframe-catalog.db into warframe.db catalog_rows.
 * Does not open WARFRAME_DB_PATH itself — uses the game package singleton.
 * Catalog DB is opened read-only here; the import pipeline owns writes to it.
 */
export function copyCatalogToCollection(): {
  worksheets: number;
  totalNames: number;
} {
  const catalogDb = new Database(WARFRAME_CATALOG_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
  catalogDb.pragma('busy_timeout = 5000');
  try {
    const { sourceByWorksheet, arcaneMaxLevelByCanonicalKey } = loadWorksheetSource(catalogDb);
    const collectionDb = getWarframeDb();
    syncCatalogMasterFromSource(
      collectionDb,
      sourceByWorksheet,
      arcaneMaxLevelByCanonicalKey,
      true,
    );
    let totalNames = 0;
    for (const names of Object.values(sourceByWorksheet)) {
      totalNames += names.size;
    }
    const worksheets = Object.keys(sourceByWorksheet).length;
    log('info', 'Copied Warframe catalog rows into collection DB', {
      worksheets,
      totalNames,
    });
    return { worksheets, totalNames };
  } finally {
    catalogDb.close();
  }
}

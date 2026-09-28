import './config.js';

import { closeSessionDb, getSessionDb, log } from '@codex/core';
import { closeEpic7Db, getEpic7Db } from '@codex/game-epic7';
import { closeWarframeDb, getWarframeDb } from '@codex/game-warframe';
import { closeWorCatalogDb, closeWorDb, getWorCatalogDb, getWorDb } from '@codex/game-wor';

import { createApp } from './app.js';
import {
  APP_ID,
  APP_NAME,
  ensureDataDirs,
  HOST,
  NODE_ENV,
  PORT,
  SHUTDOWN_TIMEOUT_MS,
} from './config.js';
import { ensureSessionSchema } from './db/sessionSchema.js';
import { refreshEpic7DbAvailability } from './epic7DbState.js';
import { startAdminImportJob as startWarframeAdminImportJob } from './import/warframe/adminImportJob.js';
import { recoverImportLeaseOnStartup as recoverWarframeImportLeaseOnStartup } from './import/warframe/importRuns.js';
import { catalogNeedsImport as warframeCatalogNeedsImport } from './import/warframe/startupPipeline.js';
import {
  catalogNeedsImport,
  copyWorCatalogIntoCollectionIfNeeded,
  ensureWorCatalogSeededFromCollection,
  runWorStartupPipeline,
} from './import/wor/startupPipeline.js';
import { createAppSentinelAgent } from './sentinelAgent.js';
import { waitForWarframeSyncIdle } from './services/warframeSyncState.js';
import { refreshWorDbAvailability } from './worDbState.js';

ensureDataDirs();
ensureSessionSchema();
const sessionDb = getSessionDb();
function assertTableExists(db: { prepare: (sql: string) => unknown }, tableName: string): void {
  const row = (
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?") as {
      get: (param: string) => unknown;
    }
  ).get(tableName);
  if (!row) {
    throw new Error(`Required table "${tableName}" was not found.`);
  }
}

function ensureGameSchemasReady(): void {
  const warframeDb = getWarframeDb();
  const epic7Db = getEpic7Db();
  assertTableExists(warframeDb, 'worksheets');
  assertTableExists(warframeDb, 'columns');
  assertTableExists(warframeDb, 'rows');
  assertTableExists(warframeDb, 'cell_values');

  assertTableExists(epic7Db, 'game_accounts');
  assertTableExists(epic7Db, 'base_heroes');
  assertTableExists(epic7Db, 'base_artifacts');
  assertTableExists(epic7Db, 'account_heroes');
  assertTableExists(epic7Db, 'account_artifacts');

  const worDb = getWorDb();
  assertTableExists(worDb, 'game_accounts');
  assertTableExists(worDb, 'catalog_heroes');
  assertTableExists(worDb, 'catalog_artifacts');
  assertTableExists(worDb, 'catalog_demons');
  assertTableExists(worDb, 'account_heroes');
  assertTableExists(worDb, 'account_artifacts');
  assertTableExists(worDb, 'account_demons');
}
ensureGameSchemasReady();
void refreshEpic7DbAvailability();
void refreshWorDbAvailability().then(async () => {
  try {
    ensureWorCatalogSeededFromCollection();
    copyWorCatalogIntoCollectionIfNeeded();
    const catalogDb = getWorCatalogDb();
    if (catalogNeedsImport(catalogDb)) {
      log('info', 'WoR catalog empty — running fixture bootstrap import');
      await runWorStartupPipeline();
    }
  } catch (error) {
    log('error', 'WoR startup catalog bootstrap failed', {
      err: error instanceof Error ? error.message : String(error),
    });
  }
});
void (async () => {
  if (NODE_ENV === 'test') return;
  try {
    recoverWarframeImportLeaseOnStartup();
    if (warframeCatalogNeedsImport()) {
      log('info', 'Warframe catalog empty — running import bootstrap');
      const result = startWarframeAdminImportJob('system:startup');
      if (!result.started) {
        log('warn', 'Warframe startup import could not start', {
          reason: result.reason ?? 'unknown',
        });
      }
    }
  } catch (error) {
    log('error', 'Warframe startup catalog bootstrap failed', {
      err: error instanceof Error ? error.message : String(error),
    });
  }
})();

const sentinelAgent = createAppSentinelAgent({
  appId: APP_ID,
  displayName: APP_NAME,
  nodeEnv: NODE_ENV,
});
const { app, sessionStore } = createApp({
  sessionDb,
  metricsMiddleware: sentinelAgent?.middleware,
});

sentinelAgent?.start();

const server = app.listen(PORT, HOST, () => {
  log('info', `${APP_NAME} server listening`, { host: HOST, port: PORT, nodeEnv: NODE_ENV });
});

let shutdownStarted = false;
function shutdown(baseExitCode = 0, signal?: string): void {
  if (shutdownStarted) return;
  shutdownStarted = true;
  if (baseExitCode === 0) sentinelAgent?.noteGracefulExit(signal);
  else sentinelAgent?.noteCrash(new Error(`shutdown exit ${baseExitCode}`));
  sentinelAgent?.stop();

  function closeAndExit(exitCode: number): void {
    sessionStore.dispose();
    try {
      closeSessionDb();
      closeWarframeDb();
      closeEpic7Db();
      closeWorDb();
      closeWorCatalogDb();
    } catch (err) {
      log('error', 'Failed to close DB connections during shutdown', {
        err: err instanceof Error ? err.message : String(err),
      });
      exitCode = 1;
    }
    // eslint-disable-next-line n/no-process-exit -- explicit process exit required for shutdown lifecycle
    process.exit(exitCode);
  }

  const hardTimeout = setTimeout(() => {
    log('warn', 'Shutdown timeout reached; forcing exit', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    closeAndExit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  void (async () => {
    try {
      const syncFinished = await waitForWarframeSyncIdle(
        Math.max(SHUTDOWN_TIMEOUT_MS - 2000, 1000),
      );
      if (!syncFinished) {
        log('warn', 'Warframe sync still running; proceeding with shutdown');
      }

      server.close((err) => {
        clearTimeout(hardTimeout);
        if (err) {
          log('error', 'HTTP server close failed', {
            err: err instanceof Error ? err.message : String(err),
          });
          closeAndExit(1);
          return;
        }
        closeAndExit(baseExitCode);
      });
      server.closeIdleConnections();
      setTimeout(
        () => {
          server.closeAllConnections();
        },
        Math.max(0, SHUTDOWN_TIMEOUT_MS - 500),
      );
    } catch (err) {
      log('error', 'Unexpected shutdown error', {
        err: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      clearTimeout(hardTimeout);
      closeAndExit(1);
    }
  })();
}
process.on('SIGINT', () => shutdown(0, 'SIGINT'));
process.on('SIGTERM', () => shutdown(0, 'SIGTERM'));

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection; shutting down', {
    err: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  });
  sentinelAgent?.noteCrash(reason);
  shutdown(1);
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception; shutting down', {
    err: err.stack ?? err.message,
  });
  sentinelAgent?.noteCrash(err);
  shutdown(1);
});

export default app;

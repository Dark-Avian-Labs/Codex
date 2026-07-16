import { log } from '@codex/core';
import { validateBody } from '@codex/core/validation';
import {
  ARTIFACT_PROMOTION_MAX,
  getWorDb,
  HERO_AWAKENING_MAX,
  worAddAccountSchema,
  worDeleteAccountSchema,
  worQueries as q,
  worSwitchAccountSchema,
  worUpdateAccountSchema,
  worUpdateArtifactGaugeSchema,
  worUpdateDemonGaugeSchema,
  worUpdateHeroGaugeSchema,
  worUpdateOwnedSchema,
} from '@codex/game-wor';
import { Router, type Request, type Response } from 'express';

import { requireClerkUserId } from '../auth/clerkUser.js';
import {
  clearWorSessionFields,
  ensureWorSessionBoundToClerkUser,
  getWorSession,
  patchWorSession,
} from '../session/worSessionBinding.js';
import { isWorDbAvailable } from '../worDbState.js';

export const worApiRouter = Router();

function json(res: Response, data: object, status = 200): void {
  res.status(status).json(data);
}

function err(res: Response, message: string, status = 400): void {
  res.status(status).json({ error: message });
}

function getDbOrFail(res: Response): ReturnType<typeof getWorDb> | null {
  if (!isWorDbAvailable()) {
    err(res, 'Database not found. Please initialize the database.', 500);
    return null;
  }
  try {
    return getWorDb();
  } catch {
    err(res, 'Database connection failed.', 500);
    return null;
  }
}

type WorDatabase = ReturnType<typeof getWorDb>;

function reconcileWorSessionAccount(
  db: WorDatabase,
  req: Request,
  clerkUserId: string,
): number | null {
  ensureWorSessionBoundToClerkUser(req, clerkUserId);
  const accounts = q.getUserAccountsForApi(db, clerkUserId);
  let currentAccountId = getWorSession(req).wor_account_id ?? null;
  if (typeof currentAccountId === 'number' && currentAccountId > 0) {
    const owned = q.getGameAccountByIdAndUser(db, currentAccountId, clerkUserId);
    if (!owned) {
      clearWorSessionFields(req);
      currentAccountId = null;
    }
  }
  if (currentAccountId === null) {
    const active = accounts.find((account) => account.is_active === 1);
    if (active) {
      currentAccountId = active.id;
      patchWorSession(req, {
        wor_account_id: active.id,
        wor_account_name: active.account_name,
      });
    }
  }
  return currentAccountId;
}

function resolveAccountId(db: WorDatabase, req: Request, clerkUserId: string): number | null {
  return reconcileWorSessionAccount(db, req, clerkUserId);
}

function runWithDb(res: Response, fn: (db: WorDatabase) => void | Promise<void>): void {
  void (async () => {
    const db = getDbOrFail(res);
    if (!db) return;
    try {
      await fn(db);
    } catch (error) {
      if (res.headersSent) {
        log('error', 'WoR handler failed after response started', {
          err: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      const status =
        error instanceof Error && typeof (error as { status?: unknown }).status === 'number'
          ? (error as unknown as { status: number }).status
          : 500;
      if (status >= 400 && status < 500) {
        err(res, (error as Error).message || 'Request failed', status);
        return;
      }
      log('error', 'WoR request failed', {
        err: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      err(res, 'Internal server error', 500);
    }
  })();
}

function requireAccountId(db: WorDatabase, req: Request, res: Response): number | null {
  const clerkUserId = requireClerkUserId(req);
  const accountId = resolveAccountId(db, req, clerkUserId);
  if (!accountId) {
    err(res, 'No game account selected. Please create one first.');
    return null;
  }
  return accountId;
}

worApiRouter.get('/worksheets', (_req, res) => {
  json(res, {
    worksheets: [
      { id: 'heroes', name: 'Heroes' },
      { id: 'artifacts', name: 'Artifacts' },
      { id: 'demons', name: 'Demons' },
    ],
  });
});

worApiRouter.get('/heroes', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const classFilter = String(req.query.class ?? '').trim();
    const factionFilter = String(req.query.faction ?? '').trim();
    const heroes = q.getHeroes(db, accountId, classFilter, factionFilter);
    const stats = q.getHeroStats(db, accountId);
    json(res, { heroes, stats, gauge_max: HERO_AWAKENING_MAX });
  });
});

worApiRouter.get('/artifacts', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const artifacts = q.getArtifacts(db, accountId);
    const stats = q.getArtifactStats(db, accountId);
    json(res, { artifacts, stats, gauge_max: ARTIFACT_PROMOTION_MAX });
  });
});

worApiRouter.get('/demons', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const accountId = resolveAccountId(db, req, clerkUserId);
    if (!accountId) {
      err(res, 'No game account selected. Please create one first.');
      return;
    }
    const demons = q.getDemons(db, accountId);
    const stats = q.getDemonStats(db, accountId);
    json(res, { demons, stats });
  });
});

worApiRouter.patch('/heroes/:heroId/owned', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const data = validateBody(worUpdateOwnedSchema, req.body, res);
    if (!data) return;
    const ok = q.updateHeroOwned(db, Number(req.params.heroId), accountId, data.owned);
    if (!ok) {
      err(res, 'Hero not found', 404);
      return;
    }
    json(res, { ok: true });
  });
});

worApiRouter.patch('/artifacts/:artifactId/owned', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const data = validateBody(worUpdateOwnedSchema, req.body, res);
    if (!data) return;
    const ok = q.updateArtifactOwned(db, Number(req.params.artifactId), accountId, data.owned);
    if (!ok) {
      err(res, 'Artifact not found', 404);
      return;
    }
    json(res, { ok: true });
  });
});

worApiRouter.patch('/demons/:demonId/owned', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const data = validateBody(worUpdateOwnedSchema, req.body, res);
    if (!data) return;
    const ok = q.updateDemonOwned(db, Number(req.params.demonId), accountId, data.owned);
    if (!ok) {
      err(res, 'Demon not found', 404);
      return;
    }
    json(res, { ok: true });
  });
});

worApiRouter.patch('/heroes/:heroId/gauge', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const data = validateBody(
      worUpdateHeroGaugeSchema,
      { ...req.body, hero_id: Number(req.params.heroId) },
      res,
    );
    if (!data) return;
    const ok = q.updateHeroGauge(db, data.hero_id, accountId, data.gauge_level);
    if (!ok) {
      err(res, 'Hero not found or not owned', 404);
      return;
    }
    json(res, { ok: true, gauge_level: data.gauge_level });
  });
});

worApiRouter.patch('/artifacts/:artifactId/gauge', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const data = validateBody(
      worUpdateArtifactGaugeSchema,
      { ...req.body, artifact_id: Number(req.params.artifactId) },
      res,
    );
    if (!data) return;
    const ok = q.updateArtifactGauge(db, data.artifact_id, accountId, data.gauge_level);
    if (!ok) {
      err(res, 'Artifact not found or not owned', 404);
      return;
    }
    json(res, { ok: true, gauge_level: data.gauge_level });
  });
});

worApiRouter.patch('/demons/:demonId/gauge', (req, res) => {
  runWithDb(res, (db) => {
    const accountId = requireAccountId(db, req, res);
    if (!accountId) return;
    const data = validateBody(
      worUpdateDemonGaugeSchema,
      { ...req.body, demon_id: Number(req.params.demonId) },
      res,
    );
    if (!data) return;
    const ok = q.updateDemonGauge(db, data.demon_id, accountId, data.gauge_level);
    if (!ok) {
      err(res, 'Demon not found or not owned', 404);
      return;
    }
    json(res, { ok: true, gauge_level: data.gauge_level });
  });
});

worApiRouter.get('/accounts', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const accounts = q.getUserAccountsForApi(db, clerkUserId);
    const currentAccountId = reconcileWorSessionAccount(db, req, clerkUserId);
    json(res, { accounts, current_account_id: currentAccountId });
  });
});

worApiRouter.post('/accounts/switch', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const data = validateBody(worSwitchAccountSchema, req.body, res);
    if (!data) return;
    const account = q.getGameAccountByIdAndUser(db, data.account_id, clerkUserId);
    if (!account) {
      err(res, 'Account not found', 404);
      return;
    }
    q.setActiveAccount(db, clerkUserId, data.account_id);
    patchWorSession(req, {
      wor_account_id: data.account_id,
      wor_account_name: account.account_name,
    });
    json(res, { ok: true, account_id: data.account_id, account_name: account.account_name });
  });
});

worApiRouter.post('/accounts', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const data = validateBody(worAddAccountSchema, req.body, res);
    if (!data) return;
    const existing = q.getAccountByNameAndUser(db, clerkUserId, data.account_name);
    if (existing) {
      err(res, 'An account with this name already exists.', 409);
      return;
    }
    const accounts = q.getGameAccountsByUserId(db, clerkUserId);
    const isFirst = accounts.length === 0;
    const accountId = q.createGameAccount(db, clerkUserId, data.account_name, isFirst);
    if (isFirst) {
      patchWorSession(req, {
        wor_account_id: accountId,
        wor_account_name: data.account_name,
      });
    }
    json(res, { ok: true, account_id: accountId });
  });
});

worApiRouter.patch('/accounts/:accountId', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const data = validateBody(
      worUpdateAccountSchema,
      { ...req.body, account_id: Number(req.params.accountId) },
      res,
    );
    if (!data) return;
    const account = q.getGameAccountByIdAndUser(db, data.account_id, clerkUserId);
    if (!account) {
      err(res, 'Account not found', 404);
      return;
    }
    const duplicate = q.getAccountByNameAndUser(db, clerkUserId, data.account_name);
    if (duplicate && duplicate.id !== data.account_id) {
      err(res, 'An account with this name already exists.', 409);
      return;
    }
    const ok = q.updateGameAccountName(db, data.account_id, clerkUserId, data.account_name);
    if (!ok) {
      err(res, 'Failed to update account', 500);
      return;
    }
    const session = getWorSession(req);
    if (session.wor_account_id === data.account_id) {
      patchWorSession(req, { wor_account_name: data.account_name });
    }
    json(res, { ok: true });
  });
});

worApiRouter.delete('/accounts/:accountId', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const data = validateBody(
      worDeleteAccountSchema,
      { account_id: Number(req.params.accountId) },
      res,
    );
    if (!data) return;
    const account = q.getGameAccountByIdAndUser(db, data.account_id, clerkUserId);
    if (!account) {
      err(res, 'Account not found', 404);
      return;
    }
    const wasActive = getWorSession(req).wor_account_id === data.account_id;
    const ok = q.deleteGameAccount(db, data.account_id, clerkUserId);
    if (!ok) {
      err(res, 'Failed to delete account', 500);
      return;
    }
    if (wasActive) {
      clearWorSessionFields(req);
      const remaining = q.getUserAccountsForApi(db, clerkUserId);
      const active = remaining.find((a) => a.is_active === 1);
      if (active) {
        patchWorSession(req, {
          wor_account_id: active.id,
          wor_account_name: active.account_name,
        });
      }
    }
    json(res, { ok: true });
  });
});

worApiRouter.get('/user', (req, res) => {
  runWithDb(res, (db) => {
    const clerkUserId = requireClerkUserId(req);
    const accounts = q.getUserAccountsForApi(db, clerkUserId);
    const currentAccountId = reconcileWorSessionAccount(db, req, clerkUserId);
    json(res, {
      clerk_user_id: clerkUserId,
      accounts,
      current_account_id: currentAccountId,
      current_account_name: getWorSession(req).wor_account_name ?? null,
    });
  });
});

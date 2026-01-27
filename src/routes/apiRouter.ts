import { Request, Response, NextFunction } from 'express';

import * as api from './api.js';
import { requireAuthApi } from '../middleware/auth.js';

function getAction(req: Request): string {
  const q = (req.query?.action as string) ?? '';
  const b = (req.body as { action?: string })?.action ?? '';
  return (q || b || '').trim();
}

const ALLOWED_ACTIONS = [
  'worksheets',
  'heroes',
  'artifacts',
  'update_hero',
  'update_artifact',
  'add_hero',
  'add_artifact',
  'delete_hero',
  'delete_artifact',
  'update_hero_details',
  'update_artifact_details',
  'accounts',
  'switch_account',
  'add_account',
  'delete_account',
  'user_info',
  'admin_users',
  'admin_create_user',
  'admin_delete_user',
  'admin_reset_password',
  'admin_base_heroes',
  'admin_base_artifacts',
  'admin_add_base_hero',
  'admin_add_base_artifact',
  'admin_delete_base_hero',
  'admin_delete_base_artifact',
] as const;

const handlers: Record<
  (typeof ALLOWED_ACTIONS)[number],
  (req: Request, res: Response) => void
> = {
  worksheets: api.handleWorksheets,
  heroes: api.handleHeroes,
  artifacts: api.handleArtifacts,
  update_hero: api.handleUpdateHero,
  update_artifact: api.handleUpdateArtifact,
  add_hero: api.handleAddHero,
  add_artifact: api.handleAddArtifact,
  delete_hero: api.handleDeleteHero,
  delete_artifact: api.handleDeleteArtifact,
  update_hero_details: api.handleUpdateHeroDetails,
  update_artifact_details: api.handleUpdateArtifactDetails,
  accounts: api.handleAccounts,
  switch_account: api.handleSwitchAccount,
  add_account: api.handleAddAccount,
  delete_account: api.handleDeleteAccount,
  user_info: api.handleUserInfo,
  admin_users: api.handleAdminUsers,
  admin_create_user: api.handleAdminCreateUser,
  admin_delete_user: api.handleAdminDeleteUser,
  admin_reset_password: api.handleAdminResetPassword,
  admin_base_heroes: api.handleAdminBaseHeroes,
  admin_base_artifacts: api.handleAdminBaseArtifacts,
  admin_add_base_hero: api.handleAdminAddBaseHero,
  admin_add_base_artifact: api.handleAdminAddBaseArtifact,
  admin_delete_base_hero: api.handleAdminDeleteBaseHero,
  admin_delete_base_artifact: api.handleAdminDeleteBaseArtifact,
};

export function apiRouter(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  requireAuthApi(req, res, () => {
    const action = getAction(req);
    if (action && ALLOWED_ACTIONS.includes(action as (typeof ALLOWED_ACTIONS)[number])) {
      const handler = handlers[action as (typeof ALLOWED_ACTIONS)[number]];
      handler(req, res);
    } else {
      res.status(400).json({ error: `Unknown action: ${action || '(empty)'}` });
    }
  });
}

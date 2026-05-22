import type { SessionData } from 'express-session';

export interface CustomSessionData extends SessionData {
  account_id?: number;
}

export type AuthSession = CustomSessionData | undefined;

export function getGamesForUser(_userId: string): string[] {
  return ['warframe', 'epic7'];
}

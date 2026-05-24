import type { SessionData } from 'express-session';

export interface CustomSessionData extends SessionData {
  account_id?: number;
}

export type AuthSession = CustomSessionData | undefined;

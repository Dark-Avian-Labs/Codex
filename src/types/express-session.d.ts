import 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    account_id?: number | null;
    account_name?: string | null;
  }
}

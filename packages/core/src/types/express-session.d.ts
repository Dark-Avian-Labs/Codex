import 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    clerk_user_id?: string | null;
    account_id?: number | null;
    account_name?: string | null;
  }
}

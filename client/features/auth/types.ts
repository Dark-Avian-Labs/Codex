export interface AppSummary {
  id: string;
  label: string;
  subtitle: string;
  url: string;
}

export type AuthErrorDetail = Error | string | { message: string; code?: string };

export type AuthState =
  | { status: 'loading'; userId: null; isCodexAdmin: false; apps: AppSummary[] }
  | { status: 'unauthenticated'; userId: null; isCodexAdmin: false; apps: AppSummary[] }
  | {
      status: 'ok';
      userId: string;
      isCodexAdmin: boolean;
      apps: AppSummary[];
    }
  | {
      status: 'error';
      userId: null;
      isCodexAdmin: false;
      apps: AppSummary[];
      error: AuthErrorDetail;
    };

export interface AppSummary {
  id: string;
  label: string;
  subtitle: string;
  url: string;
}

export type AuthErrorDetail = Error | string | { message: string; code?: string };

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export type AuthState =
  | { status: 'loading'; userId: null; isAdmin: false; apps: AppSummary[] }
  | { status: 'unauthenticated'; userId: null; isAdmin: false; apps: AppSummary[] }
  | {
      status: 'authenticated';
      userId: string;
      isAdmin: boolean;
      apps: AppSummary[];
    }
  | {
      status: 'error';
      userId: null;
      isAdmin: false;
      apps: AppSummary[];
      error: AuthErrorDetail;
    };

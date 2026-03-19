declare module 'csrf-sync' {
  import { Request, Response, NextFunction } from 'express';

  interface CsrfSyncOptions {
    getTokenFromRequest?: (req: Request) => string | null | undefined;
    getTokenFromState?: (req: Request) => string | null | undefined;
    storeTokenInState?: (req: Request, token?: string) => void;
    errorConfig?: {
      statusCode?: number;
      message?: string;
      code?: string;
    };
    skipCsrfProtection?: (req: Request) => boolean;
    ignoredMethods?: readonly string[];
    size?: number;
  }

  interface CsrfSyncResult {
    csrfSynchronisedProtection: (req: Request, res: Response, next: NextFunction) => void;
    generateToken: (req: Request) => string;
  }

  export function csrfSync(options?: CsrfSyncOptions): CsrfSyncResult;
}

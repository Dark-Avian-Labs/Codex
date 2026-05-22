import type { Application, Request, Response } from 'express';

export type GameTheme = {
  primary: string;
};

export interface GameMountOptions {
  csrfToken: (req: Request, res: Response) => string;
  appName?: string;
}

export interface GameModule {
  id: string;
  name: string;
  mount: (app: Application, basePath: string, options: GameMountOptions) => void;
  getDbPath: () => string;
  getDb: () => import('better-sqlite3').Database;
  applyDefaultsForNewUser?: (clerkUserId: string) => void | Promise<void>;
  theme?: GameTheme;
}

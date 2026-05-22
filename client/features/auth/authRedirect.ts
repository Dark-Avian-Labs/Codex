import { APP_PATHS } from '../../app/paths';

export const LAST_GAME_PATH_STORAGE_KEY = 'codex:lastGamePath';

const GAME_PATHS = [APP_PATHS.warframe, APP_PATHS.epic7] as const;

function normalizeGamePath(pathname: string): string | null {
  for (const gamePath of GAME_PATHS) {
    if (pathname === gamePath || pathname.startsWith(`${gamePath}/`)) {
      return gamePath;
    }
  }
  return null;
}

export function rememberLastGamePath(pathname: string): void {
  const gamePath = normalizeGamePath(pathname);
  if (!gamePath || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_GAME_PATH_STORAGE_KEY, gamePath);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function getAuthFallbackRedirect(): string {
  if (typeof window === 'undefined') return APP_PATHS.warframe;
  try {
    const stored = window.localStorage.getItem(LAST_GAME_PATH_STORAGE_KEY);
    const normalized = stored ? normalizeGamePath(stored) : null;
    if (normalized) return normalized;
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
  return APP_PATHS.warframe;
}

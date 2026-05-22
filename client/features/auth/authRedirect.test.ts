import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_PATHS } from '../../app/paths';
import { getAuthFallbackRedirect, LAST_GAME_PATH_STORAGE_KEY, rememberLastGamePath } from './authRedirect.js';

describe('authRedirect', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns warframe when no stored preference exists', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);

    expect(getAuthFallbackRedirect()).toBe(APP_PATHS.warframe);
  });

  it('returns the stored game path when a preference exists', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(APP_PATHS.epic7);

    expect(getAuthFallbackRedirect()).toBe(APP_PATHS.epic7);
  });

  it('falls back to warframe when stored preference is invalid', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('/admin');

    expect(getAuthFallbackRedirect()).toBe(APP_PATHS.warframe);
  });

  it('remembers only supported game routes', () => {
    rememberLastGamePath(APP_PATHS.warframeAdmin);
    rememberLastGamePath('/legal');

    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(LAST_GAME_PATH_STORAGE_KEY, APP_PATHS.warframe);
  });
});

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';

export type UiStyle = 'prism' | 'shadow';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  uiStyle: UiStyle;
  setUiStyle: (style: UiStyle) => void;
}

const THEME_STORAGE_KEY = 'dal.theme.mode';
const THEME_COOKIE = 'dal.theme.mode';
const THEME_COOKIE_DOMAIN =
  (import.meta.env.VITE_SHARED_THEME_COOKIE_DOMAIN as string | undefined) ?? '';
const UI_STYLE_STORAGE_KEY = 'dal.ui.style';
const UI_STYLE_COOKIE = 'dal.ui.style';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function parseThemeCookie(): ThemeMode | null {
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${THEME_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  if (raw === 'light' || raw === 'dark') return raw;
  return null;
}

function parseUiStyleCookie(): UiStyle | null {
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${UI_STYLE_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  if (raw === 'prism' || raw === 'shadow') return raw;
  return null;
}

function resolveInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const fromCookie = parseThemeCookie();
  if (fromCookie) return fromCookie;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'dark';
}

function resolveInitialUiStyle(): UiStyle {
  if (typeof window === 'undefined') return 'prism';
  const fromCookie = parseUiStyleCookie();
  if (fromCookie) return fromCookie;
  const stored = window.localStorage.getItem(UI_STYLE_STORAGE_KEY);
  if (stored === 'prism' || stored === 'shadow') return stored;
  return 'prism';
}

function writeThemeCookie(mode: ThemeMode): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const base = `${THEME_COOKIE}=${mode}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  const domain = THEME_COOKIE_DOMAIN.trim();
  if (domain) {
    document.cookie = `${base}; Domain=${domain}`;
    return;
  }
  document.cookie = base;
}

function writeUiStyleCookie(style: UiStyle): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const base = `${UI_STYLE_COOKIE}=${style}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  const domain = THEME_COOKIE_DOMAIN.trim();
  if (domain) {
    document.cookie = `${base}; Domain=${domain}`;
    return;
  }
  document.cookie = base;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const hasMountedRef = useRef(false);
  const [mode, setMode] = useState<ThemeMode>(resolveInitialMode);
  const [uiStyle, setUiStyle] = useState<UiStyle>(resolveInitialUiStyle);

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
    root.classList.remove('dark');
    if (mode === 'dark') {
      root.classList.add('dark');
    }
    if (!hasMountedRef.current) {
      return;
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
      writeThemeCookie(mode);
    } catch (error) {
      console.warn('Failed to persist theme mode to localStorage or cookie.', error);
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('ui-prism', 'ui-shadow');
    root.classList.add(`ui-${uiStyle}`);
    if (!hasMountedRef.current) {
      return;
    }
    try {
      window.localStorage.setItem(UI_STYLE_STORAGE_KEY, uiStyle);
      writeUiStyleCookie(uiStyle);
    } catch (error) {
      console.warn('Failed to persist UI style to localStorage or cookie.', error);
    }
  }, [uiStyle]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
      uiStyle,
      setUiStyle,
    }),
    [mode, uiStyle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

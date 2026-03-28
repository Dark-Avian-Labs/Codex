import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ThemeMode = 'light' | 'dark';

export type UiStyle = 'prism' | 'shadow';

const THEME_STORAGE_KEY = 'dal.theme.mode';
const SHARED_THEME_COOKIE = 'dal.theme.mode';
const SHARED_THEME_COOKIE_DOMAIN =
  (import.meta.env.VITE_SHARED_THEME_COOKIE_DOMAIN as string | undefined) ?? '';
const UI_STYLE_STORAGE_KEY = 'dal.ui.style';
const UI_STYLE_COOKIE = 'dal.ui.style';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  uiStyle: UiStyle;
  setUiStyle: (style: UiStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyMode(mode: ThemeMode): void {
  const html = document.documentElement;
  html.classList.toggle('theme-light', mode === 'light');
  html.classList.toggle('theme-dark', mode === 'dark');
}

function applyUiStyle(style: UiStyle): void {
  const html = document.documentElement;
  html.classList.remove('ui-prism', 'ui-shadow');
  html.classList.add(`ui-${style}`);
}

function resolveInitialUiStyle(): UiStyle {
  const stored = window.localStorage.getItem(UI_STYLE_STORAGE_KEY);
  if (stored === 'prism' || stored === 'shadow') return stored;
  const fromCookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${UI_STYLE_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  if (fromCookie === 'prism' || fromCookie === 'shadow') return fromCookie;
  return 'prism';
}

function writeThemeCookie(mode: ThemeMode): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const base = `${SHARED_THEME_COOKIE}=${mode}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  const cookie = SHARED_THEME_COOKIE_DOMAIN
    ? `${base}; Domain=${SHARED_THEME_COOKIE_DOMAIN}`
    : base;
  document.cookie = cookie;
}

function writeUiStyleCookie(style: UiStyle): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const base = `${UI_STYLE_COOKIE}=${style}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  const cookie = SHARED_THEME_COOKIE_DOMAIN
    ? `${base}; Domain=${SHARED_THEME_COOKIE_DOMAIN}`
    : base;
  document.cookie = cookie;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const hasMountedRef = useRef(false);
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextMode: ThemeMode = stored === 'light' ? 'light' : 'dark';
    applyMode(nextMode);
    return nextMode;
  });
  const [uiStyle, setUiStyle] = useState<UiStyle>(() => {
    const next = resolveInitialUiStyle();
    applyUiStyle(next);
    return next;
  });

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    applyMode(mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    writeThemeCookie(mode);
  }, [mode]);

  useEffect(() => {
    applyUiStyle(uiStyle);
    try {
      window.localStorage.setItem(UI_STYLE_STORAGE_KEY, uiStyle);
    } catch (error) {
      console.warn('Failed to persist UI style to localStorage.', error);
    }
    writeUiStyleCookie(uiStyle);
  }, [uiStyle]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      toggleMode: () => {
        setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
      },
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

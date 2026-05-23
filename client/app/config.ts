function readTrimmedEnv(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isSafeRelativePath(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.includes('\\') &&
    !url.includes('://') &&
    !lower.startsWith('javascript:') &&
    !lower.startsWith('data:') &&
    !lower.startsWith('vbscript:')
  );
}

function isSafeAbsoluteLegalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const APP_DISPLAY_NAME = readTrimmedEnv(
  import.meta.env.VITE_APP_NAME as string | undefined,
  'Codex',
);

export const LEGAL_ENTITY_NAME = readTrimmedEnv(
  import.meta.env.VITE_LEGAL_ENTITY_NAME as string | undefined,
  'Dark Avian Labs',
);

const resolvedLegalPageUrl = readTrimmedEnv(
  import.meta.env.VITE_LEGAL_PAGE_URL as string | undefined,
  'https://darkavianlabs.com/legal/',
);

export const LEGAL_PAGE_URL =
  isSafeRelativePath(resolvedLegalPageUrl) || isSafeAbsoluteLegalUrl(resolvedLegalPageUrl)
    ? resolvedLegalPageUrl
    : '/auth/legal';

export const SEARCH_PLACEHOLDER = readTrimmedEnv(
  import.meta.env.VITE_SEARCH_PLACEHOLDER as string | undefined,
  'Search Codex...',
);

export const APP_VERSION = readTrimmedEnv(
  import.meta.env.VITE_APP_VERSION as string | undefined,
  'dev',
);

export const APP_ID = readTrimmedEnv(
  import.meta.env.VITE_APP_ID as string | undefined,
  'codex',
).toLowerCase();

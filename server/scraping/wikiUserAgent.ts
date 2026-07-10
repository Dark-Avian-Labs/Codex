export function getWikiUserAgent(): string {
  const value = process.env.WIKI_USER_AGENT?.trim();
  if (!value) {
    throw new Error('[WoR Wiki] WIKI_USER_AGENT must be set (no fallback).');
  }
  return value;
}

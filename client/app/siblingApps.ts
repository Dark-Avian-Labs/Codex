export type SiblingAppLink = {
  id: string;
  label: string;
  href: string;
};

const DEFAULT_SIBLING_APPS_BY_ID: Record<string, SiblingAppLink[]> = {
  armory: [{ id: 'codex', label: 'Codex', href: 'https://codex.darkavianlabs.com' }],
  codex: [{ id: 'armory', label: 'Armory', href: 'https://armory.darkavianlabs.com' }],
};

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseSiblingAppsEnv(raw: string | undefined): SiblingAppLink[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [];
  }

  const links: SiblingAppLink[] = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const parts = trimmed.split('|').map((part) => part.trim());
    if (parts.length !== 3) {
      continue;
    }
    const [id, label, href] = parts;
    if (!id || !label || !isSafeExternalUrl(href)) {
      continue;
    }
    links.push({ id: id.toLowerCase(), label, href });
  }
  return links;
}

export function getSiblingAppLinks(currentAppId: string): SiblingAppLink[] {
  const normalizedAppId = currentAppId.trim().toLowerCase();
  const fromEnv = parseSiblingAppsEnv(import.meta.env.VITE_SIBLING_APPS as string | undefined);
  const links = fromEnv.length > 0 ? fromEnv : (DEFAULT_SIBLING_APPS_BY_ID[normalizedAppId] ?? []);
  return links.filter((link) => link.id !== normalizedAppId);
}

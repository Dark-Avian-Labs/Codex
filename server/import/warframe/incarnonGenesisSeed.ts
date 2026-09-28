import fs from 'fs';
import path from 'path';

import { EXPORTS_DIR } from '../../config.js';

export interface IncarnonGenesisSeed {
  genesisUniqueName: string;
  wikiSlug: string;
  displayName: string;
}

function displayNameToWikiSlug(displayName: string): string {
  return displayName.replace(/ /g, '_');
}

export function collectIncarnonGenesisUnlockers(): IncarnonGenesisSeed[] {
  const filePath = path.join(EXPORTS_DIR, 'ExportResources_en.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  let data: Record<string, unknown[]>;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown[]>;
  } catch {
    return [];
  }

  const items = (data.ExportResources ?? []) as Array<Record<string, unknown>>;
  const seeds: IncarnonGenesisSeed[] = [];

  for (const item of items) {
    const rawUniqueName = item.uniqueName;
    const name = String(item.name ?? '');
    const uniqueName = typeof rawUniqueName === 'string' ? rawUniqueName : '';
    const isGenesis = name.endsWith('Incarnon Genesis') || uniqueName.includes('IncarnonAdapters');
    if (!isGenesis) continue;

    seeds.push({
      genesisUniqueName: uniqueName,
      wikiSlug: displayNameToWikiSlug(name),
      displayName: name,
    });
  }

  seeds.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return seeds;
}

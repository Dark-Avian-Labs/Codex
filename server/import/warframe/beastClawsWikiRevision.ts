import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '../../config.js';

const REVISION_FILE = path.join(DATA_DIR, '.processed-beast-claws-wiki-revision.txt');

function readStoredRevision(): string | null {
  try {
    if (!fs.existsSync(REVISION_FILE)) return null;
    const revision = fs.readFileSync(REVISION_FILE, 'utf8').trim();
    return revision.length > 0 ? revision : null;
  } catch {
    return null;
  }
}

export function writeStoredBeastClawsWikiRevision(revisionId: string): void {
  fs.mkdirSync(path.dirname(REVISION_FILE), { recursive: true });
  fs.writeFileSync(REVISION_FILE, revisionId, 'utf8');
}

export function beastClawsWikiRevisionChanged(revisionId: string | null): boolean {
  if (!revisionId) return true;
  const stored = readStoredRevision();
  return stored === null || stored !== revisionId;
}

export function readBeastClawsWikiRevisionForTests(): string | null {
  return readStoredRevision();
}

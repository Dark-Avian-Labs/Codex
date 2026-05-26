import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '/* codex-coverage-layout */';
const LAYOUT_RULES = `${MARKER}
.wrapper {
  max-width: 2000px;
  width: 100%;
}
.footer {
  max-width: 2000px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}
`;

const baseCssPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'coverage',
  'base.css',
);

let css;
try {
  css = readFileSync(baseCssPath, 'utf8');
} catch {
  console.warn('[patchCoverageLayout] coverage/base.css not found; skipping');
  process.exit(0);
}

const withoutExistingPatch = css.includes(MARKER)
  ? css.slice(0, css.indexOf(MARKER)).trimEnd()
  : css.trimEnd();

writeFileSync(baseCssPath, `${withoutExistingPatch}\n\n${LAYOUT_RULES}`);

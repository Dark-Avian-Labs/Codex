import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const outDir = path.join(root, 'scripts', 'data', 'wor-import-cache');
const pipelinePath = path.join(root, 'dist', 'server', 'import', 'wor', 'fastidiousCatalog.js');

if (!fs.existsSync(pipelinePath)) {
  console.error(`[wor:cache] Build first: pnpm run build (${pipelinePath} missing)`);
  process.exit(1);
}

process.env.WOR_IMPORT_LIVE = '1';
process.env.DATA_DIR = path.join(root, 'data');

const { fetchFastidiousCatalog } = await import(pathToFileURL(pipelinePath));

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'demon-details'), { recursive: true });

console.log('[wor:cache] Fetching live Fastidious catalog…');
await fetchFastidiousCatalog({
  live: true,
  onLog: (message) => console.log(`[wor:cache] ${message}`),
});

const cacheDir = path.join(process.env.DATA_DIR, 'wor-import', 'cache');
for (const file of ['heroes.json', 'artifacts.json', 'demons.json']) {
  const src = path.join(cacheDir, file);
  const dest = path.join(outDir, file);
  fs.copyFileSync(src, dest);
  console.log(`[wor:cache] Wrote ${dest}`);
}

const demonDetailsSrc = path.join(cacheDir, 'demon-details');
const demonDetailsDest = path.join(outDir, 'demon-details');
for (const file of fs.readdirSync(demonDetailsSrc)) {
  fs.copyFileSync(path.join(demonDetailsSrc, file), path.join(demonDetailsDest, file));
}
console.log(`[wor:cache] Copied ${fs.readdirSync(demonDetailsDest).length} demon detail files.`);

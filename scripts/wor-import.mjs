import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const pipelinePath = path.join(root, 'dist', 'server', 'import', 'wor', 'startupPipeline.js');
if (!fs.existsSync(pipelinePath)) {
  console.error(`[wor:import] Missing ${pipelinePath}. Run: pnpm run build`);
  process.exitCode = 1;
  process.exit(1);
}

const { runWorStartupPipeline } = await import(pathToFileURL(pipelinePath));

const forceImport = process.argv.includes('--force');
const forceImages = process.argv.includes('--force-images');
process.env.WOR_IMPORT_LIVE = process.env.WOR_IMPORT_LIVE ?? '1';

try {
  const summary = await runWorStartupPipeline({ forceImport, forceImages });
  console.log('[wor:import] Complete:', summary);
} catch (error) {
  console.error('[wor:import] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

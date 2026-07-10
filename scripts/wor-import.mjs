import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const pipelinePath = path.join(root, 'dist', 'server', 'import', 'wor', 'startupPipeline.js');
if (!fs.existsSync(pipelinePath)) {
  console.error(`[wor:import] Missing ${pipelinePath}. Run: pnpm run build`);
  process.exitCode = 1;
  process.exit(1);
}

const { runWorStartupPipeline } = await import(pipelinePath);

try {
  const summary = await runWorStartupPipeline();
  console.log('[wor:import] Complete:', summary);
} catch (error) {
  console.error('[wor:import] Failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbInit = path.join(root, 'scripts', 'db-init.mjs');
const serverPath = path.join(root, 'dist', 'server', 'index.js');

const init = spawnSync(process.execPath, [dbInit], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (init.status !== 0) {
  process.exit(init.status ?? 1);
}

const server = spawn(process.execPath, [serverPath], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

function shutdown() {
  if (!server.killed) {
    server.kill();
  }
}

server.on('exit', (code) => {
  process.exit(code ?? 1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

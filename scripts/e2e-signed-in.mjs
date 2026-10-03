import { spawn } from 'node:child_process';

let current = null;

function run(command, args, shell) {
  return new Promise((resolve) => {
    current = spawn(command, args, {
      stdio: 'inherit',
      shell,
      env: process.env,
    });
    current.on('error', () => {
      current = null;
      resolve(1);
    });
    current.on('exit', (code) => {
      current = null;
      resolve(code ?? 1);
    });
  });
}

function shutdown() {
  if (current && !current.killed) current.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const buildCode = await run(
  'pnpm',
  ['exec', 'vite', 'build', '--outDir', 'dist/e2e-client', '--mode', 'e2etest'],
  process.platform === 'win32',
);
if (buildCode !== 0) process.exit(buildCode);

const entry = process.env.E2E_SERVER_ENTRY?.trim() || 'dist/server/index.js';
process.exit(await run(process.execPath, [entry], false));

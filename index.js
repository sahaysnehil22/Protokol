// PROTOKOL — Production Server Root Entrypoint
// Designed for seamless deployment on Render, Railway, Docker, and local Node environments.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distServerPath = path.join(__dirname, 'dist', 'server.js');

// 1. Auto-build TypeScript if dist/ does not exist yet
if (!fs.existsSync(distServerPath)) {
  console.log('⚡ Compiling TypeScript build files...');
  const { execSync } = await import('node:child_process');
  execSync('npx tsc', { stdio: 'inherit' });
}

// 2. Detect if native node:sqlite is already active in this runtime process
let hasSqlite = false;
try {
  await import('node:sqlite');
  hasSqlite = true;
} catch {
  hasSqlite = false;
}

if (!hasSqlite) {
  // If not enabled by default, respawn node with --experimental-sqlite
  const child = spawn(process.execPath, ['--experimental-sqlite', distServerPath], {
    stdio: 'inherit',
    env: { ...process.env, PROTOKOL_RESPAWNED: '1' }
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  // Forward termination signals to child process
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
} else {
  // Directly boot compiled server
  await import('./dist/server.js');
}

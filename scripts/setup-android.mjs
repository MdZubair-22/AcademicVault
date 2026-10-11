import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// Always run this script from the AcademicVault project root.
if (!fs.existsSync('capacitor.config.json')) {
  console.error('[AcademicVault] capacitor.config.json was not found.');
  console.error('[AcademicVault] Run this command from the project root (the folder containing package.json).');
  process.exit(1);
}

if (!fs.existsSync('android')) {
  console.log('[AcademicVault] Android platform is missing. Adding it now...');
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'add', 'android'], {
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log('[AcademicVault] Android platform already exists.');
}

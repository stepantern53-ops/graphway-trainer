import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const requiredNames = ['DATABASE_URL', 'TEST_DATABASE_URL', 'SESSION_SECRET', 'PORT', 'WEB_PORT', 'PG_PORT'];

/** Import the existing PowerShell loader into this Node process without exposing values in logs. */
export async function loadRuntimeEnvironment() {
  if (process.platform !== 'win32') {
    throw new Error('GraphWay local environment import currently requires Windows PowerShell.');
  }

  const command = [
    "$ErrorActionPreference = 'Stop'",
    '. ./scripts/local-env.ps1',
    "$names = @('DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','PORT','WEB_PORT','PG_PORT')",
    '$result = @{}',
    'foreach ($name in $names) { $result[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }',
    '$result | ConvertTo-Json -Compress'
  ].join('; ');

  let stdout;
  try {
    ({ stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      cwd: process.cwd(),
      windowsHide: true,
      maxBuffer: 16 * 1024
    }));
  } catch {
    throw new Error('Unable to import local runtime settings with scripts/local-env.ps1.');
  }

  let imported;
  try {
    imported = JSON.parse(stdout);
  } catch {
    throw new Error('The local environment loader returned invalid process settings.');
  }
  for (const name of requiredNames) {
    const value = imported[name];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Local environment loader did not provide ${name}.`);
    }
    process.env[name] = value;
  }
  return Object.freeze(Object.fromEntries(requiredNames.map((name) => [name, process.env[name]])));
}

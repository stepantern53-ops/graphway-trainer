import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { loadRuntimeEnvironment } from './local-runtime.mjs';

const projectRoot = process.cwd();
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run end-to-end tests through npm.');
await loadRuntimeEnvironment();
const port = '3002';
const e2eEnv = {
  ...process.env,
  NODE_ENV: 'test',
  TEST_PORT: port
};

function run(command, args, env = e2eEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, env, stdio: 'inherit', windowsHide: true, shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0
      ? resolve()
      : reject(new Error(`${command} failed${signal ? ` (${signal})` : ` with exit code ${code}`}.`)));
  });
}

async function findExistingChromium() {
  const cache = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : undefined;
  if (!cache) return undefined;
  let entries;
  try {
    entries = await readdir(cache, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const versions = entries
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)));
  for (const entry of versions) {
    const executable = join(cache, entry.name, 'chrome-win64', 'chrome.exe');
    try {
      if ((await stat(executable)).isFile()) return executable;
    } catch {
      // Some cached browser revisions contain only partial downloads; skip them.
    }
  }
}

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || await findExistingChromium();
if (chromiumExecutable) e2eEnv.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chromiumExecutable;

await run(process.execPath, [npmCli, 'run', 'db:test:prepare']);
await run(process.execPath, [npmCli, 'run', 'build']);
await run(process.execPath, [npmCli, 'run', 'admin:provision', '--', '--test']);

const server = spawn(process.execPath, ['apps/server/dist/index.js'], {
  cwd: projectRoot,
  env: e2eEnv,
  stdio: 'inherit',
  windowsHide: true,
  shell: false
});
let serverExited = false;
server.once('exit', () => { serverExited = true; });
server.once('error', () => { serverExited = true; });

try {
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline && !serverExited) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Keep the connection details and server error payloads out of the launcher log.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Assembled test server did not become ready on 127.0.0.1:3002.');

  const playrightCli = join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  await run(process.execPath, [playrightCli, 'test', ...process.argv.slice(2)]);
} finally {
  if (server.exitCode === null && server.signalCode === null) server.kill();
}

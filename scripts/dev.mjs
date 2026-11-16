import { spawn } from 'node:child_process';
import { Client } from 'pg';
import { loadRuntimeEnvironment } from './local-runtime.mjs';

const env = await loadRuntimeEnvironment();
const children = [];

function runNodeScript(path, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path, ...args], { cwd: process.cwd(), stdio: 'inherit', windowsHide: true, shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0
      ? resolve()
      : reject(new Error(`Local setup command failed${signal ? ` (${signal})` : ` with exit code ${code}`}.`)));
  });
}

await runNodeScript('scripts/local-db.mjs', ['start']);

async function waitForPostgres(connectionString) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 1500, query_timeout: 1500 });
    try {
      await client.connect();
      await client.query('SELECT version()');
      return;
    } catch {
      // Connection details and driver errors are intentionally not written to logs.
    } finally {
      await client.end().catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('PostgreSQL did not become SQL-ready within 30 seconds.');
}

await waitForPostgres(env.DATABASE_URL);
await waitForPostgres(env.TEST_DATABASE_URL);

function launch(workspace) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run the development launcher through npm.');
  const child = spawn(process.execPath, [npmCli, 'run', 'dev', '--workspace', workspace], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true,
    shell: false
  });
  children.push(child);
  child.once('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
    for (const sibling of children) if (sibling !== child && sibling.exitCode === null) sibling.kill();
  });
  return child;
}

const server = launch('@graphway/server');
const web = launch('@graphway/web');
console.log(`GraphWay local development: http://127.0.0.1:${env.WEB_PORT}`);
console.log(`Backend: http://127.0.0.1:${env.PORT}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
  });
}
await Promise.all(children.map((child) => new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', () => resolve());
})));
if (server.exitCode || web.exitCode) process.exitCode ||= server.exitCode || web.exitCode;

import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

const projectRoot = process.cwd();
const composeArgs = ['compose', '--project-name', 'graphway-local', '-f', 'compose.graphway.local.yml', '--env-file', '.local/graphway.compose.env'];
const action = process.argv[2];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit', windowsHide: true, shell: false, ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
    });
  });
}

if (action === 'start') {
  await run('docker', [...composeArgs, 'up', '-d', 'postgres']);
} else if (action === 'stop') {
  await run('docker', [...composeArgs, 'stop', 'postgres']);
} else if (action === 'test:prepare') {
  const { loadRuntimeEnvironment } = await import('./local-runtime.mjs');
  const env = await loadRuntimeEnvironment();
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run test database preparation through npm.');
  const target = new URL(env.TEST_DATABASE_URL);
  if (target.pathname !== '/graphway_test') throw new Error('Test database URL does not target graphway_test.');
  await run(process.execPath, [npmCli, 'run', 'db:migrate', '--workspace', '@graphway/server', '--', '--test'], {
    env: { ...process.env, NODE_ENV: 'test' }
  });
  const client = new Client({ connectionString: env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS name');
    if (result.rows[0]?.name !== 'graphway_test') throw new Error('Connected database is not graphway_test.');
    await client.query('TRUNCATE TABLE users, sessions, auth_limits RESTART IDENTITY CASCADE');
    console.log('Migrated and reset the guarded graphway_test database.');
  } catch {
    throw new Error('Could not safely migrate and reset graphway_test.');
  } finally {
    await client.end().catch(() => {});
  }
  try {
    await unlink(join(projectRoot, '.local', 'test-admin-access.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Could not safely remove the previous test-admin artifact.');
  }
} else {
  console.error('Usage: node scripts/local-db.mjs <start|stop|test:prepare>');
  process.exitCode = 2;
}

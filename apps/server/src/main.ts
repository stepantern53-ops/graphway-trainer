import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApplicationEnvironment } from './application-environment.js';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createDatabase } from './db/client.js';

try {
  process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
  await loadApplicationEnvironment();
  const config = readConfig();
  config.staticDirectory = resolve('apps/web/dist');
  const database = createDatabase(config.databaseUrl);
  const app = createApp({ pool: database.pool, config });
  const maintenance = setInterval(() => { app.locals.prune().catch(() => console.error('Database maintenance unavailable.')); }, 60_000);
  maintenance.unref();
  const server = app.listen(config.port, '127.0.0.1', () => console.log(`GraphWay server: http://127.0.0.1:${config.port}`));
  server.on('error', () => { console.error('GraphWay server could not listen.'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    clearInterval(maintenance);
    server.close(() => { void database.pool.end(); });
  });
} catch {
  console.error('GraphWay server startup failed. Check runtime configuration.');
  process.exitCode = 1;
}

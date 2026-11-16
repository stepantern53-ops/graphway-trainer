import { fileURLToPath } from 'node:url';
import { loadCommandConfiguration } from './environment.js';
import { createDatabase } from '../db/client.js';
import { migrateDatabase } from '../db/migrate.js';

try {
  process.chdir(fileURLToPath(new URL('../../../../', import.meta.url)));
  const { mode, databaseUrl } = await loadCommandConfiguration(process.argv.slice(2));
  const database = createDatabase(databaseUrl);
  try { await migrateDatabase(database); } finally { await database.pool.end(); }
  console.log(`GraphWay ${mode} migrations applied.`);
} catch {
  console.error('GraphWay migrations failed. Check PostgreSQL and runtime configuration.');
  process.exitCode = 1;
}

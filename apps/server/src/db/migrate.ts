import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';

// Resolve after entrypoints establish the project root, not at ESM import time.
export function getMigrationsDirectory(): string { return resolve('apps/server/migrations'); }
export async function migrateDatabase(database: Database) {
  const client = await database.pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(417284, 1)");
    await migrate(database.db, { migrationsFolder: getMigrationsDirectory() });
  } finally {
    await client.query('SELECT pg_advisory_unlock(417284, 1)').catch(() => undefined);
    client.release();
  }
}

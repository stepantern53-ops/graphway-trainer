import { afterAll, expect, test } from 'vitest';
import pg from 'pg';
import { loadRuntimeEnvironment } from '../../../scripts/local-runtime.mjs';

await loadRuntimeEnvironment();
const url = new URL(process.env.TEST_DATABASE_URL!);
if (decodeURIComponent(url.pathname) !== '/graphway_test') throw new Error('Refusing non-test database');
const pool = new pg.Pool({ connectionString: url.toString() });
afterAll(async () => { await pool.end(); });

test('real PostgreSQL has migrated auth and completion tables', async () => {
  const result = await pool.query("SELECT current_database() AS name, to_regclass('public.users') IS NOT NULL AS users, to_regclass('public.completions') IS NOT NULL AS completions");
  expect(result.rows[0]).toEqual({ name: 'graphway_test', users: true, completions: true });
});

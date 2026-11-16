import { afterAll, expect, test } from 'vitest';
import { loadRuntimeEnvironment } from '../../../scripts/local-runtime.mjs';
import { createDatabase } from '../src/db/client.js';
import { AuthService } from '../src/auth/service.js';

await loadRuntimeEnvironment();
const url = new URL(process.env.TEST_DATABASE_URL!);
if (decodeURIComponent(url.pathname) !== '/graphway_test') throw new Error('Refusing non-test database');
const database = createDatabase(url.toString());
afterAll(async () => { await database.pool.end(); });

test('auth bounded Argon2 admission recovers after overload without poisoned dummy verifier', async () => {
  const service = new AuthService(database.pool);
  // Warm the real PG connection before filling the bounded hash queue.
  await database.pool.query('SELECT 1');
  const work = Array.from({ length: 10 }, () => service.hash('a-real-test-password'));
  const overloaded = await service.authenticate('Nonexistent_Queue_User', 'a-real-test-password').then(() => false, error => error.code === 'AUTH_BUSY');
  await Promise.all(work);
  expect(overloaded).toBe(true);
  expect(await service.authenticate('Nonexistent_Queue_User', 'a-real-test-password')).toBeNull();
});

import { afterEach, expect, test, vi } from 'vitest';
import { loadCommandConfiguration, readCommandDatabase } from '../src/cli/environment.js';

afterEach(() => { vi.unstubAllEnvs(); });

test.each([[], ['--test'], ['--production', '--test'], ['--production', '--production'], ['--unknown']])('production CLI refuses ambiguous or non-production arguments %j', async (...args: string[]) => {
  vi.stubEnv('NODE_ENV', 'production');
  await expect(loadCommandConfiguration(args)).rejects.toThrow();
});

test.each(['development', 'test', undefined])('production CLI refuses --production when NODE_ENV=%s', async nodeEnv => {
  vi.stubEnv('NODE_ENV', nodeEnv);
  await expect(loadCommandConfiguration(['--production'])).rejects.toThrow();
});

test.each([
  ['development', 'postgresql://127.0.0.1/graphway_test'],
  ['development', 'postgresql://127.0.0.1/graphway_prod'],
  ['test', 'postgresql://127.0.0.1/graphway_dev'],
  ['test', 'postgresql://127.0.0.1/graphway_prod'],
  ['production', 'postgresql://127.0.0.1/graphway_dev'],
  ['production', 'postgresql://127.0.0.1/graphway_test'],
  ['production', 'postgresql://127.0.0.1/%67raphway_test'],
  ['production', 'https://127.0.0.1/graphway_prod'],
  ['production', 'postgresql:///graphway_prod'],
] as const)('%s CLI refuses cross-target or invalid database %s', (mode, databaseUrl) => {
  expect(() => readCommandDatabase(mode, { DATABASE_URL: databaseUrl, TEST_DATABASE_URL: databaseUrl })).toThrow();
});

test('production CLI never falls back to test database or reflects a supplied credential on refusal', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('TEST_DATABASE_URL', 'postgresql://127.0.0.1/graphway_prod');
  await expect(loadCommandConfiguration(['--production'])).rejects.toThrow();
  const sensitive = 'synthetic-refusal-password';
  const attempt = () => readCommandDatabase('production', { DATABASE_URL: `postgresql://operator:${sensitive}@127.0.0.1/graphway_dev` });
  expect(attempt).toThrow();
  expect(attempt).not.toThrow(sensitive);
  expect(attempt).not.toThrow('postgresql://');
});

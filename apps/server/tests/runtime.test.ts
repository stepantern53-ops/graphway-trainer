import { afterEach, expect, test, vi } from 'vitest';
import { loadApplicationEnvironment } from '../src/application-environment.js';
import { readConfig } from '../src/config.js';

afterEach(() => { vi.unstubAllEnvs(); });

test('production refuses missing configuration instead of acquiring local database and session secrets', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('SESSION_SECRET', undefined);
  vi.stubEnv('APP_ORIGIN', 'https://graphway.example');
  await loadApplicationEnvironment();
  expect(() => readConfig()).toThrow('Missing database or secure session configuration');
});

import { afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { loadRuntimeEnvironment } from '../../../scripts/local-runtime.mjs';
import { createDatabase } from '../src/db/client.js';
import { createApp } from '../src/app.js';
import { provisionAdmin } from '../src/auth/admin.js';
import type { ServerConfig } from '../src/config.js';

export const origin = 'http://127.0.0.1:5173';
export const password = 'Graphway-test-password-2026';
export async function createHarness() {
  await loadRuntimeEnvironment();
  const url = new URL(process.env.TEST_DATABASE_URL!);
  if (decodeURIComponent(url.pathname) !== '/graphway_test') throw new Error('Refusing non-test database');
  const database = createDatabase(url.toString());
  const config: ServerConfig = { databaseUrl: url.toString(), sessionSecret: process.env.SESSION_SECRET!, port: 3001, production: false, allowedOrigins: [origin] };
  const app = createApp({ pool: database.pool, config });
  beforeEach(async () => {
    const target = await database.pool.query('SELECT current_database() AS name');
    if (target.rows[0].name !== 'graphway_test') throw new Error('Refusing non-test cleanup');
    await database.pool.query('TRUNCATE users,sessions,auth_limits CASCADE');
    await provisionAdmin(database.pool, async () => undefined);
  });
  afterAll(async () => { app.locals.sessionStore.close(); await database.pool.end(); });
  return {
    ...database, app, config,
    async signup(nickname = 'Student_One') {
      const agent = request.agent(app);
      const before = await agent.get('/api/auth/csrf');
      const response = await agent.post('/api/auth/register').set('Origin', origin).set('X-CSRF-Token', before.body.csrfToken).send({ nickname, password });
      const token = await agent.get('/api/auth/csrf');
      return { agent, response, token: token.body.csrfToken as string, oldToken: before.body.csrfToken as string, beforeCookie: before.headers['set-cookie'] };
    },
  };
}

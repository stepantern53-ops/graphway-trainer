import { expect, test } from 'vitest';
import request from 'supertest';
import { createHarness } from './helpers.js';
import { provisionAdmin, type AdminCredentials } from '../src/auth/admin.js';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/client.js';

const h = await createHarness();
test('admin missing is not ready and signup never promotes student', async () => {
  await h.pool.query("DELETE FROM users WHERE role='admin'");
  expect((await request(h.app).get('/api/health/live')).body).toEqual({ status: 'ok' });
  expect((await request(h.app).get('/api/health/ready')).status).toBe(503);
  expect((await h.signup()).response.body.user.role).toBe('student');
  expect((await request(h.app).get('/api/health/ready')).status).toBe(503);
});
test('admin concurrent provision is singleton, credentials once and existing password unchanged', async () => {
  await h.pool.query("DELETE FROM users WHERE role='admin'");
  const artifacts: AdminCredentials[] = [];
  const results = await Promise.all([provisionAdmin(h.pool, async value => { artifacts.push(value); }), provisionAdmin(h.pool, async value => { artifacts.push(value); })]);
  expect(results.filter(result => result.created)).toHaveLength(1);
  expect(artifacts).toHaveLength(1);
  const before = await h.pool.query("SELECT id,password_hash FROM users WHERE role='admin'");
  expect(before.rows).toHaveLength(1);
  await provisionAdmin(h.pool, async () => { throw new Error('must not replace existing credentials'); });
  expect((await h.pool.query("SELECT id,password_hash FROM users WHERE role='admin'")).rows).toEqual(before.rows);
  expect((await request(h.app).get('/api/health/ready')).status).toBe(200);
  await expect(h.pool.query("INSERT INTO users (nickname_display,nickname_key,password_hash,role) VALUES ('other_admin','other_admin','not-a-hash','admin')")).rejects.toMatchObject({ code: '23505' });
});
test('admin failed secure artifact creation rolls back account', async () => {
  await h.pool.query("DELETE FROM users WHERE role='admin'");
  await expect(provisionAdmin(h.pool, async () => { throw new Error('disk permission denied'); })).rejects.toThrow('disk permission denied');
  expect((await h.pool.query("SELECT id FROM users WHERE role='admin'")).rowCount).toBe(0);
});
test('admin readiness and CSRF return safe 503 when real PostgreSQL connection is unavailable', async () => {
  const database = createDatabase('postgresql://127.0.0.1:1/graphway_test');
  const app = createApp({ pool: database.pool, config: h.config });
  try {
    expect((await request(app).get('/api/health/live')).status).toBe(200);
    expect((await request(app).get('/api/health/ready')).status).toBe(503);
    const csrf = await request(app).get('/api/auth/csrf');
    expect(csrf.status).toBe(503);
    expect(csrf.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(JSON.stringify(csrf.body)).not.toMatch(/postgresql|password|stack|127\.0\.0\.1/);
  } finally { app.locals.sessionStore.close(); await database.pool.end(); }
});

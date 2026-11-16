import { expect, test } from 'vitest';
import request from 'supertest';
import { createHarness, origin, password } from './helpers.js';
import { createApp } from '../src/app.js';
import { provisionAdmin, type AdminCredentials } from '../src/auth/admin.js';
import { WITNESSES } from '../../../packages/curriculum/tests/witnesses.js';
import { createDatabase } from '../src/db/client.js';

const h = await createHarness();
const valid = { curriculumVersion: 'graphway-v1', coefficients: { b: '2' } };
test('completion auth CSRF locked and forged identity are rejected', async () => {
  const { agent, token } = await h.signup();
  expect((await agent.post('/api/levels/L01/complete').set('Origin', origin).send(valid)).status).toBe(403);
  expect((await agent.post('/api/levels/L02/complete').set('Origin', origin).set('X-CSRF-Token', token).send(valid)).status).toBe(403);
  for (const extra of [{ userId: 'fake' }, { role: 'admin' }, { route: { startX: -3, endX: 3 } }, { completed: true }]) expect((await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send({ ...valid, ...extra })).status).toBe(400);
  expect((await h.pool.query('SELECT * FROM completions')).rowCount).toBe(0);
});
test('completion concurrent retry creates one completion and one advance; invalid retry rejected', async () => {
  const { agent, token, response } = await h.signup();
  const responses = await Promise.all(Array.from({ length: 5 }, () => agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send(valid)));
  expect(responses.map(value => value.status)).toEqual([200, 200, 200, 200, 200]);
  expect(new Set(responses.map(value => value.body.completion.completedAt)).size).toBe(1);
  expect(responses[0].body.progress.currentLevelId).toBe('L02');
  expect((await h.pool.query('SELECT * FROM completions WHERE user_id=$1', [response.body.user.id])).rowCount).toBe(1);
  const replay = await agent.put('/api/progress/current').set('Origin', origin).set('X-CSRF-Token', token).send({ levelId: 'L01', curriculumVersion: 'graphway-v1' });
  expect(replay.body.currentLevelId).toBe('L01');
  const retry = await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send(valid);
  expect(retry.body.progress.currentLevelId).toBe('L01');
  expect(retry.body.progress.nextLevelId).toBe('L02');
  expect((await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send({ ...valid, coefficients: { b: '0' } })).status).toBe(400);
  expect((await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send({ ...valid, coefficients: { b: '2', k: '0' } })).status).toBe(400);
  const sessions = await h.pool.query('SELECT sess FROM sessions');
  for (const row of sessions.rows) expect(Object.keys(row.sess).sort()).toEqual(['cookie', 'csrfToken', 'passport']);
});
test('completion persistence survives app recreation and level returns initial only', async () => {
  const { agent, token, response } = await h.signup();
  await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send(valid).expect(200);
  const sessionRows = await h.pool.query("SELECT sid FROM sessions WHERE sess::jsonb ? 'passport'");
  expect(sessionRows.rowCount).toBe(1);
  const restarted = createApp({ pool: h.pool, config: h.config });
  // Reuse the original signed session cookie against a separate Express instance.
  const registrationCookie = response.headers['set-cookie'];
  const me = await request(restarted).get('/api/me').set('Cookie', registrationCookie);
  expect(me.status).toBe(200);
  expect(me.body.progress.currentLevelId).toBe('L02');
  expect(me.body.progress.completedLevelIds).toEqual(['L01']);
  const level = await agent.get('/api/levels/L01');
  expect(level.body.initial).toEqual({ b: '0' });
  expect((await agent.get('/api/me')).body.progress.currentLevelId).toBe('L02');
  restarted.locals.sessionStore.close();
});
test('completion singleton admin opens quadratic but cannot bypass exact math', async () => {
  await h.pool.query("DELETE FROM users WHERE role='admin'");
  let credentials: AdminCredentials | undefined;
  await provisionAdmin(h.pool, async value => { credentials = value; });
  const agent = request.agent(h.app);
  const csrf = await agent.get('/api/auth/csrf');
  const login = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send(credentials);
  expect(login.status).toBe(200);
  const token = await agent.get('/api/auth/csrf');
  expect((await agent.get('/api/levels/Q12')).status).toBe(200);
  expect((await agent.post('/api/levels/Q12/complete').set('Origin', origin).set('X-CSRF-Token', token.body.csrfToken).send({ curriculumVersion: 'graphway-v1', coefficients: { a: '-3/4', b: '3/2', c: '3.000001' } })).status).toBe(400);
  expect((await agent.post('/api/levels/Q12/complete').set('Origin', origin).set('X-CSRF-Token', token.body.csrfToken).send({ curriculumVersion: 'graphway-v1', coefficients: { a: '-3/4', b: '3/2', c: '3' } })).status).toBe(200);
});
test('completion all 24 student levels unlock in order, accept broad alternatives and finish without a next level', async () => {
  const { agent, token } = await h.signup();
  const entries = Object.entries(WITNESSES);
  for (const [index, [levelId, fixture]] of entries.entries()) {
    expect((await agent.get(`/api/levels/${levelId}`)).status).toBe(200);
    const coefficients = levelId === 'L05' ? { k: '51/100' } : levelId === 'L06' ? { k: '1/100' } : fixture;
    const response = await agent.post(`/api/levels/${levelId}/complete`).set('Origin', origin).set('X-CSRF-Token', token).send({ curriculumVersion: 'graphway-v1', coefficients });
    expect(response.status, levelId).toBe(200);
    expect(response.body.progress.completedCount).toBe(index + 1);
    expect(response.body.progress.nextLevelId).toBe(entries[index + 1]?.[0] ?? null);
    if (levelId === 'L11') expect((await agent.get('/api/levels/Q01')).status).toBe(403);
    if (levelId === 'L12') expect((await agent.get('/api/levels/Q01')).status).toBe(200);
  }
  const episodes = await agent.get('/api/episodes');
  expect(episodes.body.episodes.map((episode: { completedCount: number }) => episode.completedCount)).toEqual([12, 12]);
  expect((await agent.get('/api/me')).body.progress.currentLevelId).toBe('Q12');
}, 30_000);
test('completion actual database outage returns 503 without false saved progress', async () => {
  const { token, response } = await h.signup();
  const unavailable = createDatabase('postgresql://127.0.0.1:1/graphway_test');
  const app = createApp({ pool: unavailable.pool, config: h.config });
  try {
    const result = await request(app).post('/api/levels/L01/complete').set('Cookie', response.headers['set-cookie']).set('Origin', origin).set('X-CSRF-Token', token).send(valid);
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect((await h.pool.query('SELECT * FROM completions')).rowCount).toBe(0);
  } finally { app.locals.sessionStore.close(); await unavailable.pool.end(); }
});
test('completion expired real PG session returns 401, same-user login restores retry with fresh CSRF and full math', async () => {
  const { agent, token, response } = await h.signup();
  const userId = response.body.user.id;
  const destroyed = await h.pool.query("DELETE FROM sessions WHERE sess::jsonb -> 'passport' ->> 'user'=$1", [userId]);
  expect(destroyed.rowCount).toBe(1);
  const expired = await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send(valid);
  expect(expired.status).toBe(401);
  expect(expired.body.error.code).toBe('AUTH_REQUIRED');
  expect((await h.pool.query('SELECT * FROM completions')).rowCount).toBe(0);
  expect((await agent.put('/api/progress/current').set('Origin', origin).set('X-CSRF-Token', token).send({ levelId: 'L01', curriculumVersion: 'graphway-v1' })).status).toBe(401);
  expect((await agent.post('/api/auth/logout').set('Origin', origin).set('X-CSRF-Token', token)).status).toBe(401);
  // Pre-auth credentials routes remain CSRF protected even with an expired cookie.
  expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ nickname: 'Student_One', password })).status).toBe(403);
  const fresh = await agent.get('/api/auth/csrf');
  const login = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', fresh.body.csrfToken).send({ nickname: 'Student_One', password });
  expect(login.status).toBe(200);
  expect(login.body.user.id).toBe(userId);
  const authenticatedToken = (await agent.get('/api/auth/csrf')).body.csrfToken;
  expect(authenticatedToken === token || authenticatedToken === fresh.body.csrfToken).toBe(false);
  expect((await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', token).send(valid)).status).toBe(403);
  expect((await agent.post('/api/levels/L02/complete').set('Origin', origin).set('X-CSRF-Token', authenticatedToken).send(valid)).status).toBe(403);
  expect((await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', authenticatedToken).send({ ...valid, coefficients: { b: '0' } })).status).toBe(400);
  const accepted = await agent.post('/api/levels/L01/complete').set('Origin', origin).set('X-CSRF-Token', authenticatedToken).send(valid);
  expect(accepted.status).toBe(200);
  expect(accepted.body.progress.currentLevelId).toBe('L02');
  expect((await h.pool.query('SELECT * FROM completions WHERE user_id=$1', [userId])).rowCount).toBe(1);
});

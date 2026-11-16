import { expect, test } from 'vitest';
import request from 'supertest';
import { createHarness, origin, password } from './helpers.js';
import { createApp } from '../src/app.js';

const h = await createHarness();
test('auth register stores Argon2id student and regenerates session and CSRF', async () => {
  const { response, agent, token, oldToken, beforeCookie } = await h.signup('  СтУдент_1  ');
  expect(response.status).toBe(201);
  expect(response.body.user).toMatchObject({ nickname: 'СтУдент_1', role: 'student' });
  expect(response.body.progress.currentLevelId).toBe('L01');
  expect(token).not.toBe(oldToken);
  expect(response.headers['set-cookie']).not.toEqual(beforeCookie);
  expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
  expect(String(response.headers['set-cookie'])).toContain('SameSite=Lax');
  expect(String(response.headers['set-cookie'])).not.toContain('Secure');
  const rows = await h.pool.query('SELECT password_hash,nickname_key FROM users WHERE role=$1', ['student']);
  expect(rows.rows[0].password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(rows.rows[0].nickname_key).toBe('студент_1');
  expect((await agent.post('/api/auth/logout').set('Origin', origin).set('X-CSRF-Token', oldToken)).status).toBe(403);
  expect((await agent.get('/api/me')).status).toBe(200);
});
test('auth strict public schemas reject identity injection, malformed JSON, password boundaries and missing CSRF', async () => {
  expect((await request(h.app).post('/api/auth/register').set('Origin', origin).send({ nickname: 'Injected', password })).status).toBe(403);
  const agent = request.agent(h.app);
  const csrf = await agent.get('/api/auth/csrf');
  for (const body of [{ nickname: 'Injected', password, role: 'admin' }, { nickname: 'Injected', password, userId: 'x' }, { nickname: 'bad-name', password }, { nickname: 'ValidName', password: '123456789' }, { nickname: 'ValidName', password: 'x'.repeat(129) }]) {
    expect((await agent.post('/api/auth/register').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send(body)).status).toBe(400);
  }
  expect((await agent.post('/api/auth/register').set('Origin', 'https://evil.example').set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: 'Injected', password })).status).toBe(403);
  expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('Content-Type', 'application/json').send('{')).status).toBe(400);
  expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: 'a'.repeat(9000), password })).status).toBe(400);
  expect((await request(h.app).get('/api/me')).status).toBe(401);
});
test('auth nickname is case insensitive; login error generic; logout destroys persisted session', async () => {
  await h.signup('Case_User');
  expect((await h.signup('case_user')).response.status).toBe(409);
  const agent = request.agent(h.app);
  let csrf = await agent.get('/api/auth/csrf');
  const missing = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: 'MissingUser', password });
  const wrong = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: 'Case_User', password: 'incorrect-password' });
  expect(missing.status).toBe(401);
  expect(wrong.body).toEqual(missing.body);
  const login = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: 'CASE_USER', password });
  expect(login.status).toBe(200);
  csrf = await agent.get('/api/auth/csrf');
  const logout = await agent.post('/api/auth/logout').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken);
  expect(logout.status).toBe(204);
  expect((await agent.get('/api/me')).status).toBe(401);
});
test('auth PG nickname throttle persists across app restart and returns Retry-After', async () => {
  const agent = request.agent(h.app);
  const csrf = await agent.get('/api/auth/csrf');
  for (let index = 0; index < 10; index++) expect((await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: 'MissingUser', password })).status).toBe(401);
  const restarted = createApp({ pool: h.pool, config: h.config });
  const fresh = request.agent(restarted);
  const token = await fresh.get('/api/auth/csrf');
  const limited = await fresh.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', token.body.csrfToken).send({ nickname: 'MissingUser', password });
  expect(limited.status).toBe(429);
  expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  restarted.locals.sessionStore.close();
});
test('auth signup IP envelope rejects sixth registration', async () => {
  for (let index = 0; index < 5; index++) expect((await h.signup(`Student_${index}`)).response.status).toBe(201);
  const limited = await h.signup('Student_Six');
  expect(limited.response.status).toBe(429);
});
test('auth successful login clears nickname failures but preserves only previous IP failures', async () => {
  await h.signup();
  const agent = request.agent(h.app);
  const csrf = await agent.get('/api/auth/csrf');
  const headers = { Origin: origin, 'X-CSRF-Token': csrf.body.csrfToken };
  expect((await agent.post('/api/auth/login').set(headers).send({ nickname: 'Student_One', password: 'wrong-password' })).status).toBe(401);
  expect((await agent.post('/api/auth/login').set(headers).send({ nickname: 'Student_One', password })).status).toBe(200);
  const counters = await h.pool.query("SELECT split_part(key,':',1) AS kind,count FROM auth_limits WHERE key LIKE 'login-%' ORDER BY key");
  expect(counters.rows).toEqual([{ kind: 'login-ip', count: 1 }]);
});
test('auth production cookies require trusted TLS proxy; no arbitrary forwarded trust', async () => {
  const production = createApp({ pool: h.pool, config: { ...h.config, production: true } });
  const spoofed = await request(production).get('/api/auth/csrf').set('X-Forwarded-Proto', 'https');
  expect(Boolean(spoofed.headers['set-cookie'])).toBe(false);
  production.locals.sessionStore.close();
  const proxied = createApp({ pool: h.pool, config: { ...h.config, production: true, trustedProxy: 'loopback' } });
  const trusted = await request(proxied).get('/api/auth/csrf').set('X-Forwarded-Proto', 'https');
  expect(String(trusted.headers['set-cookie']).includes('Secure')).toBe(true);
  expect(String(trusted.headers['set-cookie']).includes('HttpOnly')).toBe(true);
  expect(String(trusted.headers['set-cookie']).includes('SameSite=Lax')).toBe(true);
  expect(trusted.headers['content-security-policy']).not.toContain('unsafe-eval');
  proxied.locals.sessionStore.close();
});
test('auth IP failure envelope covers distinct nicknames and ignores spoofed forwarding headers', async () => {
  const agent = request.agent(h.app);
  const csrf = await agent.get('/api/auth/csrf');
  for (let index = 0; index < 50; index++) {
    const response = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send({ nickname: `Missing_${index}`, password });
    expect(response.status).toBe(401);
  }
  const rejected = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).set('X-Forwarded-For', '203.0.113.4').send({ nickname: 'Another_Missing', password });
  expect(rejected.status).toBe(429);
}, 30_000);
test.each([
  { contentType: 'application/json; charset=iso-8859-1', contentEncoding: 'identity' },
  { contentType: 'application/json', contentEncoding: 'unsupported-graphway-encoding' },
])('auth unsupported JSON charset or encoding is a safe client error ($contentType, $contentEncoding)', async ({ contentType, contentEncoding }) => {
  const response = await request(h.app).post('/api/auth/login')
    .set('Content-Type', contentType).set('Content-Encoding', contentEncoding).send('{}');
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('INVALID_INPUT');
  expect(JSON.stringify(response.body)).not.toMatch(/stack|iso-8859|unsupported-graphway/);
  expect((await h.pool.query("SELECT count(*)::int AS count FROM users WHERE role='student'")).rows[0].count).toBe(0);
});
test('identity-bound writes reject another owner even with a valid fresh session CSRF', async () => {
  const old = await h.signup('Previous_Owner');
  const current = await h.signup('Current_Owner');
  const headers = { Origin: origin, 'X-CSRF-Token': current.token, 'X-GraphWay-User': old.response.body.user.id };
  const completion = await current.agent.post('/api/levels/L01/complete').set(headers).send({ curriculumVersion: 'graphway-v1', coefficients: { b: '2' } });
  expect(completion.status).toBe(409);
  expect(completion.body.error.code).toBe('SESSION_CHANGED');
  const progress = await current.agent.put('/api/progress/current').set(headers).send({ levelId: 'L01', curriculumVersion: 'graphway-v1' });
  expect(progress.status).toBe(409);
  expect(progress.body.error.code).toBe('SESSION_CHANGED');
  expect((await current.agent.post('/api/auth/logout').set(headers)).status).toBe(409);
  const me = await current.agent.get('/api/me');
  expect(me.status).toBe(200);
  expect(me.body.user.id).toBe(current.response.body.user.id);
  expect(me.body.progress.completedCount).toBe(0);
  expect((await h.pool.query('SELECT count(*)::int AS count FROM completions')).rows[0].count).toBe(0);
});

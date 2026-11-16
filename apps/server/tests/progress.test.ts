import { expect, test } from 'vitest';
import { createHarness, origin } from './helpers.js';

const h = await createHarness();
test('progress locked direct URL and current forbidden; list public metadata but no witnesses', async () => {
  const { agent, token } = await h.signup();
  expect((await agent.get('/api/levels/L01')).status).toBe(200);
  expect((await agent.get('/api/levels/L02')).status).toBe(403);
  expect((await agent.get('/api/levels/Q01')).status).toBe(403);
  expect((await agent.get('/api/levels/Unknown')).status).toBe(404);
  expect((await agent.put('/api/progress/current').set('Origin', origin).set('X-CSRF-Token', token).send({ levelId: 'L02', curriculumVersion: 'graphway-v1' })).status).toBe(403);
  const episodes = await agent.get('/api/episodes');
  expect(episodes.body.episodes).toMatchObject([{ id: 'linear', totalCount: 12, completedCount: 0, unlocked: true }, { id: 'quadratic', totalCount: 12, completedCount: 0, unlocked: false }]);
  const list = await agent.get('/api/episodes/quadratic/levels');
  expect(list.body.levels).toHaveLength(12);
  expect(list.body.levels[0].unlocked).toBe(false);
  const level = await agent.get('/api/levels/L01');
  expect(JSON.stringify(level.body)).not.toMatch(/witness|password|session|rationals/);
  expect(level.body.initial).toEqual({ b: '0' });
});
test('progress current rejects coefficients and forged user identity', async () => {
  const { agent, token } = await h.signup();
  for (const extra of [{ coefficients: { b: '2' } }, { userId: 'fake' }, { role: 'admin' }]) expect((await agent.put('/api/progress/current').set('Origin', origin).set('X-CSRF-Token', token).send({ levelId: 'L01', curriculumVersion: 'graphway-v1', ...extra })).status).toBe(400);
  expect((await agent.put('/api/progress/current').set('Origin', origin).set('X-CSRF-Token', token).send({ levelId: 'L01', curriculumVersion: 'stale' })).status).toBe(409);
  expect((await agent.get('/api/drafts')).status).toBe(404);
});

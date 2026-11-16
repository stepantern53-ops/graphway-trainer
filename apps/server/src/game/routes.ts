import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { completionRequestSchema, currentProgressRequestSchema } from '@graphway/contracts';
import { CURRENT_CURRICULUM_VERSION, getLevel, orderedLevels } from '@graphway/curriculum';
import { ApiError } from '../errors.js';
import { transaction } from '../db/client.js';
import { getProgress } from './progress.js';
import { completeLevel } from './completion.js';
import { requireAuthentication, requireUser } from '../auth/session.js';

export function gameRoutes(pool: pg.Pool, csrf: RequestHandler) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/me', async (req, res) => {
    const user = requireUser(req);
    res.json({ user, progress: await getProgress(pool, user) });
  });
  router.get('/episodes', async (req, res) => {
    const progress = await getProgress(pool, requireUser(req));
    res.json({ episodes: (['linear', 'quadratic'] as const).map(id => {
      const levels = orderedLevels(CURRENT_CURRICULUM_VERSION).filter(level => level.episodeId === id);
      return { id, title: id === 'linear' ? 'Линейный путь' : 'Параболический путь', totalCount: levels.length, completedCount: levels.filter(level => progress.completedLevelIds.includes(level.id)).length, unlocked: levels.some(level => progress.unlockedLevelIds.includes(level.id)) };
    }) });
  });
  router.get('/episodes/:id/levels', async (req, res) => {
    const progress = await getProgress(pool, requireUser(req));
    if (!['linear', 'quadratic'].includes(String(req.params.id))) throw new ApiError(404, 'EPISODE_NOT_FOUND', 'Эпизод не найден.');
    res.json({ levels: orderedLevels(CURRENT_CURRICULUM_VERSION).filter(level => level.episodeId === req.params.id).map(level => ({ id: level.id, title: level.title, focus: level.focus, goal: level.goal, completed: progress.completedLevelIds.includes(level.id), unlocked: progress.unlockedLevelIds.includes(level.id) })) });
  });
  router.get('/levels/:id', async (req, res) => {
    const user = requireUser(req);
    const level = getLevel(String(req.params.id), CURRENT_CURRICULUM_VERSION);
    if (!level) throw new ApiError(404, 'LEVEL_NOT_FOUND', 'Трасса не найдена.');
    const progress = await getProgress(pool, user);
    if (!progress.unlockedLevelIds.includes(level.id)) throw new ApiError(403, 'LEVEL_LOCKED', 'Сначала пройди предыдущую трассу.');
    res.json(level);
  });
  router.put('/progress/current', requireAuthentication, csrf, async (req, res) => {
    const user = requireUser(req);
    const parsed = currentProgressRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Некорректные поля запроса.');
    const { levelId, curriculumVersion } = parsed.data;
    if (curriculumVersion !== CURRENT_CURRICULUM_VERSION) throw new ApiError(409, 'CURRICULUM_VERSION', 'Версия учебной карты изменилась. Обнови страницу.');
    if (!getLevel(levelId, curriculumVersion)) throw new ApiError(404, 'LEVEL_NOT_FOUND', 'Трасса не найдена.');
    const progress = await transaction(pool, async client => {
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
      const current = await getProgress(client, user, curriculumVersion);
      if (!current.unlockedLevelIds.includes(levelId)) throw new ApiError(403, 'LEVEL_LOCKED', 'Сначала пройди предыдущую трассу.');
      await client.query(`INSERT INTO progress (user_id,curriculum_version,current_level_id) VALUES ($1,$2,$3)
        ON CONFLICT (user_id) DO UPDATE SET curriculum_version=$2,current_level_id=$3,updated_at=now()`, [user.id, curriculumVersion, levelId]);
      return getProgress(client, user, curriculumVersion);
    });
    res.json(progress);
  });
  router.post('/levels/:id/complete', requireAuthentication, csrf, async (req, res) => {
    const user = requireUser(req);
    const parsed = completionRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Некорректные поля запроса.');
    res.json(await completeLevel(pool, user, String(req.params.id), parsed.data));
  });
  return router;
}

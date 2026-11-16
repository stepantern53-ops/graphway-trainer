import type pg from 'pg';
import type { CompletionResult, SafeUser } from '@graphway/contracts';
import { CURRENT_CURRICULUM_VERSION, getLevel, orderedLevels } from '@graphway/curriculum';
import { validateRoute } from '@graphway/math-core';
import { transaction } from '../db/client.js';
import { ApiError } from '../errors.js';
import { getProgress } from './progress.js';

export async function completeLevel(pool: pg.Pool, user: SafeUser, levelId: string, request: { curriculumVersion: string; coefficients: Record<string, string> }): Promise<CompletionResult> {
  if (request.curriculumVersion !== CURRENT_CURRICULUM_VERSION) throw new ApiError(409, 'CURRICULUM_VERSION', 'Версия учебной карты изменилась. Обнови страницу.');
  const level = getLevel(levelId, request.curriculumVersion);
  if (!level) throw new ApiError(404, 'LEVEL_NOT_FOUND', 'Трасса не найдена.');
  const before = await getProgress(pool, user, request.curriculumVersion);
  if (!before.unlockedLevelIds.includes(levelId)) throw new ApiError(403, 'LEVEL_LOCKED', 'Сначала пройди предыдущую трассу.');
  const verdict = validateRoute(level, request.coefficients);
  if (verdict.status !== 'ready') throw new ApiError(400, 'ROUTE_INVALID', verdict.explanation);
  return transaction(pool, async client => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
    const current = await getProgress(client, user, request.curriculumVersion);
    if (!current.unlockedLevelIds.includes(levelId)) throw new ApiError(403, 'LEVEL_LOCKED', 'Сначала пройди предыдущую трассу.');
    const inserted = await client.query(`INSERT INTO completions (user_id,curriculum_version,level_id) VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING RETURNING completed_at`, [user.id, request.curriculumVersion, levelId]);
    if (inserted.rowCount) {
      const updated = await getProgress(client, user, request.curriculumVersion);
      const next = updated.nextLevelId ?? orderedLevels(request.curriculumVersion).at(-1)!.id;
      await client.query(`INSERT INTO progress (user_id,curriculum_version,current_level_id) VALUES ($1,$2,$3)
        ON CONFLICT (user_id) DO UPDATE SET curriculum_version=$2,current_level_id=$3,updated_at=now()`, [user.id, request.curriculumVersion, next]);
    }
    const saved = await client.query('SELECT completed_at FROM completions WHERE user_id=$1 AND curriculum_version=$2 AND level_id=$3', [user.id, request.curriculumVersion, levelId]);
    return { completion: { levelId, curriculumVersion: request.curriculumVersion, completedAt: saved.rows[0].completed_at.toISOString() }, progress: await getProgress(client, user, request.curriculumVersion) };
  });
}

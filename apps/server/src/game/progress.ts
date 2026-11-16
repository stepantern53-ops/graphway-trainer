import type { ProgressDTO, SafeUser } from '@graphway/contracts';
import { CURRENT_CURRICULUM_VERSION, orderedLevels } from '@graphway/curriculum';
import type { Queryable } from '../db/client.js';
import { ApiError } from '../errors.js';
import { canOpenLevel } from './access.js';

export async function getProgress(db: Queryable, user: SafeUser, version = CURRENT_CURRICULUM_VERSION): Promise<ProgressDTO> {
  const levels = orderedLevels(version);
  if (!levels.length) throw new ApiError(409, 'CURRICULUM_VERSION', 'Версия учебной карты изменилась. Обнови страницу.');
  const result = await db.query('SELECT level_id FROM completions WHERE user_id=$1 AND curriculum_version=$2', [user.id, version]);
  const completed = new Set<string>(result.rows.map(row => row.level_id));
  const stored = await db.query('SELECT current_level_id,curriculum_version FROM progress WHERE user_id=$1', [user.id]);
  const unlockedLevelIds = levels.filter(level => canOpenLevel(user, level.id, completed, version)).map(level => level.id);
  const completedLevelIds = levels.filter(level => completed.has(level.id)).map(level => level.id);
  const nextLevelId = levels.find(level => !completed.has(level.id) && unlockedLevelIds.includes(level.id))?.id ?? null;
  const saved = stored.rows[0];
  const currentLevelId = saved?.curriculum_version === version && unlockedLevelIds.includes(saved.current_level_id) ? saved.current_level_id : nextLevelId ?? levels.at(-1)!.id;
  return { curriculumVersion: version, currentLevelId, nextLevelId, completedLevelIds, unlockedLevelIds, completedCount: completedLevelIds.length, totalCount: levels.length };
}

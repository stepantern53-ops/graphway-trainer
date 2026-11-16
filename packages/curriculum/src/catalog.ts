import type { LevelDefinition } from '@graphway/contracts';
import { LINEAR_LEVELS } from './linear.js';
import { QUADRATIC_LEVELS } from './quadratic.js';

export const CURRENT_CURRICULUM_VERSION = 'graphway-v1';
export const EPISODE_IDS = ['linear', 'quadratic'] as const;
export const EPISODES = [
  { id: 'linear', title: 'Линейный путь' },
  { id: 'quadratic', title: 'Параболический путь' }
] as const;

const catalog: readonly LevelDefinition[] = [...LINEAR_LEVELS, ...QUADRATIC_LEVELS];

export function orderedLevels(version: string = CURRENT_CURRICULUM_VERSION): readonly LevelDefinition[] {
  return version === CURRENT_CURRICULUM_VERSION ? catalog : [];
}

export function getLevel(id: string, version: string = CURRENT_CURRICULUM_VERSION): LevelDefinition | undefined {
  return orderedLevels(version).find((level) => level.id === id);
}

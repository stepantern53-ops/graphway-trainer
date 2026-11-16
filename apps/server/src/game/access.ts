import type { SafeUser } from '@graphway/contracts';
import { orderedLevels } from '@graphway/curriculum';

export function canOpenLevel(user: SafeUser, levelId: string, completed: ReadonlySet<string>, version: string): boolean {
  const levels = orderedLevels(version);
  const position = levels.findIndex(level => level.id === levelId);
  if (position < 0) return false;
  return user.role === 'admin' || position === 0 || completed.has(levelId) || levels.slice(0, position).every(level => completed.has(level.id));
}

import type { LevelDefinition, TheoryLesson } from '@graphway/contracts';
import type { CoefficientName } from '@graphway/math-core';
import { theoryFor } from './theory.js';

export interface LevelInput {
  id: string;
  episodeId: 'linear' | 'quadratic';
  title: string;
  focus: string;
  goal: string;
  active: readonly CoefficientName[];
  mode: 'slider-input' | 'input';
  initial: Record<string, string>;
  fixed?: LevelDefinition['fixed'];
  exactConditions?: LevelDefinition['exactConditions'];
  geometry: LevelDefinition['geometry'];
}

export function createLevel(input: LevelInput): LevelDefinition {
  const family = input.episodeId;
  const names: readonly CoefficientName[] = family === 'linear' ? ['k', 'b'] : ['a', 'b', 'c'];
  const bounds = Object.fromEntries(names.map((name) => [name, {
    min: -6,
    max: 6,
    ...(family === 'quadratic' && name === 'a' ? { minAbs: 0.125 } : {})
  }])) as LevelDefinition['bounds'];
  const theory: TheoryLesson = theoryFor(input.id, input.focus, family, input.active, input.fixed ?? {});
  return {
    id: input.id,
    version: 'graphway-v1',
    episodeId: input.episodeId,
    title: input.title,
    focus: input.focus,
    goal: input.goal,
    theoryKey: input.id,
    controls: input.active.map((name) => ({ name, mode: input.mode })),
    initial: input.initial,
    theory,
    functionSpec: { family },
    bounds,
    ...(input.fixed && Object.keys(input.fixed).length > 0 ? { fixed: input.fixed } : {}),
    ...(input.exactConditions ? { exactConditions: input.exactConditions } : {}),
    geometry: input.geometry
  };
}

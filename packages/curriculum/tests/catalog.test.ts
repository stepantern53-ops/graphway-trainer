import { describe, expect, it } from 'vitest';
import { completionRequestSchema, levelDTOSchema } from '@graphway/contracts';
import { toRational, validateExactConditions, validateRoute } from '@graphway/math-core';
import { CURRENT_CURRICULUM_VERSION, EPISODE_IDS, getLevel, orderedLevels } from '../src/index.js';
import type { LevelId } from './witnesses.js';
import { WITNESSES } from './witnesses.js';

const ids = [
  'L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L11', 'L12',
  'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11', 'Q12'
] as const;

describe('versioned curriculum catalog', () => {
  it('exports all 24 stable lessons in episode order with strict serializable DTOs', () => {
    const levels = orderedLevels();
    expect(CURRENT_CURRICULUM_VERSION).toBe('graphway-v1');
    expect(EPISODE_IDS).toEqual(['linear', 'quadratic']);
    expect(levels.map(({ id }) => id)).toEqual(ids);
    expect(levels.every((level) => level.version === CURRENT_CURRICULUM_VERSION)).toBe(true);
    for (const level of levels) {
      expect(levelDTOSchema.safeParse(level).success, level.id).toBe(true);
      expect(Object.hasOwn(level, 'witness')).toBe(false);
      expect(JSON.stringify(level)).toBeTruthy();
    }
    expect(orderedLevels('unknown-version')).toEqual([]);
    expect(getLevel('L01', 'unknown-version')).toBeUndefined();
  });

  it('accepts every author witness without requiring the witness to be public catalog data', () => {
    expect(Object.keys(WITNESSES)).toEqual(ids);
    for (const level of orderedLevels()) {
      const result = validateRoute(level, WITNESSES[level.id as LevelId]);
      expect(result.status, level.id).toBe('ready');
    }
  });

  it('does not mark any initial coefficient set complete', () => {
    for (const level of orderedLevels()) {
      const coefficients = {
        ...level.initial,
        ...Object.fromEntries(Object.entries(level.fixed ?? {}).map(([name, value]) => [name, String(value)]))
      };
      const result = validateRoute(level, coefficients);
      expect(result.status, level.id).not.toBe('ready');
    }
  });

  it('rejects mutations of fixed coefficients', () => {
    const level = getLevel('L01');
    expect(level).toBeDefined();
    const result = validateRoute(level!, { ...WITNESSES.L01, k: '2' });
    expect(result.status).toBe('condition-mismatch');
  });

  it('retains the authored Q07 pit as a public route obstacle', () => {
    const level = getLevel('Q07');
    expect(level?.geometry.pits).toContainEqual({ x: 1, y: 1, r: 0.45 });
  });

  it('checks each exact point independently, including a wrong third point', () => {
    const level = getLevel('Q10');
    expect(level).toBeDefined();
    const result = validateExactConditions(level!, { a: toRational(2), b: toRational(-1), c: toRational(1) });
    expect(result.valid).toBe(false);
    expect(result.failedCondition).toBe(2);
  });

  it('accepts nearby valid slopes in broad L05 and L06 tasks without adding exact constraints', () => {
    const l05 = getLevel('L05');
    const l06 = getLevel('L06');
    expect(l05?.exactConditions).toBeUndefined();
    expect(l06?.exactConditions).toBeUndefined();
    expect(validateRoute(l05!, { k: '51/100' }).status).toBe('ready');
    expect(validateRoute(l06!, { k: '1/100' }).status).toBe('ready');
    expect(completionRequestSchema.safeParse({ curriculumVersion: CURRENT_CURRICULUM_VERSION, coefficients: { k: '51/100' } }).success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { completionRequestSchema, levelDTOSchema } from '../src/index.js';

const baseLevel = {
  id: 'L01',
  version: 'graphway-v1',
  episodeId: 'linear',
  title: 'Line',
  focus: 'b',
  goal: 'Connect',
  theoryKey: 'L01',
  controls: [{ name: 'b', mode: 'slider-input' }],
  initial: { b: '0' },
  theory: {
    focus: 'b',
    activeCoefficientMeaning: 'b=f(0)',
    fixedCoefficientMeaning: 'k=1',
    blocks: [{ kind: 'formula', content: 'b=f(0)' }],
    example: { prompt: 'Example', steps: ['Step'], check: 'Substitute.' }
  },
  functionSpec: { family: 'linear' },
  bounds: { k: { min: -6, max: 6 }, b: { min: -6, max: 6 } },
  fixed: { k: '1' },
  geometry: { start: { x: -3, y: -1, r: 0.8 }, goal: { x: 3, y: 5, r: 0.8 }, pits: [], domain: { min: -6, max: 6 } }
};

describe('shared GraphWay contracts', () => {
  it('parses linear levels with only their relevant coefficient keys', () => {
    expect(levelDTOSchema.safeParse(baseLevel).success).toBe(true);
  });

  it('parses quadratic levels with a different partial coefficient set', () => {
    const level = {
      ...baseLevel,
      id: 'Q01', episodeId: 'quadratic',
      controls: [{ name: 'c', mode: 'slider-input' }],
      initial: { c: '-3' },
      functionSpec: { family: 'quadratic' },
      bounds: { a: { min: -6, max: 6, minAbs: 0.125 }, b: { min: -6, max: 6 }, c: { min: -6, max: 6 } },
      fixed: { a: '1', b: '0' }
    };
    expect(levelDTOSchema.safeParse(level).success).toBe(true);
  });

  it('accepts sparse submitted coefficient maps and rejects unknown keys', () => {
    expect(completionRequestSchema.safeParse({ curriculumVersion: 'graphway-v1', coefficients: { k: '1', b: '2' } }).success).toBe(true);
    expect(completionRequestSchema.safeParse({ curriculumVersion: 'graphway-v1', coefficients: { k: '1', nope: '2' } }).success).toBe(false);
  });

  it('rejects extra public DTO fields', () => {
    expect(levelDTOSchema.safeParse({ ...baseLevel, witness: { k: '1', b: '2' } }).success).toBe(false);
  });
});

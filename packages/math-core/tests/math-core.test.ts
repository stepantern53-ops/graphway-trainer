import { describe, expect, it } from 'vitest';
import { circleContacts, evaluateFunction, isolatePolynomialRoots, parseCoefficient, rational, rationalEqual, rationalToTransport, validateExactConditions, validateRoute } from '../src/index.js';
import type { MathLevel } from '../src/index.js';

const line = { family: 'linear' } as const;
const quad = { family: 'quadratic' } as const;
const domain = { min: -6, max: 6 };
const bounds = { min: -6, max: 6 };
const base: MathLevel = { functionSpec: line, geometry: { start: { x: -3, y: 0, r: 0.5 }, goal: { x: 3, y: 0, r: 0.5 }, pits: [] } };

describe('rational coefficient input', () => {
  it.each([['-3/2', -1.5], ['0,5', 0.5], ['-.5', -0.5], [' +6 ', 6], ['-0', 0], ['1/1000000', 0.000001]])('parses %s without rounding', (raw, numeric) => {
    expect(parseCoefficient(raw, bounds)).toMatchObject({ status: 'valid', numeric });
  });
  it.each(['', '-', '+', '1/', '-1/', '.', '-.', '1,'])('marks %s incomplete', (raw) => expect(parseCoefficient(raw, bounds).status).toBe('incomplete'));
  it.each(['1/0', '1/-2', '1e0', 'NaN', 'Infinity', '0,5.1', '1+1', '1/2/3', '1 2', '1000001/1000000', '0.1234567', '7', '1'.repeat(33)])('rejects %s', (raw) => expect(parseCoefficient(raw, bounds).status).toBe('invalid'));
  it('checks quadratic minimum and rational bounds before number conversion', () => {
    expect(parseCoefficient('0', { ...bounds, minAbs: '1/8' }).status).toBe('invalid');
    expect(parseCoefficient('0.124999', { ...bounds, minAbs: '1/8' }).status).toBe('invalid');
    expect(parseCoefficient('-1/8', { ...bounds, minAbs: '1/8' }).status).toBe('valid');
    expect(parseCoefficient('1/3', { min: '1/3', max: '1/3' }).status).toBe('valid');
  });
  it('reduces signs and transports bigint as strings', () => {
    expect(rationalEqual(rational(-6n, 4n), rational(-3n, 2n))).toBe(true);
    expect(rationalToTransport(rational(6n, -4n))).toEqual({ numerator: '-3', denominator: '2' });
    expect(() => rational(1n, 0n)).toThrow();
  });
  it('never reuses an old valid route after incomplete input', () => {
    expect(validateRoute(base, { k: '0', b: '0' }).status).toBe('ready');
    expect(validateRoute(base, { k: '0', b: '1/' }).status).toBe('input-invalid');
  });
});

describe('all closed contact components', () => {
  it('finds analytic line crossings, no contact, endpoint and tangency', () => {
    expect(circleContacts(line, { k: 0, b: 0 }, { x: 0, y: 0, r: 1 }, domain)).toEqual([{ start: -1, end: 1 }]);
    expect(circleContacts(line, { k: 0, b: 0 }, { x: 0, y: 2, r: 1 }, domain)).toEqual([]);
    expect(circleContacts(line, { k: 0, b: 0 }, { x: 0, y: 1, r: 1 }, domain)).toEqual([{ start: 0, end: 0 }]);
    expect(circleContacts(line, { k: 0, b: 0 }, { x: 7, y: 0, r: 1 }, domain)).toEqual([{ start: 6, end: 6 }]);
  });
  it('preserves fourth-order tangency q=x^4', () => expect(circleContacts(quad, { a: 1, b: 0, c: 0 }, { x: 0, y: '1/2', r: '1/2' }, domain)).toEqual([{ start: 0, end: 0 }]));
  it('builds circle coefficients from original rational inputs, not rounded doubles', () => {
    expect(circleContacts(line, { k: 0, b: 0 }, { x: 0, y: '1.000000000000000000001', r: 1 }, domain)).toEqual([]);
    const contacts = circleContacts(line, { k: 0, b: 0 }, { x: 0, y: '0.999999999999999999999', r: 1 }, domain);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.start).toBeCloseTo(-4.472135954999579e-11, 20);
    expect(contacts[0]!.end).toBeCloseTo(4.472135954999579e-11, 20);
  });
  it('does not merge q=(x²-3/4)² isolated tangencies into an interval', () => {
    const contacts = circleContacts(quad, { a: 1, b: 0, c: 0 }, { x: 0, y: '5/4', r: 1 }, domain);
    expect(contacts).toHaveLength(2);
    expect(contacts[0]!.start).toBeCloseTo(-Math.sqrt(3) / 2, 12);
    expect(contacts[1]!.start).toBeCloseTo(Math.sqrt(3) / 2, 12);
    expect(contacts.every((c) => c.start === c.end)).toBe(true);
  });
  it('finds four quartic roots and exactly two separate intervals', () => {
    const contacts = circleContacts(quad, { a: 1, b: 0, c: 0 }, { x: 0, y: 1, r: '9/10' }, domain);
    expect(contacts).toHaveLength(2);
    expect(contacts[0]!.start).toBeCloseTo(-Math.sqrt((1 + Math.sqrt(0.24)) / 2), 12);
    expect(contacts[0]!.end).toBeCloseTo(-Math.sqrt((1 - Math.sqrt(0.24)) / 2), 12);
    expect(contacts[1]!.start).toBeCloseTo(-contacts[0]!.end, 12);
    expect(contacts[1]!.end).toBeCloseTo(-contacts[0]!.start, 12);
  });
  it.each(['1', '1000000000000000000000000000000', '0.000000000000000000000000000001'])('isolates close roots at scale %s from original decimals', (scale) => {
    const roots = isolatePolynomialRoots(['1.000000001', '-2.000000001', '1'], { min: 0, max: 2 }, scale);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.lower).toBeLessThanOrEqual(roots[0]!.upper);
    expect(roots[0]!.upper).toBeLessThan(roots[1]!.lower);
  });
  it('diagnoses distinct roots that cannot be represented as distinct public coordinates', () => {
    expect(() => isolatePolynomialRoots(['1.00000000000000000001', '-2.00000000000000000001', '1'], { min: 0, max: 2 })).toThrow(/точност|неразличим/);
  });
  it('handles tiny nonzero leading coefficients without degree trimming', () => {
    const roots = isolatePolynomialRoots(['-0.000000000000000000000000000001', '0', '0.000000000000000000000000000001'], domain);
    expect(roots.map((r) => r.value)).toEqual([-1, 1]);
  });
});

describe('route and exact conditions', () => {
  it('evaluates both school forms', () => {
    expect(evaluateFunction(line, { k: '-3/2', b: 1 }, 2)).toBe(-2);
    expect(evaluateFunction(quad, { a: '1/2', b: '-1/2', c: 1 }, 3)).toBe(4);
  });
  it('accepts broad circle contacts without requiring center intersections', () => {
    const result = validateRoute(base, { k: '0', b: '1/10' });
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.route.startPoint.y).toBe(0.1);
      expect(result.route.endPoint.y).toBe(0.1);
    }
  });
  it('accepts equivalent exact fractions but rejects a tiny near miss and wrong third point', () => {
    const level: MathLevel = { ...base, exactConditions: [{ x: -2, y: 4 }, { x: 2, y: -2 }] };
    expect(validateExactConditions(level, { k: rational(-3n, 2n), b: rational(1n) }).valid).toBe(true);
    expect(validateExactConditions(level, { k: rational(-3n, 2n), b: rational(1000001n, 1000000n) }).valid).toBe(false);
    const three = { ...base, functionSpec: quad, exactConditions: [{ x: -1, y: 4 }, { x: 0, y: 1 }, { x: 2, y: 2 }] };
    expect(validateExactConditions(three, { a: rational(1n), b: rational(-2n), c: rational(1n) }).valid).toBe(false);
  });
  it('rejects family/fixed/bounds before geometry', () => {
    expect(validateRoute({ ...base, fixed: { k: 0 } }, { k: '1', b: '0' }).status).toBe('condition-mismatch');
    expect(validateRoute({ ...base, functionSpec: quad }, { a: '0', b: '0', c: '0' }).status).toBe('input-invalid');
    expect(validateRoute(base, { k: '7', b: '0' }).status).toBe('input-invalid');
    expect(validateRoute({ ...base, functionSpec: quad, fixed: { a: 0 } }, { b: '0', c: '0' }).status).toBe('input-invalid');
    expect(validateRoute({ ...base, fixed: { k: 7 } }, { b: '0' }).status).toBe('input-invalid');
  });
  it('blocks pit tangency but ignores a pit after the goal', () => {
    expect(validateRoute({ ...base, geometry: { ...base.geometry, pits: [{ x: 0, y: 1, r: 1 }] } }, { k: '0', b: '0' })).toMatchObject({ status: 'pit-contact', preview: { firstPitX: 0 } });
    expect(validateRoute({ ...base, geometry: { ...base.geometry, pits: [{ x: 5, y: 0, r: 1 }] } }, { k: '0', b: '0' }).status).toBe('ready');
  });
  it('allows a fourth-order goal tangency but blocks the same circle as a pit', () => {
    const level: MathLevel = { functionSpec: quad, geometry: { start: { x: -1, y: 1, r: '1/10' }, goal: { x: 0, y: '1/2', r: '1/2' }, pits: [] } };
    const arrival = validateRoute(level, { a: '1', b: '0', c: '0' });
    expect(arrival.status).toBe('ready');
    if (arrival.status === 'ready') expect(arrival.route.endX).toBe(0);
    expect(validateRoute({ ...level, geometry: { ...level.geometry, goal: { x: 1, y: 1, r: '1/10' }, pits: [level.geometry.goal] } }, { a: '1', b: '0', c: '0' })).toMatchObject({ status: 'pit-contact', preview: { firstPitX: 0 } });
  });
  it('tries a later safe start instead of rejecting blocked first pair, including overlapping projections', () => {
    const level: MathLevel = { functionSpec: quad, geometry: { start: { x: 0, y: 1, r: '9/10' }, goal: { x: 2, y: 4, r: '1/4' }, pits: [{ x: 0, y: 0, r: '1/10' }] } };
    const result = validateRoute(level, { a: '1', b: '0', c: '0' });
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.route.startX).toBeGreaterThan(0.8);
  });
  it('selects the first of two eligible goal components', () => {
    const level: MathLevel = { functionSpec: quad, geometry: { start: { x: -2, y: 4, r: '1/4' }, goal: { x: 0, y: 1, r: '9/10' }, pits: [] } };
    const result = validateRoute(level, { a: '1', b: '0', c: '0' });
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.route.endX).toBeLessThan(-0.8);
  });
  it('treats isolated quartic pit contacts as forbidden without blocking the gap', () => {
    const level: MathLevel = { functionSpec: quad, geometry: { start: { x: '-1/4', y: '1/16', r: '1/100' }, goal: { x: '1/4', y: '1/16', r: '1/100' }, pits: [{ x: 0, y: '5/4', r: 1 }] } };
    expect(validateRoute(level, { a: '1', b: '0', c: '0' }).status).toBe('ready');
    expect(validateRoute({ ...level, geometry: { ...level.geometry, start: { x: -1, y: 1, r: '1/100' }, goal: { x: 1, y: 1, r: '1/100' } } }, { a: '1', b: '0', c: '0' }).status).toBe('pit-contact');
  });
  it.each([-1, 1])('blocks an irrational shared pit endpoint on side %s', (side) => {
    const tangent = { x: 0, y: '5/4', r: 1 };
    const outer = { x: side * 2, y: 4, r: '1/4' };
    const level: MathLevel = { functionSpec: quad, geometry: { start: side === 1 ? tangent : outer, goal: side === 1 ? outer : tangent, pits: [{ x: 0, y: '5/8', r: '7/8' }] } };
    expect(validateRoute(level, { a: '1', b: '0', c: '0' }).status).toBe('pit-contact');
  });
  it.each([-1, 1])('blocks nonterminating rational shared pit endpoint on side %s', (side) => {
    const tangent = { x: side === 1 ? '1/3' : '-1/3', y: 1, r: 1 };
    const outer = { x: side * 3, y: 0, r: '1/4' };
    const level: MathLevel = { functionSpec: line, geometry: { start: side === 1 ? tangent : outer, goal: side === 1 ? outer : tangent, pits: [{ x: 0, y: 0, r: '1/3' }] } };
    expect(validateRoute(level, { k: '0', b: '0' }).status).toBe('pit-contact');
  });
  it('substitutes missing fixed values but rejects unknown and mutated coefficients', () => {
    const fixed = { ...base, fixed: { k: 0 } };
    expect(validateRoute(fixed, { b: '0' }).status).toBe('ready');
    expect(validateRoute(fixed, { b: '0', a: '1' }).status).toBe('input-invalid');
    expect(validateRoute(fixed, { k: '1', b: '0' }).status).toBe('condition-mismatch');
  });
  it('reports no-start/no-goal/wrong-order rather than arbitrary failure', () => {
    expect(validateRoute(base, { k: '0', b: '4' }).status).toBe('no-start');
    expect(validateRoute({ ...base, geometry: { ...base.geometry, goal: { x: 3, y: 3, r: 0.1 } } }, { k: '0', b: '0' }).status).toBe('no-goal');
    expect(validateRoute({ ...base, geometry: { ...base.geometry, start: base.geometry.goal, goal: base.geometry.start } }, { k: '0', b: '0' }).status).toBe('wrong-order');
  });
});

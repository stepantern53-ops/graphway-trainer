import type { Decimal } from 'decimal.js';
import { Decimal80, DecimalCeil80, DecimalFloor80, NUMERIC_POLICY, NumericUncertainError } from './numeric-policy.js';
import { rational, rationalAdd, rationalDivide, rationalMultiply, rationalSubtract, rationalToNumber, toRational } from './rational.js';
import type { Domain, Rational, RootBracket, Scalar } from './types.js';

const ZERO = rational(0n);
const ONE = rational(1n);
export interface DecimalRootBracket { readonly lower: Decimal; readonly upper: Decimal; readonly value: Decimal }
export interface IsolatedPolynomial { readonly coefficients: readonly Rational[]; readonly roots: readonly DecimalRootBracket[] }
export interface AlgebraicBoundary extends DecimalRootBracket { readonly polynomial: readonly Rational[] }

export function trimPolynomial(source: readonly Rational[]): Rational[] {
  const p = [...source];
  while (p.length > 1 && p[p.length - 1]!.numerator === 0n) p.pop();
  return p.length ? p : [ZERO];
}
export function evaluatePolynomialExact(p: readonly Rational[], x: Rational): Rational {
  let value = ZERO;
  for (let i = p.length - 1; i >= 0; i--) value = rationalAdd(rationalMultiply(value, x), p[i]!);
  return value;
}
function derivative(p: readonly Rational[]): Rational[] {
  return trimPolynomial(p.slice(1).map((coefficient, i) => rationalMultiply(coefficient, rational(BigInt(i + 1)))));
}
function dividePolynomial(dividend: readonly Rational[], divisor: readonly Rational[]): { quotient: Rational[]; remainder: Rational[] } {
  let remainder = trimPolynomial(dividend);
  const denominator = trimPolynomial(divisor);
  if (denominator.length === 1 && denominator[0]!.numerator === 0n) throw new RangeError('Zero polynomial divisor');
  const quotient = Array.from({ length: Math.max(1, remainder.length - denominator.length + 1) }, () => ZERO);
  while (remainder.length >= denominator.length && !(remainder.length === 1 && remainder[0]!.numerator === 0n)) {
    const offset = remainder.length - denominator.length;
    const factor = rationalDivide(remainder[remainder.length - 1]!, denominator[denominator.length - 1]!);
    quotient[offset] = factor;
    for (let i = 0; i < denominator.length; i++) remainder[i + offset] = rationalSubtract(remainder[i + offset]!, rationalMultiply(factor, denominator[i]!));
    remainder = trimPolynomial(remainder);
  }
  return { quotient: trimPolynomial(quotient), remainder };
}
function polynomialGcd(first: readonly Rational[], second: readonly Rational[]): Rational[] {
  let a = trimPolynomial(first);
  let b = trimPolynomial(second);
  while (!(b.length === 1 && b[0]!.numerator === 0n)) {
    const remainder = dividePolynomial(a, b).remainder;
    a = b;
    b = remainder;
  }
  return a;
}
/** Exact square-free reduction keeps distinct roots and removes multiple-root ambiguity. */
function squareFree(source: readonly Rational[]): Rational[] {
  const p = trimPolynomial(source);
  if (p.length < 3) return p;
  return dividePolynomial(p, polynomialGcd(p, derivative(p))).quotient;
}
function decimalCoefficients(p: readonly Rational[]): Decimal[] {
  const values = p.map((c) => new Decimal80(c.numerator.toString()).div(c.denominator.toString()));
  const scale = values.reduce((maximum, value) => Decimal80.max(maximum, value.abs()), new Decimal80(0));
  return scale.isZero() ? values : values.map((value) => value.div(scale));
}
function decimalValueAndScale(p: readonly Decimal[], x: Decimal): { value: Decimal; scale: Decimal } {
  let value = new Decimal80(0);
  let scale = new Decimal80(0);
  for (let i = p.length - 1; i >= 0; i--) { value = value.times(x).plus(p[i]!); scale = scale.times(x.abs()).plus(p[i]!.abs()); }
  return { value, scale };
}
function exactSign(p: readonly Rational[], x: Decimal): number {
  const value = evaluatePolynomialExact(p, toRational(x.toString()));
  return value.numerator < 0n ? -1 : value.numerator > 0n ? 1 : 0;
}
function doubleRoots(source: readonly Rational[], lo: number, hi: number, width: number): RootBracket[] {
  const p = squareFree(source);
  if (p.length <= 1) return [];
  if (p.length === 2) {
    const root = rationalToNumber(rationalDivide(rational(-p[0]!.numerator, p[0]!.denominator), p[1]!));
    return root >= lo && root <= hi ? [{ lower: root, upper: root, value: root }] : [];
  }
  const coefficients = p.map(rationalToNumber);
  const maximum = Math.max(...coefficients.map(Math.abs));
  const normalized = coefficients.map((c) => c / maximum);
  if (normalized.some((c, i) => !Number.isFinite(c) || (c === 0 && p[i]!.numerator !== 0n))) throw new NumericUncertainError();
  const critical = doubleRoots(derivative(p), lo, hi, width / 8);
  const partitions = [lo, ...critical.map((r) => r.value).filter((x) => x > lo && x < hi), hi];
  const roots: RootBracket[] = [];
  const sign = (x: number): number => {
    let value = 0;
    let scale = 0;
    for (let i = normalized.length - 1; i >= 0; i--) { value = value * x + normalized[i]!; scale = scale * Math.abs(x) + Math.abs(normalized[i]!); }
    if (Math.abs(value) <= NUMERIC_POLICY.doubleResidualFactor * Math.max(1, scale)) {
      if (evaluatePolynomialExact(p, toRational(x)).numerator === 0n) return 0;
      throw new NumericUncertainError();
    }
    return value < 0 ? -1 : 1;
  };
  for (let i = 0; i < partitions.length; i++) {
    const x = partitions[i]!;
    const at = sign(x);
    if (at === 0) roots.push({ lower: x, upper: x, value: x });
    if (i === partitions.length - 1) break;
    let left = x;
    let right = partitions[i + 1]!;
    let leftSign = at;
    const rightSign = sign(right);
    if (leftSign === 0 || rightSign === 0 || leftSign === rightSign) continue;
    while (right - left > width) {
      const middle = (left + right) / 2;
      if (middle === left || middle === right) throw new NumericUncertainError();
      const middleSign = sign(middle);
      if (middleSign === 0) { left = middle; right = middle; break; }
      if (middleSign === leftSign) { left = middle; leftSign = middleSign; } else right = middle;
    }
    roots.push({ lower: left, upper: right, value: (left + right) / 2 });
  }
  return roots.sort((a, b) => a.value - b.value);
}
function decimalRoots(source: readonly Rational[], lo: Decimal, hi: Decimal, width: Decimal): DecimalRootBracket[] {
  const p = squareFree(source);
  if (p.length <= 1) return [];
  const coefficients = decimalCoefficients(p);
  if (p.length === 2) {
    const exact = rationalDivide(rational(-p[0]!.numerator, p[0]!.denominator), p[1]!);
    const lower = new DecimalFloor80(exact.numerator.toString()).div(exact.denominator.toString());
    const upper = new DecimalCeil80(exact.numerator.toString()).div(exact.denominator.toString());
    const value = new Decimal80(exact.numerator.toString()).div(exact.denominator.toString());
    return upper.gte(lo) && lower.lte(hi) ? [{ lower, upper, value }] : [];
  }
  const critical = decimalRoots(derivative(p), lo, hi, width.div(1024));
  const partitions = [lo, ...critical.map((r) => r.value).filter((x) => x.gt(lo) && x.lt(hi)), hi];
  const roots: DecimalRootBracket[] = [];
  const sign = (x: Decimal, criticalPoint = false): number => {
    const { value, scale } = decimalValueAndScale(coefficients, x);
    if (value.abs().lte(Decimal80.max(1, scale).times(NUMERIC_POLICY.decimalRelativeResidual))) {
      const exact = exactSign(p, x);
      if (exact !== 0 && criticalPoint) throw new NumericUncertainError();
      return exact;
    }
    return value.isNegative() ? -1 : 1;
  };
  for (let i = 0; i < partitions.length; i++) {
    const x = partitions[i]!;
    const at = sign(x, i > 0 && i < partitions.length - 1);
    if (at === 0) roots.push({ lower: x, upper: x, value: x });
    if (i === partitions.length - 1) break;
    let left = x;
    let right = partitions[i + 1]!;
    let leftSign = at;
    const rightSign = sign(right, i + 1 < partitions.length - 1);
    if (leftSign === 0 || rightSign === 0 || leftSign === rightSign) continue;
    let iterations = 0;
    while (right.minus(left).gt(width)) {
      if (++iterations > 1024) throw new NumericUncertainError();
      const middle = left.plus(right).div(2);
      if (middle.eq(left) || middle.eq(right)) throw new NumericUncertainError();
      const middleSign = sign(middle);
      if (middleSign === 0) { left = middle; right = middle; break; }
      if (middleSign === leftSign) { left = middle; leftSign = middleSign; } else right = middle;
    }
    roots.push({ lower: left, upper: right, value: left.plus(right).div(2) });
  }
  return roots.sort((a, b) => a.value.comparedTo(b.value));
}
/** Substitute x=center+half*z exactly, keeping numerical isolation within [-1,1]. */
function normalizeDomain(p: readonly Rational[], center: Rational, half: Rational): Rational[] {
  let result = [ZERO];
  for (let i = p.length - 1; i >= 0; i--) {
    const next = Array.from({ length: result.length + 1 }, () => ZERO);
    for (let j = 0; j < result.length; j++) {
      next[j] = rationalAdd(next[j]!, rationalMultiply(result[j]!, center));
      next[j + 1] = rationalAdd(next[j + 1]!, rationalMultiply(result[j]!, half));
    }
    next[0] = rationalAdd(next[0]!, p[i]!);
    result = trimPolynomial(next);
  }
  return result;
}
export function isolatePolynomial(source: readonly Scalar[], domain: Domain): IsolatedPolynomial {
  if (!Number.isFinite(domain.min) || !Number.isFinite(domain.max) || domain.min >= domain.max) throw new RangeError('Invalid domain');
  const coefficients = trimPolynomial(source.map(toRational));
  const minimum = toRational(domain.min);
  const maximum = toRational(domain.max);
  const center = rationalDivide(rationalAdd(minimum, maximum), rational(2n));
  const half = rationalDivide(rationalSubtract(maximum, minimum), rational(2n));
  const normalized = normalizeDomain(coefficients, center, half);
  const dHalf = new Decimal80(half.numerator.toString()).div(half.denominator.toString());
  let roots: DecimalRootBracket[];
  try {
    const doubles = doubleRoots(normalized, -1, 1, NUMERIC_POLICY.doubleWidth / rationalToNumber(half));
    // Polish the double brackets from the original exact polynomial at decimal precision.
    // Full derivative partition is used if a double evaluation was ambiguous.
    const originalDecimal = decimalCoefficients(normalized);
    roots = doubles.map((root) => {
      if (root.lower === root.upper && exactSign(normalized, new Decimal80(root.value)) === 0) {
        const value = new Decimal80(root.value);
        return { lower: value, upper: value, value };
      }
      let left = new Decimal80(root.lower);
      let right = new Decimal80(root.upper);
      let leftSign = decimalValueAndScale(originalDecimal, left).value.comparedTo(0);
      const rightSign = decimalValueAndScale(originalDecimal, right).value.comparedTo(0);
      if (leftSign === 0 || rightSign === 0 || leftSign === rightSign) throw new NumericUncertainError();
      const width = new Decimal80(NUMERIC_POLICY.decimalWidth).div(dHalf);
      while (right.minus(left).gt(width)) {
        const middle = left.plus(right).div(2);
        const middleSign = exactSign(normalized, middle);
        if (middleSign === 0) { left = middle; right = middle; break; }
        if (middleSign === leftSign) { left = middle; leftSign = middleSign; } else right = middle;
      }
      return { lower: left, upper: right, value: left.plus(right).div(2) };
    });
  } catch (error) {
    if (!(error instanceof NumericUncertainError)) throw error;
    roots = decimalRoots(normalized, new Decimal80(-1), new Decimal80(1), new Decimal80(NUMERIC_POLICY.decimalWidth).div(dHalf));
  }
  roots = roots.map((root) => {
    const exactLower = rationalAdd(rationalMultiply(toRational(root.lower.toString()), half), center);
    const exactUpper = rationalAdd(rationalMultiply(toRational(root.upper.toString()), half), center);
    const lower = new DecimalFloor80(exactLower.numerator.toString()).div(exactLower.denominator.toString());
    const upper = new DecimalCeil80(exactUpper.numerator.toString()).div(exactUpper.denominator.toString());
    return { lower, upper, value: new Decimal80(lower).plus(upper).div(2) };
  });
  // No distance epsilon: only overlapping isolation brackets denote a duplicate.
  const distinct: DecimalRootBracket[] = [];
  for (const root of roots) {
    const previous = distinct[distinct.length - 1];
    if (previous && root.lower.lte(previous.upper)) {
      const lower = Decimal80.max(previous.lower, root.lower);
      const upper = Decimal80.min(previous.upper, root.upper);
      distinct[distinct.length - 1] = { lower, upper, value: lower.plus(upper).div(2) };
    } else distinct.push(root);
  }
  for (let i = 1; i < distinct.length; i++) if (distinct[i - 1]!.value.toNumber() >= distinct[i]!.value.toNumber()) throw new NumericUncertainError('Различные контакты неразличимы в координатах отображения.');
  return { coefficients, roots: distinct };
}
export function isolatePolynomialRoots(source: readonly Scalar[], domain: Domain, scale: Scalar = ONE): RootBracket[] {
  const multiplier = toRational(scale);
  if (multiplier.numerator === 0n) throw new RangeError('Zero polynomial scale');
  return isolatePolynomial(source.map((c) => rationalMultiply(toRational(c), multiplier)), domain).roots.map((root) => ({ lower: root.lower.toNumber(), upper: root.upper.toNumber(), value: root.value.toNumber() }));
}
/** Compare isolated algebraic contacts; overlapping brackets require proven shared-root identity. */
export function compareBoundaries(a: AlgebraicBoundary, b: AlgebraicBoundary): number {
  if (a.upper.lt(b.lower)) return -1;
  if (a.lower.gt(b.upper)) return 1;
  const common = polynomialGcd(a.polynomial, b.polynomial);
  if (common.length > 1) {
    const lower = Decimal80.max(a.lower, b.lower);
    const upper = Decimal80.min(a.upper, b.upper);
    if (lower.eq(upper)) {
      if (exactSign(common, lower) === 0) return 0;
    } else if (decimalRoots(common, lower, upper, new Decimal80('1e-48')).length > 0) return 0;
  }
  throw new NumericUncertainError('Изолирующие скобки разных контактов перекрываются.');
}

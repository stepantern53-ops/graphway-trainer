import type { Decimal } from 'decimal.js';
import { functionPolynomial } from './evaluate-function.js';
import { Decimal80 } from './numeric-policy.js';
import { evaluatePolynomialExact, isolatePolynomial } from './polynomial.js';
import type { AlgebraicBoundary } from './polynomial.js';
import { rational, rationalAdd, rationalMultiply, rationalSubtract, toRational } from './rational.js';
import type { Circle, Coefficients, ContactInterval, Domain, FunctionSpec, Rational } from './types.js';

export const DEFAULT_DOMAIN: Domain = Object.freeze({ min: -6, max: 6 });
export interface DecimalContactInterval { readonly start: Decimal; readonly end: Decimal; readonly startBoundary: AlgebraicBoundary; readonly endBoundary: AlgebraicBoundary }
export function circlePolynomial(spec: FunctionSpec, coefficients: Coefficients, circle: Circle): Rational[] {
  const f = functionPolynomial(spec, coefficients);
  const u = toRational(circle.x);
  const w = toRational(circle.y);
  const r = toRational(circle.r);
  if (r.numerator < 0n) throw new RangeError('Negative circle radius');
  f[0] = rationalSubtract(f[0]!, w);
  const q = Array.from({ length: 2 * f.length - 1 }, () => rational(0n));
  for (let i = 0; i < f.length; i++) for (let j = 0; j < f.length; j++) q[i + j] = rationalAdd(q[i + j]!, rationalMultiply(f[i]!, f[j]!));
  q[0] = rationalAdd(q[0]!, rationalSubtract(rationalMultiply(u, u), rationalMultiply(r, r)));
  q[1] = rationalSubtract(q[1]!, rationalMultiply(rational(2n), u));
  q[2] = rationalAdd(q[2]!, rational(1n));
  return q;
}
export function circleContactDetails(spec: FunctionSpec, coefficients: Coefficients, circle: Circle, domain: Domain = DEFAULT_DOMAIN): DecimalContactInterval[] {
  const polynomial = circlePolynomial(spec, coefficients, circle);
  const { roots } = isolatePolynomial(polynomial, domain);
  const minimum = new Decimal80(domain.min);
  const maximum = new Decimal80(domain.max);
  const minimumBoundary: AlgebraicBoundary = { value: minimum, lower: minimum, upper: minimum, polynomial: [toRational(-domain.min), rational(1n)] };
  const maximumBoundary: AlgebraicBoundary = { value: maximum, lower: maximum, upper: maximum, polynomial: [toRational(-domain.max), rational(1n)] };
  const nodes: AlgebraicBoundary[] = [minimumBoundary, ...roots.filter((root) => root.value.gt(minimum) && root.value.lt(maximum)).map((root) => ({ ...root, polynomial })), maximumBoundary];
  const zeros = nodes.map((node, index) => (index > 0 && index < nodes.length - 1) || evaluatePolynomialExact(polynomial, toRational(node.value.toString())).numerator === 0n);
  const contacts: DecimalContactInterval[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (zeros[i]) contacts.push({ start: node.value, end: node.value, startBoundary: node, endBoundary: node });
    if (i + 1 < nodes.length) {
      const next = nodes[i + 1]!;
      const middle = toRational(node.value.plus(next.value).div(2).toString());
      // Classify the open cell, not the roots: two positive-side tangencies stay separate.
      if (evaluatePolynomialExact(polynomial, middle).numerator < 0n) contacts.push({ start: node.value, end: next.value, startBoundary: node, endBoundary: next });
    }
  }
  const merged: DecimalContactInterval[] = [];
  for (const contact of contacts) {
    const previous = merged[merged.length - 1];
    if (previous && contact.start.lte(previous.end)) merged[merged.length - 1] = { start: previous.start, end: contact.end, startBoundary: previous.startBoundary, endBoundary: contact.endBoundary };
    else merged.push(contact);
  }
  return merged;
}
export function circleContacts(spec: FunctionSpec, coefficients: Coefficients, circle: Circle, domain: Domain = DEFAULT_DOMAIN): ContactInterval[] {
  return circleContactDetails(spec, coefficients, circle, domain).map((contact) => ({ start: contact.start.toNumber(), end: contact.end.toNumber() }));
}

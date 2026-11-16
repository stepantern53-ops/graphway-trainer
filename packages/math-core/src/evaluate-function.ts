import { rational, rationalAdd, rationalMultiply, rationalToNumber, toRational } from './rational.js';
import type { CoefficientName, Coefficients, FunctionSpec, Rational, RationalCoefficients, Scalar } from './types.js';

export function coefficientNames(spec: FunctionSpec): readonly CoefficientName[] {
  return spec.family === 'linear' ? ['k', 'b'] : ['a', 'b', 'c'];
}
export function functionPolynomial(spec: FunctionSpec, coefficients: Coefficients): Rational[] {
  const names = coefficientNames(spec);
  for (const name of names) if (coefficients[name] === undefined) throw new RangeError(`Missing coefficient ${name}`);
  return spec.family === 'linear'
    ? [toRational(coefficients.b!), toRational(coefficients.k!)]
    : [toRational(coefficients.c!), toRational(coefficients.b!), toRational(coefficients.a!)];
}
export function evaluateRational(spec: FunctionSpec, coefficients: RationalCoefficients, x: Scalar): Rational {
  const polynomial = functionPolynomial(spec, coefficients);
  const argument = toRational(x);
  let value = rational(0n);
  for (let i = polynomial.length - 1; i >= 0; i--) value = rationalAdd(rationalMultiply(value, argument), polynomial[i]!);
  return value;
}
export function evaluateFunction(spec: FunctionSpec, coefficients: Coefficients, x: number): number {
  const polynomial = functionPolynomial(spec, coefficients);
  let value = 0;
  for (let i = polynomial.length - 1; i >= 0; i--) value = value * x + rationalToNumber(polynomial[i]!);
  return value;
}

import type { Rational, Scalar, TransportRational } from './types.js';

export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new RangeError('Zero rational denominator');
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: numerator / a, denominator: denominator / a };
}
export function rationalAdd(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}
export function rationalSubtract(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}
export function rationalMultiply(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.numerator, a.denominator * b.denominator);
}
export function rationalDivide(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.denominator, a.denominator * b.numerator);
}
export function rationalCompare(a: Rational, b: Rational): number {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
export function rationalEqual(a: Rational, b: Rational): boolean { return rationalCompare(a, b) === 0; }
export function rationalToNumber(a: Rational): number { return Number(a.numerator) / Number(a.denominator); }
export function rationalToTransport(a: Rational): TransportRational {
  return { numerator: a.numerator.toString(), denominator: a.denominator.toString() };
}
/** Trusted scalar conversion, separate from the bounded student-input grammar. */
export function toRational(value: Scalar): Rational {
  if (typeof value === 'object') return rational(value.numerator, value.denominator);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Nonfinite scalar');
  const source = String(value).replace(',', '.');
  if (/^[+-]?\d+\/\d+$/.test(source)) {
    const [n, d] = source.split('/');
    return rational(BigInt(n!), BigInt(d!));
  }
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(source);
  if (!match || !(match[2] || match[3])) throw new RangeError('Invalid mathematical scalar');
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? 0) - fraction.length;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) throw new RangeError('Scalar exponent out of range');
  const n = BigInt((match[1] === '-' ? '-' : '') + (match[2] || '0') + fraction);
  return exponent >= 0 ? rational(n * 10n ** BigInt(exponent)) : rational(n, 10n ** BigInt(-exponent));
}

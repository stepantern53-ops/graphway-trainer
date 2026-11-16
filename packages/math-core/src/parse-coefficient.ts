import { rational, rationalCompare, rationalToNumber, toRational } from './rational.js';
import type { CoefficientBounds, ParsedCoefficient } from './types.js';

export const DEFAULT_COEFFICIENT_BOUNDS: CoefficientBounds = Object.freeze({ min: -6, max: 6 });
export const QUADRATIC_A_BOUNDS: CoefficientBounds = Object.freeze({ min: -6, max: 6, minAbs: '1/8' });
export function parseCoefficient(raw: string, bounds: CoefficientBounds = DEFAULT_COEFFICIENT_BOUNDS): ParsedCoefficient {
  if (typeof raw !== 'string' || raw.length > 32) return { status: 'invalid', explanation: 'Введите число длиной не более 32 символов.' };
  const text = raw.trim();
  if (/^[+-]?$/.test(text) || /^[+-]?\d+\/$/.test(text) || /^[+-]?\d*[.,]$/.test(text)) return { status: 'incomplete', explanation: 'Закончите ввод числа.' };
  let value;
  if (/^[+-]?\d+\/\d+$/.test(text)) {
    const [numerator, denominator] = text.split('/');
    const n = BigInt(numerator!);
    const d = BigInt(denominator!);
    if (d === 0n || d > 1_000_000n || n > 1_000_000n || n < -1_000_000n) return { status: 'invalid', explanation: 'Числитель и знаменатель должны быть не больше 1000000, знаменатель положителен.' };
    value = rational(n, d);
  } else if (/^[+-]?(?:\d+(?:[.,]\d{1,6})?|[.,]\d{1,6})$/.test(text)) {
    value = toRational(text);
  } else return { status: 'invalid', explanation: 'Введите целое, десятичное число или простую дробь без операций.' };
  const absolute = rational(value.numerator < 0n ? -value.numerator : value.numerator, value.denominator);
  if (rationalCompare(value, toRational(bounds.min)) < 0 || rationalCompare(value, toRational(bounds.max)) > 0 || (bounds.minAbs !== undefined && rationalCompare(absolute, toRational(bounds.minAbs)) < 0)) return { status: 'invalid', explanation: 'Число вне допустимого диапазона коэффициента.' };
  return { status: 'valid', rational: value, numeric: rationalToNumber(value) };
}

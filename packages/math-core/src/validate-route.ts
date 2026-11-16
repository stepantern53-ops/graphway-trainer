import type { Decimal } from 'decimal.js';
import { circleContactDetails, DEFAULT_DOMAIN } from './circle-contacts.js';
import { coefficientNames, evaluateFunction } from './evaluate-function.js';
import { validateExactConditions } from './exact-conditions.js';
import { Decimal80, NumericUncertainError } from './numeric-policy.js';
import { compareBoundaries } from './polynomial.js';
import type { AlgebraicBoundary } from './polynomial.js';
import { DEFAULT_COEFFICIENT_BOUNDS, parseCoefficient, QUADRATIC_A_BOUNDS } from './parse-coefficient.js';
import { rationalCompare, rationalEqual, rationalToNumber, toRational } from './rational.js';
import type { CoefficientName, MathLevel, NumericCoefficients, Rational, Route, RoutePreview, RouteValidation } from './types.js';

export function validateRoute(level: MathLevel, rawCoefficients: Readonly<Record<string, string>>): RouteValidation {
  const reject = (status: Exclude<RouteValidation['status'], 'ready'>, explanation: string, preview: RoutePreview | null = null): RouteValidation => ({ status, explanation, preview });
  if (!rawCoefficients || typeof rawCoefficients !== 'object' || Array.isArray(rawCoefficients) || !['linear', 'quadratic'].includes(level.functionSpec.family)) return reject('input-invalid', 'Некорректные коэффициенты или семейство функции.');
  const names = coefficientNames(level.functionSpec);
  if (Object.keys(rawCoefficients).some((name) => !names.includes(name as CoefficientName))) return reject('input-invalid', 'Неизвестный коэффициент для этой функции.');
  const rationals: Partial<Record<CoefficientName, Rational>> = {};
  const coefficients: Partial<Record<CoefficientName, number>> = {};
  for (const name of names) {
    const fixed = level.fixed?.[name];
    const raw = rawCoefficients[name];
    let value: Rational;
    if (raw === undefined && fixed !== undefined) value = toRational(fixed);
    else {
      if (typeof raw !== 'string') return reject('input-invalid', 'Заполните все изменяемые коэффициенты.');
      const parsed = parseCoefficient(raw, name === 'a' ? QUADRATIC_A_BOUNDS : DEFAULT_COEFFICIENT_BOUNDS);
      if (parsed.status !== 'valid') return reject('input-invalid', `${name}: ${parsed.explanation}`);
      value = parsed.rational;
    }
    if (fixed !== undefined && !rationalEqual(value, toRational(fixed))) return reject('condition-mismatch', `Коэффициент ${name} зафиксирован условием.`);
    const absolute = { numerator: value.numerator < 0n ? -value.numerator : value.numerator, denominator: value.denominator };
    const requiredBounds = [name === 'a' ? QUADRATIC_A_BOUNDS : DEFAULT_COEFFICIENT_BOUNDS, level.bounds?.[name]];
    for (const bounds of requiredBounds) {
      if (bounds && (rationalCompare(value, toRational(bounds.min)) < 0 || rationalCompare(value, toRational(bounds.max)) > 0 || (bounds.minAbs !== undefined && rationalCompare(absolute, toRational(bounds.minAbs)) < 0))) return reject('input-invalid', `${name}: число вне допустимого диапазона.`);
    }
    rationals[name] = value;
    coefficients[name] = rationalToNumber(value);
  }
  const exact = validateExactConditions(level, rationals);
  if (!exact.valid) return reject('condition-mismatch', exact.explanation);
  try {
    const domain = level.geometry.domain ?? DEFAULT_DOMAIN;
    const starts = circleContactDetails(level.functionSpec, rationals, level.geometry.start, domain);
    if (starts.length === 0) return reject('no-start', 'График не касается стартовой области.');
    const goals = circleContactDetails(level.functionSpec, rationals, level.geometry.goal, domain);
    if (goals.length === 0) return reject('no-goal', 'График не касается целевой области.');
    const candidates: { s: AlgebraicBoundary; t: AlgebraicBoundary }[] = [];
    for (const start of starts) for (const goal of goals) if (compareBoundaries(start.endBoundary, goal.startBoundary) < 0) candidates.push({ s: start.endBoundary, t: goal.startBoundary });
    candidates.sort((a, b) => compareBoundaries(a.t, b.t) || compareBoundaries(b.s, a.s));
    if (candidates.length === 0) return reject('wrong-order', 'Целевой контакт должен быть правее выхода со старта.');
    const pits = level.geometry.pits.flatMap((pit) => circleContactDetails(level.functionSpec, rationals, pit, domain));
    let diagnostic: RoutePreview | null = null;
    for (const { s, t } of candidates) {
      const startX = s.value.toNumber();
      const endX = t.value.toNumber();
      if (startX >= endX) throw new NumericUncertainError();
      const route: Route = { startX, endX, startPoint: { x: startX, y: evaluateFunction(level.functionSpec, rationals, startX) }, endPoint: { x: endX, y: evaluateFunction(level.functionSpec, rationals, endX) } };
      let firstPit: Decimal | null = null;
      for (const pit of pits) {
        if (compareBoundaries(pit.startBoundary, t) <= 0 && compareBoundaries(pit.endBoundary, s) >= 0) {
          const contact = Decimal80.max(s.value, pit.start);
          if (firstPit === null || contact.lt(firstPit)) firstPit = contact;
        }
      }
      const preview: RoutePreview = { route, firstPitX: firstPit?.toNumber() ?? null, safeEndX: firstPit?.toNumber() ?? endX };
      if (!diagnostic) diagnostic = preview;
      if (firstPit === null) return { status: 'ready', explanation: 'Маршрут готов.', preview, route, coefficients: coefficients as NumericCoefficients, rationals };
    }
    return reject('pit-contact', 'Маршрут касается ямы. Измените коэффициенты.', diagnostic);
  } catch (error) {
    if (!(error instanceof NumericUncertainError)) throw error;
    return reject('numeric-uncertain', error.message);
  }
}

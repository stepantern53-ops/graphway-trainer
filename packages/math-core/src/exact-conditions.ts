import { evaluateRational } from './evaluate-function.js';
import { rationalEqual, toRational } from './rational.js';
import type { ExactValidation, MathLevel, RationalCoefficients } from './types.js';

export function validateExactConditions(level: MathLevel, rationals: RationalCoefficients): ExactValidation {
  for (const [index, condition] of (level.exactConditions ?? []).entries()) {
    if (!rationalEqual(evaluateRational(level.functionSpec, rationals, condition.x), toRational(condition.y))) return { valid: false, failedCondition: index, explanation: 'Функция должна точно проходить через все заданные точки.' };
  }
  return { valid: true, explanation: 'Все точные условия выполнены.' };
}

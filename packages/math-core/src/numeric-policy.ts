import { Decimal } from 'decimal.js';

/** Independent constructor: consumers cannot accidentally change mathematical precision. */
export const Decimal80 = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN });
export const DecimalFloor80 = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_FLOOR });
export const DecimalCeil80 = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_CEIL });
export const NUMERIC_POLICY = Object.freeze({ doubleWidth: 1e-10, decimalWidth: '1e-24', decimalRelativeResidual: '1e-60', doubleResidualFactor: 64 * Number.EPSILON });
export class NumericUncertainError extends Error {
  constructor(message = 'Числовая точность не позволяет надёжно определить маршрут.') { super(message); this.name = 'NumericUncertainError'; }
}

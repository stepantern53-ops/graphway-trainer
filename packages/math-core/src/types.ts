export interface Rational { readonly numerator: bigint; readonly denominator: bigint }
export interface TransportRational { readonly numerator: string; readonly denominator: string }
export type Scalar = number | string | Rational;
export type CoefficientName = 'k' | 'b' | 'a' | 'c';
export type FunctionSpec = { readonly family: 'linear' | 'quadratic' };
export type Coefficients = Readonly<Partial<Record<CoefficientName, Scalar>>>;
export type RationalCoefficients = Readonly<Partial<Record<CoefficientName, Rational>>>;
export type NumericCoefficients = Readonly<Partial<Record<CoefficientName, number>>>;
export interface CoefficientBounds { readonly min: Scalar; readonly max: Scalar; readonly minAbs?: Scalar }
export type ParsedCoefficient =
  | { readonly status: 'valid'; readonly rational: Rational; readonly numeric: number }
  | { readonly status: 'incomplete' | 'invalid'; readonly explanation: string };
export interface Domain { readonly min: number; readonly max: number }
export interface Circle { readonly x: Scalar; readonly y: Scalar; readonly r: Scalar }
export interface Point { readonly x: number; readonly y: number }
export interface ExactCondition { readonly x: Scalar; readonly y: Scalar }
export interface MathLevel {
  readonly functionSpec: FunctionSpec;
  readonly bounds?: Readonly<Partial<Record<CoefficientName, CoefficientBounds>>>;
  readonly fixed?: Coefficients;
  readonly exactConditions?: readonly ExactCondition[];
  readonly geometry: { readonly start: Circle; readonly goal: Circle; readonly pits: readonly Circle[]; readonly domain?: Domain };
}
export interface ContactInterval { readonly start: number; readonly end: number }
export interface RootBracket { readonly lower: number; readonly upper: number; readonly value: number }
export interface Route { readonly startX: number; readonly endX: number; readonly startPoint: Point; readonly endPoint: Point }
export interface RoutePreview { readonly route: Route; readonly firstPitX: number | null; readonly safeEndX: number }
export interface ExactValidation { readonly valid: boolean; readonly explanation: string; readonly failedCondition?: number }
export type RouteStatus = 'input-invalid' | 'condition-mismatch' | 'no-start' | 'no-goal' | 'wrong-order' | 'pit-contact' | 'numeric-uncertain' | 'ready';
interface ValidationBase { readonly explanation: string; readonly preview: RoutePreview | null }
export type RouteValidation =
  | (ValidationBase & { readonly status: 'ready'; readonly route: Route; readonly coefficients: NumericCoefficients; readonly rationals: RationalCoefficients })
  | (ValidationBase & { readonly status: Exclude<RouteStatus, 'ready'>; readonly route?: never });

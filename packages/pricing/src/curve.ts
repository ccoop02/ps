import { ceilDiv, floorDiv, TOKEN_SCALE } from "./units";

/**
 * Quadratic bonding curve with a virtual supply offset:
 *
 *   price(s) = (s + v)^2 / k                       dollars per token
 *   cost(a -> b) = ((b + v)^3 - (a + v)^3) / (3k)   dollars
 *
 * s and v are in whole tokens here; in code they are micro-tokens (S = s * 1e6).
 * Converting: cost in cents = ((B+V)^3 - (A+V)^3) / (3k * 1e16).
 */
export interface CurveParams {
  /** Curve constant, in tokens^2 per dollar. Larger k = flatter, cheaper curve. */
  k: bigint;
  /** Virtual supply offset v, in micro-tokens. Sets the starting price. */
  offsetMicro: bigint;
}

const CUBE_TO_CENTS = 10n ** 16n; // 1e18 (micro^3) / 100 (dollars -> cents)

/** Denominator that converts a difference of cubes (micro-tokens^3) to cents. */
export function centsDenominator(k: bigint): bigint {
  return 3n * k * CUBE_TO_CENTS;
}

/** Exact curve area from 0 to supply, as a numerator over centsDenominator(k). */
export function reserveNumerator(params: CurveParams, supplyMicro: bigint): bigint {
  const top = supplyMicro + params.offsetMicro;
  return top ** 3n - params.offsetMicro ** 3n;
}

function cubeDiff(params: CurveParams, fromMicro: bigint, toMicro: bigint): bigint {
  if (fromMicro < 0n || toMicro < fromMicro) {
    throw new RangeError("invalid supply range");
  }
  const a = fromMicro + params.offsetMicro;
  const b = toMicro + params.offsetMicro;
  return b ** 3n - a ** 3n;
}

/** Cost to move supply from `fromMicro` up to `toMicro`, rounded up (what a buyer pays). */
export function buyCostCents(params: CurveParams, fromMicro: bigint, toMicro: bigint): bigint {
  return ceilDiv(cubeDiff(params, fromMicro, toMicro), centsDenominator(params.k));
}

/** Amount returned for moving supply from `toMicro` down to `fromMicro`, rounded down (what a seller gets). */
export function sellProceedsCents(params: CurveParams, fromMicro: bigint, toMicro: bigint): bigint {
  return floorDiv(cubeDiff(params, fromMicro, toMicro), centsDenominator(params.k));
}

/** Spot price at a supply, in micro-dollars per token (rounded down). */
export function spotPriceMicroUsd(params: CurveParams, supplyMicro: bigint): bigint {
  const top = supplyMicro + params.offsetMicro;
  // dollars = top^2 / (k * 1e12); micro-dollars = top^2 / (k * 1e6)
  return floorDiv(top * top, params.k * TOKEN_SCALE);
}

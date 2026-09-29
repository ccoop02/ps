import { buyCostCents } from "./curve";
import { LISTING_PRICE_RANGE_USD, TREASURY_SEED_BPS } from "./config";
import type { TokenState } from "./trade";
import { dollarsToMicroUsd, isqrt, TOKEN_SCALE } from "./units";

/** Listing price for a starting fundamentals score (0-100), in micro-dollars. */
export function listingPriceForScore(
  score: number,
  range: { min: number; max: number } = LISTING_PRICE_RANGE_USD,
): bigint {
  const clamped = Math.min(100, Math.max(0, score));
  return dollarsToMicroUsd(range.min + ((range.max - range.min) * clamped) / 100);
}

export interface Listing {
  state: TokenState;
  /** Tokens the treasury holds after its seed buy. */
  treasurySeedMicro: bigint;
  /** Play money issued to pay for the seed (goes into the reserve). */
  seedCostCents: bigint;
}

/**
 * Lists a person at a target price. The treasury buys a seed position so it
 * can sell later when a score falls; v is chosen so the price *after* that
 * seed buy equals the target.
 */
export function listToken(
  targetPriceMicroUsd: bigint,
  k: bigint,
  seedBps: number = TREASURY_SEED_BPS,
): Listing {
  if (targetPriceMicroUsd <= 0n) throw new RangeError("listing price must be positive");
  // price = (V + seed)^2 / (k * 1e6), with seed = V * seedBps / 1e4
  const top = isqrt(targetPriceMicroUsd * k * TOKEN_SCALE);
  const offsetMicro = (top * 10_000n) / (10_000n + BigInt(seedBps));
  const treasurySeedMicro = (offsetMicro * BigInt(seedBps)) / 10_000n;
  const params = { k, offsetMicro };
  const seedCostCents = buyCostCents(params, 0n, treasurySeedMicro);
  return {
    state: { ...params, supplyMicro: treasurySeedMicro, reserveCents: seedCostCents },
    treasurySeedMicro,
    seedCostCents,
  };
}


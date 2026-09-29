/**
 * Trading fee: a percentage that depends on trade size, paid to the platform.
 * The admin can switch fees off during the beta and edit the tiers.
 */
export interface FeeTier {
  /** Trades of at least this many cents use this tier. The first tier must start at 0. */
  minCents: number;
  /** Fee rate in basis points (100 bps = 1%). */
  bps: number;
}

export interface FeeSchedule {
  enabled: boolean;
  tiers: FeeTier[];
}

export interface FeeResult {
  bps: number;
  feeCents: bigint;
}

export function validateFeeSchedule(schedule: FeeSchedule): void {
  const { tiers } = schedule;
  if (tiers.length === 0) throw new Error("fee schedule needs at least one tier");
  if (tiers[0]!.minCents !== 0) throw new Error("first fee tier must start at $0");
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    if (!Number.isInteger(t.minCents) || t.minCents < 0) {
      throw new Error("tier minimums must be whole, non-negative cents");
    }
    if (!Number.isInteger(t.bps) || t.bps < 0 || t.bps > 2000) {
      throw new Error("tier rates must be between 0% and 20%");
    }
    if (i > 0 && t.minCents <= tiers[i - 1]!.minCents) {
      throw new Error("fee tiers must be in increasing order");
    }
  }
}

/** The rate for a trade of this size. */
export function feeBpsFor(amountCents: bigint, schedule: FeeSchedule): number {
  if (!schedule.enabled) return 0;
  let bps = 0;
  for (const tier of schedule.tiers) {
    if (amountCents >= BigInt(tier.minCents)) bps = tier.bps;
  }
  return bps;
}

/** Fee on a trade amount, rounded to the nearest cent (half up). */
export function feeFor(amountCents: bigint, schedule: FeeSchedule): FeeResult {
  const bps = feeBpsFor(amountCents, schedule);
  const feeCents = (amountCents * BigInt(bps) + 5_000n) / 10_000n;
  return { bps, feeCents };
}

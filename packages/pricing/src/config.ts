import type { FeeSchedule } from "./fees";

/** Bump when pricing math changes; stored on every trade so history can be replayed. */
export const ENGINE_VERSION = "curve-v1";

/**
 * Curve constant for the beta. With $100 of play cash each, this puts listing
 * prices around $1-$5 and makes a $10 buy move a $2 stock by roughly 5%.
 */
export const DEFAULT_K = 20_000n;

/** Listing price range: a fundamentals score of 0 lists at the min, 100 at the max. */
export const LISTING_PRICE_RANGE_USD = { min: 1, max: 5 } as const;

/**
 * Share of the offset the treasury buys at listing (in bps of v), so it has
 * tokens to sell when a score falls. The listing price already includes this buy.
 */
export const TREASURY_SEED_BPS = 1_000;

/** Beta fee tiers: under $5 pays 3%, $5-$25 pays 2%, over $25 pays 1%. */
export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  enabled: true,
  tiers: [
    { minCents: 0, bps: 300 },
    { minCents: 500, bps: 200 },
    { minCents: 2_501, bps: 100 },
  ],
};

export const TREASURY_CAPS = {
  /** Max total treasury-driven move per stock per day, all sources combined. */
  dailyBps: 1_000,
  /** Max move from any single event. */
  perEventBps: 500,
  /** Target move per fundamentals-score point changed (0.2%). */
  perScorePointBps: 20,
  /** Target move for a unanimous event outcome vote (5%). */
  eventFullSentimentBps: 500,
  /** Outcome votes needed before an event moves the price. */
  eventMinVotes: 3,
} as const;

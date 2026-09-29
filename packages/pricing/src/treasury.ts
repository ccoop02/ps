import { buyCostCents, sellProceedsCents, spotPriceMicroUsd } from "./curve";
import { TREASURY_CAPS } from "./config";
import type { TokenState } from "./trade";
import { isqrt, TOKEN_SCALE } from "./units";

/**
 * The treasury moves prices with real trades on the curve (never by editing
 * it), so the reserve stays fully backed. Moves are in basis points of price.
 */

/** Target move for a change in fundamentals score (e.g. +5 points -> +1%). */
export function scoreMoveBps(scoreDelta: number, caps = TREASURY_CAPS): number {
  return Math.round(scoreDelta * caps.perScorePointBps);
}

/**
 * Target move for a resolved event: net sentiment x 5%, where
 * sentiment = (good - bad) / (good + bad). Needs a minimum number of votes.
 */
export function eventMoveBps(goodVotes: number, badVotes: number, caps = TREASURY_CAPS): number {
  const total = goodVotes + badVotes;
  if (total < caps.eventMinVotes) return 0;
  return Math.round(((goodVotes - badVotes) / total) * caps.eventFullSentimentBps);
}

/**
 * Clamp a desired move to the caps: at most 5% from one event, and at most
 * 10% per stock per day across all sources. `usedTodayBps` is the total
 * absolute move the treasury has already made on this stock today.
 */
export function capMoveBps(
  desiredBps: number,
  usedTodayBps: number,
  source: "score" | "event",
  caps = TREASURY_CAPS,
): number {
  let bps = desiredBps;
  if (source === "event") {
    bps = Math.max(-caps.perEventBps, Math.min(caps.perEventBps, bps));
  }
  const remaining = Math.max(0, caps.dailyBps - Math.abs(usedTodayBps));
  return Math.max(-remaining, Math.min(remaining, bps));
}

export interface TreasuryTrade {
  side: "buy" | "sell";
  tokensMicro: bigint;
  /** Buy: play money issued into the reserve. Sell: cash taken out of the reserve. */
  cents: bigint;
  priceBeforeMicroUsd: bigint;
  priceAfterMicroUsd: bigint;
  /** Actual move achieved, in bps (may be smaller than asked if holdings ran out). */
  achievedBps: number;
  after: TokenState;
}

/**
 * The trade that moves the price by `moveBps` (positive = up). A sell is
 * limited to the tokens the treasury holds. Returns null when no trade is needed.
 */
export function planTreasuryTrade(
  state: TokenState,
  moveBps: number,
  treasuryHoldingMicro: bigint,
): TreasuryTrade | null {
  if (!Number.isInteger(moveBps) || moveBps === 0) return null;
  const before = spotPriceMicroUsd(state, state.supplyMicro);
  const targetPrice = (before * BigInt(10_000 + moveBps)) / 10_000n;
  const targetTop = isqrt(targetPrice * state.k * TOKEN_SCALE);
  let targetSupply = targetTop - state.offsetMicro;
  if (targetSupply < 0n) targetSupply = 0n;

  let after: TokenState;
  let side: "buy" | "sell";
  let tokensMicro: bigint;
  let cents: bigint;

  if (moveBps > 0) {
    tokensMicro = targetSupply - state.supplyMicro;
    if (tokensMicro <= 0n) return null;
    side = "buy";
    cents = buyCostCents(state, state.supplyMicro, targetSupply);
    after = { ...state, supplyMicro: targetSupply, reserveCents: state.reserveCents + cents };
  } else {
    const wanted = state.supplyMicro - targetSupply;
    tokensMicro = wanted < treasuryHoldingMicro ? wanted : treasuryHoldingMicro;
    if (tokensMicro <= 0n) return null;
    side = "sell";
    const to = state.supplyMicro - tokensMicro;
    cents = sellProceedsCents(state, to, state.supplyMicro);
    after = { ...state, supplyMicro: to, reserveCents: state.reserveCents - cents };
  }

  const priceAfter = spotPriceMicroUsd(after, after.supplyMicro);
  const achievedBps = before === 0n ? 0 : Number(((priceAfter - before) * 10_000n) / before);
  return {
    side,
    tokensMicro,
    cents,
    priceBeforeMicroUsd: before,
    priceAfterMicroUsd: priceAfter,
    achievedBps,
    after,
  };
}

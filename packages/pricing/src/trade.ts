import { buyCostCents, sellProceedsCents, spotPriceMicroUsd, centsDenominator, type CurveParams } from "./curve";
import { feeFor, type FeeSchedule } from "./fees";
import { icbrt, TOKEN_SCALE } from "./units";

/** Everything the curve needs to know about one person-token. */
export interface TokenState extends CurveParams {
  supplyMicro: bigint;
  /** Cash held against outstanding tokens, in cents. Always covers the curve area. */
  reserveCents: bigint;
}

export class TradeError extends Error {
  constructor(
    message: string,
    readonly code: "amount_too_small" | "insufficient_supply" | "invalid_amount",
  ) {
    super(message);
  }
}

export interface BuyQuote {
  tokensMicro: bigint;
  /** Paid into the reserve. */
  costCents: bigint;
  /** Paid to the platform. */
  feeCents: bigint;
  feeBps: number;
  /** costCents + feeCents; never more than the amount entered. */
  totalCents: bigint;
  avgPriceMicroUsd: bigint;
  priceBeforeMicroUsd: bigint;
  priceAfterMicroUsd: bigint;
  after: TokenState;
}

export interface SellQuote {
  tokensMicro: bigint;
  /** Taken out of the reserve. */
  proceedsCents: bigint;
  feeCents: bigint;
  feeBps: number;
  /** What the seller receives: proceedsCents - feeCents. */
  netCents: bigint;
  avgPriceMicroUsd: bigint;
  priceBeforeMicroUsd: bigint;
  priceAfterMicroUsd: bigint;
  after: TokenState;
}

function avgPrice(cents: bigint, tokensMicro: bigint): bigint {
  // micro-dollars per token = cents * 1e4 / (tokensMicro / 1e6)
  return (cents * 10_000n * TOKEN_SCALE) / tokensMicro;
}

/**
 * Most tokens a curve payment can buy: the largest supply increase whose
 * rounded-up cost is at most `budgetCents`.
 */
export function tokensForBudget(state: TokenState, budgetCents: bigint): bigint {
  if (budgetCents <= 0n) return 0n;
  const top = state.supplyMicro + state.offsetMicro;
  const reach = icbrt(top ** 3n + budgetCents * centsDenominator(state.k));
  return reach - top;
}

/**
 * Buy with a dollar amount. The fee comes out of the amount entered (matches
 * the design: "$100" = $5 fee + tokens), and the charge never exceeds it.
 */
export function quoteBuy(state: TokenState, amountCents: bigint, fees: FeeSchedule): BuyQuote {
  if (amountCents <= 0n) throw new TradeError("Enter an amount above $0", "invalid_amount");
  const { feeCents, bps } = feeFor(amountCents, fees);
  const tokensMicro = tokensForBudget(state, amountCents - feeCents);
  if (tokensMicro <= 0n) throw new TradeError("Amount is too small to buy any tokens", "amount_too_small");

  const toMicro = state.supplyMicro + tokensMicro;
  const costCents = buyCostCents(state, state.supplyMicro, toMicro);
  const after: TokenState = {
    ...state,
    supplyMicro: toMicro,
    reserveCents: state.reserveCents + costCents,
  };
  return {
    tokensMicro,
    costCents,
    feeCents,
    feeBps: bps,
    totalCents: costCents + feeCents,
    avgPriceMicroUsd: avgPrice(costCents, tokensMicro),
    priceBeforeMicroUsd: spotPriceMicroUsd(state, state.supplyMicro),
    priceAfterMicroUsd: spotPriceMicroUsd(state, toMicro),
    after,
  };
}

/** Sell a number of tokens back to the curve. The fee comes out of the proceeds. */
export function quoteSell(state: TokenState, tokensMicro: bigint, fees: FeeSchedule): SellQuote {
  if (tokensMicro <= 0n) throw new TradeError("Enter a number of tokens above 0", "invalid_amount");
  if (tokensMicro > state.supplyMicro) {
    throw new TradeError("Can't sell more tokens than exist", "insufficient_supply");
  }
  const toMicro = state.supplyMicro - tokensMicro;
  const proceedsCents = sellProceedsCents(state, toMicro, state.supplyMicro);
  if (proceedsCents <= 0n) throw new TradeError("Amount is too small to sell", "amount_too_small");
  const { feeCents, bps } = feeFor(proceedsCents, fees);
  const after: TokenState = {
    ...state,
    supplyMicro: toMicro,
    reserveCents: state.reserveCents - proceedsCents,
  };
  return {
    tokensMicro,
    proceedsCents,
    feeCents,
    feeBps: bps,
    netCents: proceedsCents - feeCents,
    avgPriceMicroUsd: avgPrice(proceedsCents, tokensMicro),
    priceBeforeMicroUsd: spotPriceMicroUsd(state, state.supplyMicro),
    priceAfterMicroUsd: spotPriceMicroUsd(state, toMicro),
    after,
  };
}

/**
 * True when the reserve covers every outstanding token, i.e. everyone could
 * sell back to zero supply and be paid in full.
 */
export function reserveCoversSupply(state: TokenState): boolean {
  const top = state.supplyMicro + state.offsetMicro;
  const owed = top ** 3n - state.offsetMicro ** 3n;
  return state.reserveCents * centsDenominator(state.k) >= owed;
}

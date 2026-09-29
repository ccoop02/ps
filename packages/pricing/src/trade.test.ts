import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_FEE_SCHEDULE, DEFAULT_K } from "./config";
import { buyCostCents, sellProceedsCents, spotPriceMicroUsd } from "./curve";
import { listToken } from "./listing";
import { quoteBuy, quoteSell, reserveCoversSupply, TradeError, type TokenState } from "./trade";
import { dollarsToMicroUsd, TOKEN_SCALE } from "./units";

const noFees = { ...DEFAULT_FEE_SCHEDULE, enabled: false };

function freshToken(priceDollars = 2): TokenState {
  return listToken(dollarsToMicroUsd(priceDollars), DEFAULT_K).state;
}

describe("curve basics", () => {
  it("matches the closed-form formula", () => {
    // v = 100 tokens, k = 20,000: price = 100^2 / 20,000 = $0.50
    const params = { k: 20_000n, offsetMicro: 100n * TOKEN_SCALE };
    expect(spotPriceMicroUsd(params, 0n)).toBe(500_000n);
    // cost 0 -> 100 tokens = (200^3 - 100^3) / 60,000 = $116.666... -> 11,667c up, 11,666c down
    expect(buyCostCents(params, 0n, 100n * TOKEN_SCALE)).toBe(11_667n);
    expect(sellProceedsCents(params, 0n, 100n * TOKEN_SCALE)).toBe(11_666n);
  });

  it("price rises as supply rises", () => {
    const t = freshToken();
    expect(spotPriceMicroUsd(t, t.supplyMicro + TOKEN_SCALE)).toBeGreaterThan(
      spotPriceMicroUsd(t, t.supplyMicro),
    );
  });
});

describe("quoteBuy", () => {
  it("never charges more than the amount entered, and the fee comes out of it", () => {
    const q = quoteBuy(freshToken(), 1_000n, DEFAULT_FEE_SCHEDULE);
    expect(q.feeCents).toBe(20n);
    expect(q.totalCents).toBeLessThanOrEqual(1_000n);
    expect(q.costCents).toBeLessThanOrEqual(980n);
    expect(q.priceAfterMicroUsd).toBeGreaterThan(q.priceBeforeMicroUsd);
    expect(q.avgPriceMicroUsd).toBeGreaterThanOrEqual(q.priceBeforeMicroUsd);
    expect(q.avgPriceMicroUsd).toBeLessThanOrEqual(q.priceAfterMicroUsd);
  });

  it("a $10 buy moves a $2 stock by a few percent", () => {
    const q = quoteBuy(freshToken(2), 1_000n, DEFAULT_FEE_SCHEDULE);
    const movePct = Number((q.priceAfterMicroUsd - q.priceBeforeMicroUsd) * 10_000n / q.priceBeforeMicroUsd) / 100;
    expect(movePct).toBeGreaterThan(2);
    expect(movePct).toBeLessThan(10);
  });

  it("rejects zero and too-small amounts", () => {
    expect(() => quoteBuy(freshToken(), 0n, noFees)).toThrow(TradeError);
    // 1 cent with a 3% fee still buys a sliver at $2, but 1 cent can't buy 1 micro-token at huge prices
    const pricey = listToken(dollarsToMicroUsd(50_000), DEFAULT_K).state;
    expect(() => quoteBuy(pricey, 1n, noFees)).toThrow(/too small/);
  });
});

describe("quoteSell", () => {
  it("pays the seller proceeds minus the fee", () => {
    const t = freshToken();
    const buy = quoteBuy(t, 2_000n, noFees);
    const sell = quoteSell(buy.after, buy.tokensMicro, DEFAULT_FEE_SCHEDULE);
    expect(sell.netCents).toBe(sell.proceedsCents - sell.feeCents);
    expect(sell.after.supplyMicro).toBe(t.supplyMicro);
  });

  it("can't sell more than the supply", () => {
    const t = freshToken();
    expect(() => quoteSell(t, t.supplyMicro + 1n, noFees)).toThrow(/more tokens than exist/);
  });

  it("buying then selling never makes money (no free lunch from rounding)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50_000 }), fc.double({ min: 0.5, max: 20, noNaN: true }), (cents, price) => {
        const t = freshToken(price);
        let buy;
        try {
          buy = quoteBuy(t, BigInt(cents), noFees);
        } catch {
          return true;
        }
        let sell;
        try {
          sell = quoteSell(buy.after, buy.tokensMicro, noFees);
        } catch {
          return true;
        }
        return sell.netCents <= buy.totalCents;
      }),
    );
  });
});

describe("reserve invariant", () => {
  const action = fc.oneof(
    fc.record({ kind: fc.constant("buy" as const), cents: fc.integer({ min: 1, max: 20_000 }) }),
    fc.record({ kind: fc.constant("sell" as const), share: fc.double({ min: 0, max: 1, noNaN: true }) }),
  );

  it("the reserve covers every outstanding token after any sequence of trades", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 10, noNaN: true }),
        fc.boolean(),
        fc.array(action, { minLength: 1, maxLength: 200 }),
        (price, feesOn, actions) => {
          let state = freshToken(price);
          const fees = feesOn ? DEFAULT_FEE_SCHEDULE : noFees;
          // Track outstanding tokens per "trader" loosely: one pool of user-held tokens.
          let userHeld = 0n;
          for (const a of actions) {
            try {
              if (a.kind === "buy") {
                const q = quoteBuy(state, BigInt(a.cents), fees);
                state = q.after;
                userHeld += q.tokensMicro;
              } else {
                const amount = BigInt(Math.floor(Number(userHeld) * a.share));
                if (amount <= 0n) continue;
                const q = quoteSell(state, amount, fees);
                state = q.after;
                userHeld -= amount;
              }
            } catch (e) {
              if (!(e instanceof TradeError)) throw e;
            }
            if (!reserveCoversSupply(state) || state.reserveCents < 0n) return false;
          }
          return true;
        },
      ),
      { numRuns: 300 },
    );
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_K } from "./config";
import { spotPriceMicroUsd } from "./curve";
import { listingPriceForScore, listToken } from "./listing";
import { reserveCoversSupply } from "./trade";
import { dollarsToMicroUsd } from "./units";

describe("listing", () => {
  it("maps score 0-100 onto $1-$5", () => {
    expect(listingPriceForScore(0)).toBe(1_000_000n);
    expect(listingPriceForScore(50)).toBe(3_000_000n);
    expect(listingPriceForScore(100)).toBe(5_000_000n);
    expect(listingPriceForScore(150)).toBe(5_000_000n);
  });

  it("lists at the target price after the treasury seed buy", () => {
    for (const dollars of [1, 2.5, 5]) {
      const target = dollarsToMicroUsd(dollars);
      const { state, treasurySeedMicro, seedCostCents } = listToken(target, DEFAULT_K);
      const price = spotPriceMicroUsd(state, state.supplyMicro);
      // within 0.1% of the target
      expect(Number(price)).toBeGreaterThan(Number(target) * 0.999);
      expect(Number(price)).toBeLessThanOrEqual(Number(target) * 1.001);
      expect(state.supplyMicro).toBe(treasurySeedMicro);
      expect(state.reserveCents).toBe(seedCostCents);
      expect(reserveCoversSupply(state)).toBe(true);
    }
  });
});

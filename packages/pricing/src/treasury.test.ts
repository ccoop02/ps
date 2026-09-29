import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_K } from "./config";
import { listToken } from "./listing";
import { capMoveBps, eventMoveBps, planTreasuryTrade, scoreMoveBps } from "./treasury";
import { reserveCoversSupply } from "./trade";
import { dollarsToMicroUsd } from "./units";

describe("target moves", () => {
  it("score changes move 0.2% per point", () => {
    expect(scoreMoveBps(5)).toBe(100);
    expect(scoreMoveBps(-3)).toBe(-60);
  });

  it("events move by sentiment x 5%, with at least 3 votes", () => {
    expect(eventMoveBps(2, 0)).toBe(0);
    expect(eventMoveBps(3, 0)).toBe(500);
    expect(eventMoveBps(3, 1)).toBe(250);
    expect(eventMoveBps(1, 3)).toBe(-250);
    expect(eventMoveBps(2, 2)).toBe(0);
  });
});

describe("caps", () => {
  it("limits a single event to 5%", () => {
    expect(capMoveBps(900, 0, "event")).toBe(500);
    expect(capMoveBps(-900, 0, "event")).toBe(-500);
  });

  it("limits the daily total to 10%", () => {
    expect(capMoveBps(400, 800, "score")).toBe(200);
    expect(capMoveBps(-400, 950, "score")).toBe(-50);
    expect(capMoveBps(300, 1_000, "score")).toBe(0);
  });
});

describe("planTreasuryTrade", () => {
  const listing = listToken(dollarsToMicroUsd(2), DEFAULT_K);

  it("buys to push the price up by the target", () => {
    const t = planTreasuryTrade(listing.state, 200, 0n)!;
    expect(t.side).toBe("buy");
    expect(t.achievedBps).toBeGreaterThanOrEqual(198);
    expect(t.achievedBps).toBeLessThanOrEqual(200);
    expect(reserveCoversSupply(t.after)).toBe(true);
  });

  it("sells its holdings to push the price down", () => {
    const t = planTreasuryTrade(listing.state, -200, listing.treasurySeedMicro)!;
    expect(t.side).toBe("sell");
    expect(t.achievedBps).toBeLessThanOrEqual(-198);
    expect(reserveCoversSupply(t.after)).toBe(true);
  });

  it("can't sell more than it holds", () => {
    const small = listing.treasurySeedMicro / 10n;
    const t = planTreasuryTrade(listing.state, -1_000, small)!;
    expect(t.tokensMicro).toBe(small);
    expect(t.achievedBps).toBeGreaterThan(-1_000);
  });

  it("does nothing for a zero move or with no holdings to sell", () => {
    expect(planTreasuryTrade(listing.state, 0, 10n)).toBeNull();
    expect(planTreasuryTrade(listing.state, -100, 0n)).toBeNull();
  });

  it("keeps the reserve backed for any move", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000, max: 1_000 }), (bps) => {
        const t = planTreasuryTrade(listing.state, bps, listing.treasurySeedMicro);
        return t === null || (reserveCoversSupply(t.after) && t.after.reserveCents >= 0n);
      }),
    );
  });
});

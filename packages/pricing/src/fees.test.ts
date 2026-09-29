import { describe, expect, it } from "vitest";
import { DEFAULT_FEE_SCHEDULE } from "./config";
import { feeBpsFor, feeFor, validateFeeSchedule } from "./fees";

describe("fee tiers", () => {
  it("charges 3% under $5, 2% from $5 to $25, 1% over $25", () => {
    expect(feeBpsFor(499n, DEFAULT_FEE_SCHEDULE)).toBe(300);
    expect(feeBpsFor(500n, DEFAULT_FEE_SCHEDULE)).toBe(200);
    expect(feeBpsFor(2_500n, DEFAULT_FEE_SCHEDULE)).toBe(200);
    expect(feeBpsFor(2_501n, DEFAULT_FEE_SCHEDULE)).toBe(100);
    expect(feeBpsFor(10_000n, DEFAULT_FEE_SCHEDULE)).toBe(100);
  });

  it("rounds the fee to the nearest cent", () => {
    expect(feeFor(100n, DEFAULT_FEE_SCHEDULE).feeCents).toBe(3n); // $1 at 3%
    expect(feeFor(250n, DEFAULT_FEE_SCHEDULE).feeCents).toBe(8n); // 7.5c rounds up
    expect(feeFor(1_000n, DEFAULT_FEE_SCHEDULE).feeCents).toBe(20n); // $10 at 2%
    expect(feeFor(10_000n, DEFAULT_FEE_SCHEDULE).feeCents).toBe(100n); // $100 at 1%
  });

  it("charges nothing when fees are switched off", () => {
    const off = { ...DEFAULT_FEE_SCHEDULE, enabled: false };
    expect(feeFor(10_000n, off)).toEqual({ bps: 0, feeCents: 0n });
  });

  it("validates schedules", () => {
    expect(() => validateFeeSchedule(DEFAULT_FEE_SCHEDULE)).not.toThrow();
    expect(() => validateFeeSchedule({ enabled: true, tiers: [] })).toThrow();
    expect(() => validateFeeSchedule({ enabled: true, tiers: [{ minCents: 100, bps: 300 }] })).toThrow();
    expect(() =>
      validateFeeSchedule({
        enabled: true,
        tiers: [
          { minCents: 0, bps: 300 },
          { minCents: 0, bps: 200 },
        ],
      }),
    ).toThrow();
    expect(() => validateFeeSchedule({ enabled: true, tiers: [{ minCents: 0, bps: 5000 }] })).toThrow();
  });
});

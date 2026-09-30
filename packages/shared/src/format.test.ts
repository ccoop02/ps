import { describe, expect, it } from "vitest";
import { formatCents, formatMicroUsd, formatPercentChange, formatSignedCents } from "./format";

describe("formatCents", () => {
  it("formats whole cents as dollars", () => {
    expect(formatCents(842015)).toBe("$8,420.15");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
  });

  it("rejects fractional cents", () => {
    expect(() => formatCents(1.5)).toThrow();
  });
});

describe("formatSignedCents", () => {
  it("adds a sign", () => {
    expect(formatSignedCents(31196)).toBe("+$311.96");
    expect(formatSignedCents(-9000)).toBe("-$90.00");
    expect(formatSignedCents(0)).toBe("$0.00");
  });
});

describe("formatPercentChange", () => {
  it("rounds to one decimal place", () => {
    expect(formatPercentChange(0.079)).toBe("+7.9%");
    expect(formatPercentChange(-0.092)).toBe("-9.2%");
    expect(formatPercentChange(0)).toBe("0.0%");
  });
});

describe("formatMicroUsd", () => {
  it("shows dollars and cents", () => {
    expect(formatMicroUsd(2_161_000n)).toBe("$2.16");
    expect(formatMicroUsd(42_180_000)).toBe("$42.18");
  });
});

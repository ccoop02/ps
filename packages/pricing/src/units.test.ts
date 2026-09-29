import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ceilDiv, floorDiv, icbrt, isqrt } from "./units";

describe("integer roots", () => {
  it("isqrt is the floor square root", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 40n }), (n) => {
        const r = isqrt(n);
        return r * r <= n && (r + 1n) * (r + 1n) > n;
      }),
    );
  });

  it("icbrt is the floor cube root", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 60n }), (n) => {
        const r = icbrt(n);
        return r * r * r <= n && (r + 1n) ** 3n > n;
      }),
    );
  });

  it("handles exact powers", () => {
    expect(isqrt(10n ** 24n)).toBe(10n ** 12n);
    expect(icbrt(10n ** 36n)).toBe(10n ** 12n);
    expect(icbrt(26n)).toBe(2n);
    expect(icbrt(27n)).toBe(3n);
  });
});

describe("division helpers", () => {
  it("rounds in the right direction", () => {
    expect(floorDiv(7n, 2n)).toBe(3n);
    expect(ceilDiv(7n, 2n)).toBe(4n);
    expect(ceilDiv(8n, 2n)).toBe(4n);
    expect(ceilDiv(0n, 5n)).toBe(0n);
  });
});

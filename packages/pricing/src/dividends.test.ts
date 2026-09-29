import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { allocateDividend } from "./dividends";

describe("allocateDividend", () => {
  it("splits in proportion to holdings", () => {
    const out = allocateDividend(1_000n, [
      { id: "a", balanceMicro: 3_000n },
      { id: "b", balanceMicro: 1_000n },
    ]);
    expect(out).toEqual([
      { id: "a", tokensMicro: 750n },
      { id: "b", tokensMicro: 250n },
    ]);
  });

  it("returns nothing when no one holds the stock", () => {
    expect(allocateDividend(1_000n, [])).toEqual([]);
    expect(allocateDividend(1_000n, [{ id: "a", balanceMicro: 0n }])).toEqual([]);
  });

  it("always adds up to exactly the total", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 12n }),
        fc.array(fc.bigInt({ min: 0n, max: 10n ** 12n }), { minLength: 1, maxLength: 20 }),
        (total, balances) => {
          const holders = balances.map((b, i) => ({ id: `u${i}`, balanceMicro: b }));
          const out = allocateDividend(total, holders);
          const sum = out.reduce((s, a) => s + a.tokensMicro, 0n);
          return holders.every((h) => h.balanceMicro === 0n) ? out.length === 0 : sum === total;
        },
      ),
    );
  });
});

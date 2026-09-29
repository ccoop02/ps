/**
 * Fixed-point units. All pricing math is exact integer (BigInt) math:
 *   - cash:    whole cents
 *   - tokens:  micro-tokens (1 token = 1,000,000 micro-tokens)
 *   - prices:  micro-dollars per whole token (for display and targets)
 */

export const TOKEN_SCALE = 1_000_000n;
export const MICRO_USD_PER_CENT = 10_000n;

export function tokensToMicro(tokens: number): bigint {
  return BigInt(Math.round(tokens * 1_000_000));
}

export function microToTokens(micro: bigint): number {
  return Number(micro) / 1_000_000;
}

export function microUsdToDollars(microUsd: bigint): number {
  return Number(microUsd) / 1_000_000;
}

export function dollarsToMicroUsd(dollars: number): bigint {
  return BigInt(Math.round(dollars * 1_000_000));
}

/** Floor division for non-negative bigints. */
export function floorDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new RangeError("divisor must be positive");
  if (a < 0n) throw new RangeError("dividend must be non-negative");
  return a / b;
}

/** Ceiling division for non-negative bigints. */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new RangeError("divisor must be positive");
  if (a < 0n) throw new RangeError("dividend must be non-negative");
  return (a + b - 1n) / b;
}

/** Largest r with r*r <= n. */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("isqrt of negative number");
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Newton steps from a float estimate; then correct by at most a few units.
  for (let i = 0; i < 100; i++) {
    const next = (x + n / x) >> 1n;
    if (next === x || next === x + 1n) break;
    x = next;
  }
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

/** Largest r with r*r*r <= n. */
export function icbrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("icbrt of negative number");
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.cbrt(Number(n)))) + 1n;
  for (let i = 0; i < 200; i++) {
    const next = (2n * x + n / (x * x)) / 3n;
    if (next >= x) break;
    x = next;
  }
  while (x * x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

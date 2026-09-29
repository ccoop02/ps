/** All money is stored as whole cents; these helpers only format it for display. */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`formatCents expects whole cents, got ${cents}`);
  }
  return usd.format(cents / 100);
}

export function formatSignedCents(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "-" : "";
  return sign + formatCents(Math.abs(cents));
}

/** Percent change from a ratio, e.g. 0.079 -> "+7.9%". */
export function formatPercentChange(ratio: number): string {
  const pct = Math.round(ratio * 1000) / 10;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** Price in micro-dollars (as used by the pricing engine) to "$2.16". */
export function formatMicroUsd(microUsd: bigint | number): string {
  return usd.format(Number(microUsd) / 1_000_000);
}

/** Change between two prices as a ratio, e.g. 0.079 for +7.9%. */
export function changeRatio(before: bigint | number, after: bigint | number): number {
  const b = Number(before);
  return b === 0 ? 0 : (Number(after) - b) / b;
}

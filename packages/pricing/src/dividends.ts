export interface Holder {
  id: string;
  balanceMicro: bigint;
}

export interface Allocation {
  id: string;
  tokensMicro: bigint;
}

/**
 * Split `totalMicro` tokens among holders in proportion to their balances.
 * Uses largest remainders so the pieces add up to exactly the total.
 * Returns an empty list when nobody holds the stock (the treasury keeps it).
 */
export function allocateDividend(totalMicro: bigint, holders: Holder[]): Allocation[] {
  const eligible = holders.filter((h) => h.balanceMicro > 0n);
  if (totalMicro <= 0n || eligible.length === 0) return [];
  const supply = eligible.reduce((sum, h) => sum + h.balanceMicro, 0n);

  const parts = eligible.map((h) => {
    const exact = totalMicro * h.balanceMicro;
    return { id: h.id, tokensMicro: exact / supply, remainder: exact % supply };
  });
  let leftover = totalMicro - parts.reduce((sum, p) => sum + p.tokensMicro, 0n);
  const byRemainder = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1,
  );
  for (const p of byRemainder) {
    if (leftover === 0n) break;
    p.tokensMicro += 1n;
    leftover -= 1n;
  }
  return parts
    .filter((p) => p.tokensMicro > 0n)
    .map(({ id, tokensMicro }) => ({ id, tokensMicro }));
}

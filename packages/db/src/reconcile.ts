import { sql } from "drizzle-orm";
import type { Db } from "./index";

export interface ReconcileProblem {
  check: string;
  detail: string;
}

/**
 * Checks that every balance agrees with the immutable history:
 *  1. each person's cash = the sum of their ledger entries
 *  2. each stock's supply = tokens bought - tokens sold
 *  3. each stock's reserve = cash paid into the curve - cash paid out
 *  4. each stock's supply = everyone's holdings + the treasury's
 *  5. no cash, holding or reserve is negative
 * Returns an empty list when everything adds up.
 */
export async function reconcile(db: Db): Promise<ReconcileProblem[]> {
  const problems: ReconcileProblem[] = [];

  const cash = await db.execute<{ id: string; name: string; cash: string; ledger: string }>(sql`
    select p.id, p.display_name as name, p.cash_cents::text as cash,
           coalesce(sum(l.delta_cents), 0)::text as ledger
    from profiles p
    left join ledger_entries l on l.profile_id = p.id and l.account = 'user'
    group by p.id
    having p.cash_cents <> coalesce(sum(l.delta_cents), 0)
  `);
  for (const r of cash) {
    problems.push({ check: "cash", detail: `${r.name}: balance ${r.cash}c but ledger says ${r.ledger}c` });
  }

  const stocks = await db.execute<{
    ticker: string;
    supply: string;
    traded_supply: string;
    reserve: string;
    traded_reserve: string;
    held: string;
  }>(sql`
    select s.ticker,
           t.supply_micro::text as supply,
           coalesce((select sum(case when side = 'buy' then tokens_micro else -tokens_micro end)
                     from trades where subject_id = s.id), 0)::text as traded_supply,
           t.reserve_cents::text as reserve,
           coalesce((select sum(case when side = 'buy' then curve_cents else -curve_cents end)
                     from trades where subject_id = s.id), 0)::text as traded_reserve,
           (coalesce((select sum(balance_micro) from holdings where subject_id = s.id), 0)
            + coalesce((select balance_micro from treasury_holdings where subject_id = s.id), 0))::text as held
    from subjects s
    join tokens t on t.subject_id = s.id
  `);
  for (const r of stocks) {
    if (r.supply !== r.traded_supply) {
      problems.push({ check: "supply", detail: `$${r.ticker}: supply ${r.supply} but trades add up to ${r.traded_supply}` });
    }
    if (r.reserve !== r.traded_reserve) {
      problems.push({ check: "reserve", detail: `$${r.ticker}: reserve ${r.reserve}c but trades add up to ${r.traded_reserve}c` });
    }
    if (r.supply !== r.held) {
      problems.push({ check: "holdings", detail: `$${r.ticker}: supply ${r.supply} but holders own ${r.held}` });
    }
  }

  const negatives = await db.execute<{ what: string }>(sql`
    select 'cash of ' || display_name as what from profiles where cash_cents < 0
    union all select 'holding in ' || subject_id from holdings where balance_micro < 0
    union all select 'reserve of ' || subject_id from tokens where reserve_cents < 0
  `);
  for (const r of negatives) problems.push({ check: "negative", detail: r.what });

  return problems;
}

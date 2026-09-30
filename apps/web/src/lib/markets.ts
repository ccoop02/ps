import "server-only";
import { sql, type Db } from "@peerstock/db";
import { spotPriceMicroUsd } from "@peerstock/pricing";

export interface MarketRow {
  subjectId: string;
  name: string;
  ticker: string;
  tagline: string | null;
  priceMicroUsd: bigint;
  /** Price at the start of the window, or null if the stock is newer than that. */
  priceThenMicroUsd: bigint | null;
  holders: number;
  /** Recent prices for the sparkline, oldest first. */
  spark: number[];
}

/** Every listed stock with its price now and 24 hours ago. */
export async function listMarkets(db: Db): Promise<MarketRow[]> {
  const rows = await db.execute<{
    subject_id: string;
    name: string;
    ticker: string;
    tagline: string | null;
    supply_micro: string;
    offset_micro: string;
    curve_k: string;
    price_then: string | null;
    holders: number;
    spark: string[] | null;
  }>(sql`
    select s.id as subject_id, p.display_name as name, s.ticker, s.tagline,
           t.supply_micro::text, t.offset_micro::text, t.curve_k::text,
           (select price_micro_usd::text from price_ticks pt
             where pt.subject_id = s.id and pt.ts <= now() - interval '24 hours'
             order by pt.ts desc limit 1) as price_then,
           (select count(*)::int from holdings h where h.subject_id = s.id and h.balance_micro > 0) as holders,
           (select array_agg(price_micro_usd::text order by ts)
              from (select price_micro_usd, ts from price_ticks pt
                     where pt.subject_id = s.id and pt.ts > now() - interval '30 days'
                     order by ts desc limit 60) recent) as spark
    from subjects s
    join profiles p on p.id = s.profile_id
    join tokens t on t.subject_id = s.id
    where s.status = 'listed'
    order by s.ticker
  `);

  return rows.map((r) => {
    const params = { k: BigInt(r.curve_k), offsetMicro: BigInt(r.offset_micro) };
    const price = spotPriceMicroUsd(params, BigInt(r.supply_micro));
    return {
      subjectId: r.subject_id,
      name: r.name,
      ticker: r.ticker,
      tagline: r.tagline,
      priceMicroUsd: price,
      priceThenMicroUsd: r.price_then === null ? null : BigInt(r.price_then),
      holders: r.holders,
      spark: [...(r.spark ?? []).map(Number), Number(price)],
    };
  });
}

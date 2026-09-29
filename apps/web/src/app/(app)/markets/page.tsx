import { changeRatio, formatMicroUsd, formatPercentChange } from "@peerstock/shared";
import { Avatar } from "@/components/Avatar";
import { Sparkline } from "@/components/Sparkline";
import { getDb } from "@/lib/db";
import { listMarkets } from "@/lib/markets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Markets" };

export default async function MarketsPage() {
  const db = getDb();
  if (!db) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold">Markets</h1>
        <p className="mt-2 text-muted">The database isn&apos;t connected yet.</p>
      </div>
    );
  }
  const markets = await listMarkets(db);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Markets</h1>
        <p className="mt-1 text-sm text-muted">
          {markets.length} {markets.length === 1 ? "friend" : "friends"} listed · change over the past day
        </p>
      </div>

      {markets.length === 0 ? (
        <p className="text-muted">No one is listed yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {markets.map((m) => {
            const change = m.priceThenMicroUsd === null ? null : changeRatio(m.priceThenMicroUsd, m.priceMicroUsd);
            return (
              <li key={m.subjectId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="truncate text-xs text-muted">
                    ${m.ticker} · {m.holders} {m.holders === 1 ? "holder" : "holders"}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Sparkline values={m.spark} />
                </div>
                <div className="w-20 text-right">
                  <div className="font-display text-sm">{formatMicroUsd(m.priceMicroUsd)}</div>
                  {change !== null && (
                    <div className={"text-xs " + (change >= 0 ? "text-lime" : "text-pink")}>
                      {formatPercentChange(change)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

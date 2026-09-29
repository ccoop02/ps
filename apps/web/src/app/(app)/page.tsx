import Link from "next/link";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { sql } from "@peerstock/db";
import { getDb } from "@/lib/db";
import { checkSupabaseConnection, type ConnectionStatus } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const milestones = [
  "Foundation",
  "Pricing package",
  "Database",
  "Accounts and group",
  "Listing",
  "Trading",
  "Stock page",
  "Feed and trade notes",
  "Metrics",
  "Treasury",
  "Realtime",
  "Socials",
  "Portfolio, watchlist, homepage",
  "Hardening",
  "Two-week beta",
];
const CURRENT_MILESTONE = 2;

function StatusRow({ label, status, note }: { label: string; status: ConnectionStatus; note?: string }) {
  const view = {
    connected: { icon: <CheckCircle2 className="text-lime" size={18} />, text: "Connected" },
    "not-configured": {
      icon: <CircleDashed className="text-muted" size={18} />,
      text: "Not set up yet",
    },
    error: { icon: <XCircle className="text-pink" size={18} />, text: "Can't connect" },
  }[status.state];
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-sm">
        {view.icon}
        {view.text}
        {note && <span className="text-muted">· {note}</span>}
        {status.state === "error" && (
          <span className="text-muted">({status.detail})</span>
        )}
      </span>
    </div>
  );
}

async function checkTables(): Promise<{ status: ConnectionStatus; note?: string }> {
  const db = getDb();
  if (!db) return { status: { state: "not-configured" } };
  try {
    const [row] = await db.execute<{ stocks: number }>(
      sql`select count(*)::int as stocks from subjects where status = 'listed'`,
    );
    return { status: { state: "connected" }, note: `${row?.stocks ?? 0} stocks listed` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return { status: { state: "error", detail: message.slice(0, 80) } };
  }
}

export default async function HomePage() {
  const [supabase, tables] = await Promise.all([checkSupabaseConnection(), checkTables()]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted">Private beta</p>
        <h1 className="font-display text-2xl font-bold">Your dashboard</h1>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-base font-semibold">System status</h2>
          <div className="mt-3 divide-y divide-line">
            <StatusRow label="App (Vercel)" status={{ state: "connected" }} />
            <StatusRow label="Database (Supabase)" status={supabase} />
            <StatusRow label="Tables and data" status={tables.status} note={tables.note} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Build progress</h2>
          <ol className="mt-3 space-y-1.5 text-sm">
            {milestones.map((name, i) => (
              <li key={name} className="flex items-center gap-2">
                {i < CURRENT_MILESTONE ? (
                  <CheckCircle2 size={16} className="text-lime" />
                ) : i === CURRENT_MILESTONE ? (
                  <CircleDashed size={16} className="text-cyan" />
                ) : (
                  <CircleDashed size={16} className="text-line" />
                )}
                <span className={i > CURRENT_MILESTONE ? "text-muted" : ""}>
                  {i}. {name}
                </span>
              </li>
            ))}
          </ol>
          <Link
            href="/playground"
            className="mt-4 inline-block rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-black"
          >
            Try the curve playground
          </Link>
        </section>
      </div>
    </div>
  );
}

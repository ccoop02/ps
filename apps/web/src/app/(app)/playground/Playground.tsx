"use client";

import { useState } from "react";
import {
  DEFAULT_FEE_SCHEDULE,
  DEFAULT_K,
  dollarsToMicroUsd,
  listToken,
  microToTokens,
  microUsdToDollars,
  planTreasuryTrade,
  quoteBuy,
  quoteSell,
  reserveCoversSupply,
  spotPriceMicroUsd,
  TradeError,
  type TokenState,
} from "@peerstock/pricing";
import { formatCents } from "@peerstock/shared";

interface LogRow {
  label: string;
  detail: string;
  price: bigint;
}

const usd = (microUsd: bigint) => `$${microUsdToDollars(microUsd).toFixed(3)}`;
const cents = (c: bigint) => formatCents(Number(c));
const tokens = (m: bigint) => microToTokens(m).toFixed(3);

function pctChange(before: bigint, after: bigint) {
  if (before === 0n) return "";
  const pct = (Number(after - before) / Number(before)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function Playground() {
  const [listPrice, setListPrice] = useState(2);
  const [feesOn, setFeesOn] = useState(true);
  const [amount, setAmount] = useState(10);
  const [initial] = useState(() => listToken(dollarsToMicroUsd(2), DEFAULT_K));
  const [state, setState] = useState<TokenState>(initial.state);
  const [youHold, setYouHold] = useState(0n);
  const [treasuryHolds, setTreasuryHolds] = useState(initial.treasurySeedMicro);
  const [cashSpent, setCashSpent] = useState(0n);
  const [feesPaid, setFeesPaid] = useState(0n);
  const [log, setLog] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fees = { ...DEFAULT_FEE_SCHEDULE, enabled: feesOn };
  const price = spotPriceMicroUsd(state, state.supplyMicro);

  function reset(newPrice = listPrice) {
    const l = listToken(dollarsToMicroUsd(newPrice), DEFAULT_K);
    setListPrice(newPrice);
    setState(l.state);
    setYouHold(0n);
    setTreasuryHolds(l.treasurySeedMicro);
    setCashSpent(0n);
    setFeesPaid(0n);
    setLog([]);
    setError(null);
  }

  function run(fn: () => void) {
    try {
      setError(null);
      fn();
    } catch (e) {
      setError(e instanceof TradeError ? e.message : String(e));
    }
  }

  const preview = (() => {
    try {
      return quoteBuy(state, BigInt(Math.round(amount * 100)), fees);
    } catch {
      return null;
    }
  })();

  function buy() {
    run(() => {
      const q = quoteBuy(state, BigInt(Math.round(amount * 100)), fees);
      setState(q.after);
      setYouHold((h) => h + q.tokensMicro);
      setCashSpent((c) => c + q.totalCents);
      setFeesPaid((f) => f + q.feeCents);
      setLog((l) => [
        {
          label: `You bought ${cents(q.totalCents)}`,
          detail: `${tokens(q.tokensMicro)} tokens at avg ${usd(q.avgPriceMicroUsd)}, fee ${cents(q.feeCents)} (${q.feeBps / 100}%)`,
          price: q.priceAfterMicroUsd,
        },
        ...l,
      ]);
    });
  }

  function sell(share: number) {
    run(() => {
      const amt = share === 1 ? youHold : (youHold * BigInt(Math.round(share * 100))) / 100n;
      if (amt <= 0n) throw new TradeError("You don't hold any tokens yet", "invalid_amount");
      const q = quoteSell(state, amt, fees);
      setState(q.after);
      setYouHold((h) => h - amt);
      setCashSpent((c) => c - q.netCents);
      setFeesPaid((f) => f + q.feeCents);
      setLog((l) => [
        {
          label: `You sold ${tokens(amt)} tokens`,
          detail: `received ${cents(q.netCents)} at avg ${usd(q.avgPriceMicroUsd)}, fee ${cents(q.feeCents)} (${q.feeBps / 100}%)`,
          price: q.priceAfterMicroUsd,
        },
        ...l,
      ]);
    });
  }

  function treasury(bps: number) {
    run(() => {
      const t = planTreasuryTrade(state, bps, treasuryHolds);
      if (!t) throw new TradeError("The treasury has no tokens left to sell", "insufficient_supply");
      setState(t.after);
      setTreasuryHolds((h) => (t.side === "buy" ? h + t.tokensMicro : h - t.tokensMicro));
      setLog((l) => [
        {
          label: `Treasury ${t.side === "buy" ? "bought" : "sold"} ${tokens(t.tokensMicro)} tokens`,
          detail: `asked ${bps > 0 ? "+" : ""}${bps / 100}%, moved ${pctChange(t.priceBeforeMicroUsd, t.priceAfterMicroUsd)}`,
          price: t.priceAfterMicroUsd,
        },
        ...l,
      ]);
    });
  }

  const backed = reserveCoversSupply(state);
  const holdingValue = youHold > 0n ? quoteSell(state, youHold, fees).netCents : 0n;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted">Milestone 1 · test page</p>
        <h1 className="font-display text-2xl font-bold">Curve playground</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Try the real pricing engine on a pretend stock. Nothing here is saved, and it doesn&apos;t
          touch anyone&apos;s balance.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Price" value={usd(price)} />
            <Stat label="Supply" value={tokens(state.supplyMicro)} />
            <Stat label="Reserve" value={cents(state.reserveCents)} />
            <Stat
              label="Reserve covers all tokens"
              value={backed ? "Yes" : "NO"}
              tone={backed ? "good" : "bad"}
            />
            <Stat label="You hold" value={`${tokens(youHold)} tokens`} />
            <Stat label="Worth if sold now" value={cents(holdingValue)} />
            <Stat label="Your profit / loss" value={cents(holdingValue - cashSpent)} tone={holdingValue - cashSpent >= 0n ? "good" : "bad"} />
            <Stat label="Fees paid to platform" value={cents(feesPaid)} />
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-base font-semibold">History</h2>
            {log.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No trades yet. Try a buy on the right.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {log.map((row, i) => (
                  <li key={log.length - i} className="flex items-start justify-between gap-4 py-2">
                    <div>
                      <div>{row.label}</div>
                      <div className="text-muted">{row.detail}</div>
                    </div>
                    <div className="shrink-0 font-display text-sm">{usd(row.price)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Setup</h2>
            <label className="mt-3 block text-sm text-muted">
              Listing price
              <select
                value={listPrice}
                onChange={(e) => reset(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-white"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    ${p}.00 (score {(p - 1) * 25})
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex items-center justify-between text-sm">
              <span>Trading fees</span>
              <button
                type="button"
                onClick={() => setFeesOn((f) => !f)}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold " +
                  (feesOn ? "bg-lime text-black" : "bg-surface-raised text-muted")
                }
              >
                {feesOn ? "On" : "Off"}
              </button>
            </label>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-3 w-full rounded-lg border border-line py-2 text-sm text-muted hover:text-white"
            >
              Start over
            </button>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Buy</h2>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
              <span className="text-muted">$</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-transparent font-display text-lg outline-none"
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[1, 5, 10, 25].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="rounded-lg border border-line py-1.5 text-sm hover:border-violet"
                >
                  ${v}
                </button>
              ))}
            </div>
            {preview && (
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Tokens you get" value={tokens(preview.tokensMicro)} />
                <Row label="Average price" value={usd(preview.avgPriceMicroUsd)} />
                <Row
                  label="Price after"
                  value={`${usd(preview.priceAfterMicroUsd)} (${pctChange(preview.priceBeforeMicroUsd, preview.priceAfterMicroUsd)})`}
                />
                <Row label={`Fee (${preview.feeBps / 100}%, to platform)`} value={cents(preview.feeCents)} />
              </dl>
            )}
            <button
              type="button"
              onClick={buy}
              className="mt-3 w-full rounded-lg bg-lime py-2.5 font-semibold text-black"
            >
              Buy ${amount.toFixed(2)}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => sell(0.5)} className="rounded-lg border border-line py-2 text-sm">
                Sell half
              </button>
              <button type="button" onClick={() => sell(1)} className="rounded-lg border border-pink/60 py-2 text-sm text-pink">
                Sell all
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Treasury</h2>
            <p className="mt-1 text-sm text-muted">
              Holds {tokens(treasuryHolds)} tokens. Simulate a score change moving the price.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => treasury(200)} className="rounded-lg border border-line py-2 text-sm text-lime">
                Score +10 (+2%)
              </button>
              <button type="button" onClick={() => treasury(-200)} className="rounded-lg border border-line py-2 text-sm text-pink">
                Score -10 (-2%)
              </button>
            </div>
          </section>

          {error && <p className="rounded-lg bg-pink/10 px-3 py-2 text-sm text-pink">{error}</p>}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={
          "mt-1 font-display text-base " + (tone === "good" ? "text-lime" : tone === "bad" ? "text-pink" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

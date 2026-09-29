/**
 * Demo data: a "Demo friends" group with the 10 people from the designs and
 * a month of simulated trading, all run through the real pricing engine.
 *
 * Demo people have no login and are flagged is_demo, so they can all be
 * removed before the real beta. Run via scripts/seed.ts.
 */
import { eq, sql } from "drizzle-orm";
import {
  DEFAULT_FEE_SCHEDULE,
  DEFAULT_K,
  ENGINE_VERSION,
  listingPriceForScore,
  listToken,
  planTreasuryTrade,
  quoteBuy,
  quoteSell,
  spotPriceMicroUsd,
  TradeError,
  type TokenState,
} from "@peerstock/pricing";
import type { Db } from "./index";
import * as schema from "./schema";

const DAYS = 30;
const STARTING_CASH = 10_000n;

const PEOPLE = [
  { name: "Jake Morales", ticker: "JAKE", score: 80, tagline: "Distance runner, bad at replying to texts" },
  { name: "Dani Okafor", ticker: "DANI", score: 70, tagline: "Deadlifts and dad jokes" },
  { name: "Zoe Carter", ticker: "ZOE", score: 30, tagline: "Always has a plan B" },
  { name: "Leo Novak", ticker: "LEO", score: 55, tagline: "Group chat historian" },
  { name: "Priya Shah", ticker: "PRIYA", score: 65, tagline: "Promotion season" },
  { name: "Marcus Lee", ticker: "MARC", score: 35, tagline: "Maybe next Friday" },
  { name: "Ava Brooks", ticker: "AVA", score: 40, tagline: "Sunday league captain (for now)" },
  { name: "Sam Rivera", ticker: "SAMR", score: 20, tagline: "Professional skeptic" },
  { name: "Tessa Kim", ticker: "TESS", score: 45, tagline: "Reading 52 books this year" },
  { name: "Noah Patel", ticker: "NOAH", score: 75, tagline: "Internship hunter" },
] as const;

const NOTES = [
  "Marathon is in the bag.",
  "Flaked again. I am out.",
  "Taking profits before race day nerves.",
  "His training posts are unreal.",
  "Rebalancing.",
  "Buying the dip.",
  "Main character energy.",
  "Too early to call.",
  "Long-term hold.",
  "Vibes are off this week.",
];

const POSTS: Record<string, string[]> = {
  JAKE: ["Long run done. Taper starts next week, then it's race day.", "Ran 14 miles before brunch."],
  DANI: ["New deadlift PR today.", "Coaching the beginners class on Thursday."],
  NOAH: ["Got the internship offer. Announcement coming this week."],
  AVA: ["Might move to Denver. Nothing decided yet."],
  MARC: ["I will be at Friday plans. For real this time."],
  PRIYA: ["Presenting to the leadership team tomorrow."],
  TESS: ["Book 31 of 52 done."],
};

/** Small deterministic random generator so the demo is the same every time. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function removeDemo(db: Db) {
  await db.delete(schema.groups).where(eq(schema.groups.isDemo, true));
  await db.delete(schema.profiles).where(eq(schema.profiles.isDemo, true));
}

/** Creates the demo group unless it exists. Returns false if it was already there. */
export async function seedDemo(db: Db, log: (msg: string) => void = console.log): Promise<boolean> {
  const existing = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.isDemo, true))
    .limit(1);
  if (existing.length > 0) return false;

  const rand = rng(42);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const now = Date.now();
  const start = now - DAYS * 86_400_000;

  await db.transaction(async (tx) => {
    // People and group
    const profiles = await tx
      .insert(schema.profiles)
      .values(PEOPLE.map((p) => ({ displayName: p.name, isDemo: true, cashCents: STARTING_CASH })))
      .returning({ id: schema.profiles.id });
    const [group] = await tx
      .insert(schema.groups)
      .values({ name: "Demo friends", inviteCode: "demo-" + Math.floor(rand() * 1e9).toString(36), isDemo: true })
      .returning({ id: schema.groups.id });
    await tx.insert(schema.groupMembers).values(profiles.map((p) => ({ groupId: group!.id, profileId: p.id })));
    await tx.insert(schema.ledgerEntries).values(
      profiles.map((p) => ({
        account: "user" as const,
        profileId: p.id,
        deltaCents: STARTING_CASH,
        reason: "starting_grant" as const,
        createdAt: new Date(start),
      })),
    );

    const subjects = await tx
      .insert(schema.subjects)
      .values(
        PEOPLE.map((p, i) => ({
          profileId: profiles[i]!.id,
          groupId: group!.id,
          ticker: p.ticker,
          status: "listed" as const,
          tagline: p.tagline,
          listedAt: new Date(start),
        })),
      )
      .returning({ id: schema.subjects.id });

    // In-memory simulation, then bulk insert.
    type Stock = { subjectId: string; state: TokenState; treasury: bigint; person: (typeof PEOPLE)[number] };
    const stocks: Stock[] = [];
    const cash = profiles.map(() => STARTING_CASH);
    const holdings = new Map<string, { balance: bigint; basis: bigint }>(); // `${profileIdx}:${stockIdx}`

    type TradeRow = typeof schema.trades.$inferInsert;
    const trades: TradeRow[] = [];
    const ticks: (typeof schema.priceTicks.$inferInsert & { tradeIndex?: number })[] = [];
    const ledger: (typeof schema.ledgerEntries.$inferInsert & { tradeIndex: number })[] = [];
    const treasuryLog: (typeof schema.treasuryLedger.$inferInsert & { tradeIndex: number })[] = [];

    PEOPLE.forEach((person, i) => {
      const listing = listToken(listingPriceForScore(person.score), DEFAULT_K);
      const subjectId = subjects[i]!.id;
      stocks.push({ subjectId, state: listing.state, treasury: listing.treasurySeedMicro, person });
      const price = spotPriceMicroUsd(listing.state, listing.state.supplyMicro);
      const at = new Date(start);
      trades.push({
        subjectId,
        actor: "treasury",
        side: "buy",
        source: "listing_seed",
        tokensMicro: listing.treasurySeedMicro,
        curveCents: listing.seedCostCents,
        feeCents: 0n,
        feeBps: 0,
        totalCents: listing.seedCostCents,
        avgPriceMicroUsd: (listing.seedCostCents * 10_000n * 1_000_000n) / listing.treasurySeedMicro,
        priceBeforeMicroUsd: spotPriceMicroUsd(listing.state, 0n),
        priceAfterMicroUsd: price,
        supplyAfterMicro: listing.state.supplyMicro,
        engineVersion: ENGINE_VERSION,
        createdAt: at,
      });
      const ti = trades.length - 1;
      ticks.push({ subjectId, priceMicroUsd: price, supplyMicro: listing.state.supplyMicro, marker: "listing", markerLabel: "Listed", ts: at, tradeIndex: ti });
      ledger.push({ account: "treasury", deltaCents: -listing.seedCostCents, reason: "treasury_issue", tradeIndex: ti, createdAt: at });
    });

    const events = 8 * DAYS;
    for (let e = 0; e < events; e++) {
      const at = new Date(start + ((e + 1) / (events + 1)) * (now - start - 3_600_000));
      const si = Math.floor(rand() * stocks.length);
      const stock = stocks[si]!;

      // Occasional treasury rebalance, with a chart marker.
      if (rand() < 0.06) {
        const bps = Math.round((rand() - 0.45) * 300);
        const t = planTreasuryTrade(stock.state, bps, stock.treasury);
        if (!t) continue;
        stock.state = t.after;
        stock.treasury += t.side === "buy" ? t.tokensMicro : -t.tokensMicro;
        trades.push({
          subjectId: stock.subjectId,
          actor: "treasury",
          side: t.side,
          source: "treasury_score",
          tokensMicro: t.tokensMicro,
          curveCents: t.cents,
          feeCents: 0n,
          feeBps: 0,
          totalCents: t.cents,
          avgPriceMicroUsd: (t.cents * 10_000n * 1_000_000n) / t.tokensMicro,
          priceBeforeMicroUsd: t.priceBeforeMicroUsd,
          priceAfterMicroUsd: t.priceAfterMicroUsd,
          supplyAfterMicro: t.after.supplyMicro,
          engineVersion: ENGINE_VERSION,
          createdAt: at,
        });
        const ti = trades.length - 1;
        const pct = (t.achievedBps / 100).toFixed(1);
        ticks.push({ subjectId: stock.subjectId, priceMicroUsd: t.priceAfterMicroUsd, supplyMicro: t.after.supplyMicro, marker: "rebalance", markerLabel: `Metrics rebalance ${t.achievedBps >= 0 ? "+" : ""}${pct}%`, ts: at, tradeIndex: ti });
        ledger.push({ account: "treasury", deltaCents: t.side === "buy" ? -t.cents : t.cents, reason: "treasury_issue", tradeIndex: ti, createdAt: at });
        treasuryLog.push({ subjectId: stock.subjectId, source: "treasury_score", requestedBps: bps, achievedBps: t.achievedBps, tradeIndex: ti, createdAt: at });
        continue;
      }

      // A person trades a stock that isn't themselves.
      let pi = Math.floor(rand() * profiles.length);
      if (pi === si) pi = (pi + 1) % profiles.length;
      const key = `${pi}:${si}`;
      const pos = holdings.get(key) ?? { balance: 0n, basis: 0n };
      // Bias buyers toward high-score people so the demo has winners and losers.
      const buyChance = 0.35 + stock.person.score / 200;
      const wantsSell = pos.balance > 0n && rand() > buyChance;
      const note = rand() < 0.35 ? pick(NOTES) : null;

      try {
        if (wantsSell) {
          const amount = rand() < 0.3 ? pos.balance : (pos.balance * BigInt(20 + Math.floor(rand() * 60))) / 100n;
          const q = quoteSell(stock.state, amount, DEFAULT_FEE_SCHEDULE);
          stock.state = q.after;
          const basisOut = (pos.basis * amount) / pos.balance;
          holdings.set(key, { balance: pos.balance - amount, basis: pos.basis - basisOut });
          cash[pi] = cash[pi]! + q.netCents;
          trades.push({
            subjectId: stock.subjectId, actor: "user", profileId: profiles[pi]!.id, side: "sell", source: "user",
            tokensMicro: amount, curveCents: q.proceedsCents, feeCents: q.feeCents, feeBps: q.feeBps,
            totalCents: q.netCents, avgPriceMicroUsd: q.avgPriceMicroUsd, priceBeforeMicroUsd: q.priceBeforeMicroUsd,
            priceAfterMicroUsd: q.priceAfterMicroUsd, supplyAfterMicro: q.after.supplyMicro,
            engineVersion: ENGINE_VERSION, note, createdAt: at,
          });
          const ti = trades.length - 1;
          ledger.push({ account: "user", profileId: profiles[pi]!.id, deltaCents: q.netCents, reason: "trade", tradeIndex: ti, createdAt: at });
          if (q.feeCents > 0n) ledger.push({ account: "platform", deltaCents: q.feeCents, reason: "fee", tradeIndex: ti, createdAt: at });
          ticks.push({ subjectId: stock.subjectId, priceMicroUsd: q.priceAfterMicroUsd, supplyMicro: q.after.supplyMicro, ts: at, tradeIndex: ti });
        } else {
          const budget = BigInt(100 + Math.floor(rand() * 1_400)); // $1-$15
          if (cash[pi]! < budget) continue;
          const q = quoteBuy(stock.state, budget, DEFAULT_FEE_SCHEDULE);
          stock.state = q.after;
          holdings.set(key, { balance: pos.balance + q.tokensMicro, basis: pos.basis + q.totalCents });
          cash[pi] = cash[pi]! - q.totalCents;
          trades.push({
            subjectId: stock.subjectId, actor: "user", profileId: profiles[pi]!.id, side: "buy", source: "user",
            tokensMicro: q.tokensMicro, curveCents: q.costCents, feeCents: q.feeCents, feeBps: q.feeBps,
            totalCents: q.totalCents, avgPriceMicroUsd: q.avgPriceMicroUsd, priceBeforeMicroUsd: q.priceBeforeMicroUsd,
            priceAfterMicroUsd: q.priceAfterMicroUsd, supplyAfterMicro: q.after.supplyMicro,
            engineVersion: ENGINE_VERSION, note, createdAt: at,
          });
          const ti = trades.length - 1;
          ledger.push({ account: "user", profileId: profiles[pi]!.id, deltaCents: -q.totalCents, reason: "trade", tradeIndex: ti, createdAt: at });
          if (q.feeCents > 0n) ledger.push({ account: "platform", deltaCents: q.feeCents, reason: "fee", tradeIndex: ti, createdAt: at });
          ticks.push({ subjectId: stock.subjectId, priceMicroUsd: q.priceAfterMicroUsd, supplyMicro: q.after.supplyMicro, ts: at, tradeIndex: ti });
        }
      } catch (err) {
        if (!(err instanceof TradeError)) throw err;
      }
    }

    // Reserve trade ids up front so dependent rows can reference them in bulk.
    const ids = await tx.execute<{ id: string }>(
      sql`select nextval(pg_get_serial_sequence('trades', 'id'))::text as id from generate_series(1, ${trades.length})`,
    );
    const tradeIds = ids.map((r) => BigInt(r.id));
    const chunk = <T,>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

    for (const part of chunk(trades.map((t, i) => ({ ...t, id: tradeIds[i]! })))) {
      await tx.insert(schema.trades).values(part);
    }
    for (const part of chunk(ticks.map(({ tradeIndex, ...t }) => ({ ...t, tradeId: tradeIndex === undefined ? null : tradeIds[tradeIndex]! })))) {
      await tx.insert(schema.priceTicks).values(part);
    }
    for (const part of chunk(ledger.map(({ tradeIndex, ...l }) => ({ ...l, tradeId: tradeIds[tradeIndex]! })))) {
      await tx.insert(schema.ledgerEntries).values(part);
    }
    if (treasuryLog.length > 0) {
      await tx.insert(schema.treasuryLedger).values(treasuryLog.map(({ tradeIndex, ...l }) => ({ ...l, tradeId: tradeIds[tradeIndex]! })));
    }

    await tx.insert(schema.tokens).values(
      stocks.map((s) => ({
        subjectId: s.subjectId,
        supplyMicro: s.state.supplyMicro,
        reserveCents: s.state.reserveCents,
        offsetMicro: s.state.offsetMicro,
        curveK: s.state.k,
        engineVersion: ENGINE_VERSION,
      })),
    );
    await tx.insert(schema.treasuryHoldings).values(stocks.map((s) => ({ subjectId: s.subjectId, balanceMicro: s.treasury })));
    const holdingRows = [...holdings.entries()]
      .filter(([, h]) => h.balance > 0n)
      .map(([key, h]) => {
        const [pi, si] = key.split(":").map(Number);
        return { profileId: profiles[pi!]!.id, subjectId: stocks[si!]!.subjectId, balanceMicro: h.balance, costBasisCents: h.basis };
      });
    if (holdingRows.length > 0) await tx.insert(schema.holdings).values(holdingRows);
    for (let i = 0; i < profiles.length; i++) {
      await tx.update(schema.profiles).set({ cashCents: cash[i]! }).where(eq(schema.profiles.id, profiles[i]!.id));
    }

    // Posts by each person on their own page, with votes from others.
    const postRows: (typeof schema.posts.$inferInsert)[] = [];
    stocks.forEach((s, i) => {
      for (const body of POSTS[s.person.ticker] ?? []) {
        postRows.push({
          subjectId: s.subjectId,
          authorId: profiles[i]!.id,
          body,
          priceAtPostMicroUsd: spotPriceMicroUsd(s.state, s.state.supplyMicro),
          createdAt: new Date(now - Math.floor(rand() * 5 * 86_400_000)),
        });
      }
    });
    const posts = await tx.insert(schema.posts).values(postRows).returning({ id: schema.posts.id, authorId: schema.posts.authorId });
    const votes: (typeof schema.postSentimentVotes.$inferInsert)[] = [];
    for (const post of posts) {
      for (const voter of profiles) {
        if (voter.id === post.authorId || rand() < 0.4) continue;
        const at = new Date(now - Math.floor(rand() * 4 * 86_400_000));
        votes.push({ postId: post.id, voterId: voter.id, sentiment: rand() < 0.65 ? "bullish" : "bearish", createdAt: at, updatedAt: at });
      }
    }
    if (votes.length > 0) await tx.insert(schema.postSentimentVotes).values(votes);

    // Vibe votes (1-5) between everyone.
    const peer: (typeof schema.peerVotes.$inferInsert)[] = [];
    profiles.forEach((voter, vi) => {
      stocks.forEach((s, si) => {
        if (vi === si) return;
        const base = s.person.score / 25 + 1; // 1-5
        peer.push({ voterId: voter.id, subjectId: s.subjectId, score: Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 2))) });
      });
    });
    await tx.insert(schema.peerVotes).values(peer);

    log(
      `Seeded ${PEOPLE.length} demo friends, ${trades.length} trades, ${ticks.length} price ticks, ${posts.length} posts, ${votes.length} sentiment votes.`,
    );
  });
  return true;
}

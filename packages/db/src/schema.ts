/**
 * Phase 1 database schema.
 *
 * Units match packages/pricing: cash in whole cents, tokens in micro-tokens
 * (1 token = 1,000,000), prices in micro-dollars. All of these are bigints.
 *
 * Every table has row-level security switched on with no policies (see the
 * enable_rls migration), so the browser's public key can't read or write
 * anything directly. The app's server reads and writes on users' behalf.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Supabase's own auth table. Declared only so profiles can reference it;
// drizzle-kit never creates or changes it.
const auth = pgSchema("auth");
export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});

const micro = (name: string) => bigint(name, { mode: "bigint" });
const cents = (name: string) => bigint(name, { mode: "bigint" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Enums ----------

export const groupRole = pgEnum("group_role", ["member", "admin"]);
export const subjectStatus = pgEnum("subject_status", ["pending", "listed", "delisted"]);
export const tradeSide = pgEnum("trade_side", ["buy", "sell"]);
export const tradeActor = pgEnum("trade_actor", ["user", "treasury"]);
export const tradeSource = pgEnum("trade_source", [
  "user",
  "listing_seed",
  "treasury_score",
  "treasury_event",
]);
export const ledgerAccount = pgEnum("ledger_account", ["user", "platform", "treasury"]);
export const ledgerReason = pgEnum("ledger_reason", [
  "starting_grant",
  "trade",
  "fee",
  "treasury_issue",
  "admin_adjust",
]);
export const priceMarker = pgEnum("price_marker", ["listing", "event", "rebalance"]);
export const postType = pgEnum("post_type", ["text", "image", "video"]);
export const sentiment = pgEnum("sentiment", ["bullish", "bearish"]);
export const reportTarget = pgEnum("report_target", ["post", "comment", "trade_note"]);
export const reportStatus = pgEnum("report_status", ["open", "hidden", "dismissed"]);
export const socialPlatform = pgEnum("social_platform", [
  "instagram",
  "tiktok",
  "x",
  "threads",
  "youtube",
  "strava",
  "spotify",
  "snapchat",
  "linkedin",
  "letterboxd",
  "goodreads",
  "other",
]);

// ---------- People and groups ----------

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Null for demo (seeded) people who can't sign in. */
  authUserId: uuid("auth_user_id")
    .unique()
    .references(() => authUsers.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: varchar("bio", { length: 160 }),
  cashCents: cents("cash_cents").notNull().default(sql`0`),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [check("cash_non_negative", sql`${t.cashCents} >= 0`)]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: varchar("invite_code", { length: 32 }).notNull().unique(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    role: groupRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.profileId] })],
);

/** Global settings the admin controls (a single row, id = 1). */
export const platformSettings = pgTable("platform_settings", {
  id: smallint("id").primaryKey().default(1),
  feesEnabled: boolean("fees_enabled").notNull().default(true),
  /** [{ minCents, bps }], see packages/pricing FeeSchedule. */
  feeTiers: jsonb("fee_tiers").notNull(),
  tradingPaused: boolean("trading_paused").notNull().default(false),
  startingCashCents: cents("starting_cash_cents").notNull().default(sql`10000`),
  updatedAt: updatedAt(),
  updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
}, (t) => [check("single_row", sql`${t.id} = 1`)]);

// ---------- Stocks ----------

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 8 }).notNull(),
    status: subjectStatus("status").notNull().default("pending"),
    tagline: varchar("tagline", { length: 120 }),
    listedAt: timestamp("listed_at", { withTimezone: true }),
    delistedAt: timestamp("delisted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("subjects_ticker_unique").on(t.ticker),
    uniqueIndex("subjects_profile_group_unique").on(t.profileId, t.groupId),
    check("ticker_format", sql`${t.ticker} ~ '^[A-Z0-9]{2,8}$'`),
  ],
);

/** Bonding-curve state for each listed person. */
export const tokens = pgTable("tokens", {
  subjectId: uuid("subject_id").primaryKey().references(() => subjects.id, { onDelete: "cascade" }),
  supplyMicro: micro("supply_micro").notNull(),
  reserveCents: cents("reserve_cents").notNull(),
  offsetMicro: micro("offset_micro").notNull(),
  curveK: bigint("curve_k", { mode: "bigint" }).notNull(),
  engineVersion: text("engine_version").notNull(),
  updatedAt: updatedAt(),
}, (t) => [
  check("supply_non_negative", sql`${t.supplyMicro} >= 0`),
  check("reserve_non_negative", sql`${t.reserveCents} >= 0`),
]);

export const holdings = pgTable(
  "holdings",
  {
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    balanceMicro: micro("balance_micro").notNull(),
    /** Cash paid for the current balance (reduced proportionally on sells). */
    costBasisCents: cents("cost_basis_cents").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.subjectId] }),
    index("holdings_subject_idx").on(t.subjectId),
    check("balance_non_negative", sql`${t.balanceMicro} >= 0`),
  ],
);

export const treasuryHoldings = pgTable("treasury_holdings", {
  subjectId: uuid("subject_id").primaryKey().references(() => subjects.id, { onDelete: "cascade" }),
  balanceMicro: micro("balance_micro").notNull(),
  updatedAt: updatedAt(),
}, (t) => [check("treasury_balance_non_negative", sql`${t.balanceMicro} >= 0`)]);

/** Immutable record of every trade, by people and by the treasury. */
export const trades = pgTable(
  "trades",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    actor: tradeActor("actor").notNull(),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    side: tradeSide("side").notNull(),
    source: tradeSource("source").notNull(),
    tokensMicro: micro("tokens_micro").notNull(),
    /** Amount that went into (buy) or out of (sell) the reserve. */
    curveCents: cents("curve_cents").notNull(),
    feeCents: cents("fee_cents").notNull(),
    feeBps: integer("fee_bps").notNull(),
    /** Cash the trader paid (buy) or received (sell). */
    totalCents: cents("total_cents").notNull(),
    avgPriceMicroUsd: micro("avg_price_micro_usd").notNull(),
    priceBeforeMicroUsd: micro("price_before_micro_usd").notNull(),
    priceAfterMicroUsd: micro("price_after_micro_usd").notNull(),
    supplyAfterMicro: micro("supply_after_micro").notNull(),
    engineVersion: text("engine_version").notNull(),
    note: varchar("note", { length: 140 }),
    noteHidden: boolean("note_hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("trades_subject_time_idx").on(t.subjectId, t.createdAt),
    index("trades_profile_time_idx").on(t.profileId, t.createdAt),
    index("trades_time_idx").on(t.createdAt),
    check("trade_tokens_positive", sql`${t.tokensMicro} > 0`),
  ],
);

/** One row per price change; feeds charts, gainers and losers. */
export const priceTicks = pgTable(
  "price_ticks",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    priceMicroUsd: micro("price_micro_usd").notNull(),
    supplyMicro: micro("supply_micro").notNull(),
    tradeId: bigint("trade_id", { mode: "bigint" }).references(() => trades.id, { onDelete: "set null" }),
    marker: priceMarker("marker"),
    markerLabel: text("marker_label"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_ticks_subject_ts_idx").on(t.subjectId, t.ts)],
);

/**
 * Double-entry style cash log. Sum of a user's entries = profiles.cash_cents;
 * platform entries are fee income; treasury entries are play money issued.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    account: ledgerAccount("account").notNull(),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    deltaCents: cents("delta_cents").notNull(),
    reason: ledgerReason("reason").notNull(),
    tradeId: bigint("trade_id", { mode: "bigint" }).references(() => trades.id, { onDelete: "set null" }),
    memo: text("memo"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_profile_idx").on(t.profileId, t.createdAt),
    check(
      "user_entries_have_profile",
      sql`(${t.account} = 'user') = (${t.profileId} is not null)`,
    ),
  ],
);

export const treasuryLedger = pgTable(
  "treasury_ledger",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    source: tradeSource("source").notNull(),
    requestedBps: integer("requested_bps").notNull(),
    achievedBps: integer("achieved_bps").notNull(),
    tradeId: bigint("trade_id", { mode: "bigint" }).references(() => trades.id, { onDelete: "set null" }),
    detail: jsonb("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("treasury_ledger_subject_idx").on(t.subjectId, t.createdAt)],
);

// ---------- Feed ----------

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    /** Always the subject's own profile: only the person posts on their page. */
    authorId: uuid("author_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    type: postType("type").notNull().default("text"),
    body: varchar("body", { length: 500 }),
    mediaPath: text("media_path"),
    mediaDurationS: smallint("media_duration_s"),
    priceAtPostMicroUsd: micro("price_at_post_micro_usd").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("posts_subject_time_idx").on(t.subjectId, t.createdAt),
    index("posts_time_idx").on(t.createdAt),
    check("video_max_60s", sql`${t.mediaDurationS} is null or ${t.mediaDurationS} <= 60`),
  ],
);

/** Bullish/Bearish votes by other members; the author can't vote (enforced in app code). */
export const postSentimentVotes = pgTable(
  "post_sentiment_votes",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    sentiment: sentiment("sentiment").notNull(),
    createdAt: createdAt(),
    /** A vote counts in a timeframe by when it was cast or last changed. */
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.voterId] }),
    index("sentiment_votes_updated_idx").on(t.updatedAt),
  ],
);

export const reactions = pgTable(
  "reactions",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull().default("like"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.profileId, t.kind] })],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 300 }).notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt)],
);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  targetType: reportTarget("target_type").notNull(),
  /** Post or comment uuid, or trade id, as text. */
  targetId: text("target_id").notNull(),
  reason: varchar("reason", { length: 300 }),
  status: reportStatus("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ---------- Metrics ----------

export const peerVotes = pgTable(
  "peer_votes",
  {
    voterId: uuid("voter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.voterId, t.subjectId] }),
    check("vibe_score_range", sql`${t.score} between 1 and 5`),
  ],
);

export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  question: varchar("question", { length: 140 }).notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  winnerSubjectId: uuid("winner_subject_id").references(() => subjects.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const pollVotes = pgTable(
  "poll_votes",
  {
    pollId: uuid("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.voterId] })],
);

export const hangouts = pgTable("hangouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 100 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const checkins = pgTable(
  "checkins",
  {
    hangoutId: uuid("hangout_id").notNull().references(() => hangouts.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.hangoutId, t.profileId] })],
);

export const streaks = pgTable("streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 40 }).notNull(),
  createdAt: createdAt(),
});

export const streakCheckins = pgTable(
  "streak_checkins",
  {
    streakId: uuid("streak_id").notNull().references(() => streaks.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    photoPath: text("photo_path").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.streakId, t.day] })],
);

export const metricValues = pgTable(
  "metric_values",
  {
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    metricKey: varchar("metric_key", { length: 32 }).notNull(),
    rawValue: doublePrecision("raw_value").notNull(),
    score: doublePrecision("score").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.subjectId, t.metricKey] })],
);

export const metricWeights = pgTable(
  "metric_weights",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    metricKey: varchar("metric_key", { length: 32 }).notNull(),
    weight: doublePrecision("weight").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.metricKey] })],
);

export const fundamentals = pgTable("fundamentals", {
  subjectId: uuid("subject_id").primaryKey().references(() => subjects.id, { onDelete: "cascade" }),
  score: doublePrecision("score").notNull(),
  /** Score the treasury last traded on; the next batch trades on the difference. */
  lastTradedScore: doublePrecision("last_traded_score").notNull(),
  updatedAt: updatedAt(),
});

export const fundamentalsHistory = pgTable(
  "fundamentals_history",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    score: doublePrecision("score").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("fundamentals_history_idx").on(t.subjectId, t.createdAt)],
);

// ---------- Socials ----------

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    platform: socialPlatform("platform").notNull(),
    handle: varchar("handle", { length: 64 }),
    url: text("url").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("social_accounts_subject_idx").on(t.subjectId)],
);

// ---------- Personal: watchlist, baskets, dashboard, notifications ----------

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    alertPriceMovePct: smallint("alert_price_move_pct"),
    alertNewPost: boolean("alert_new_post").notNull().default(false),
    alertNewEvent: boolean("alert_new_event").notNull().default(false),
    alertEventResolved: boolean("alert_event_resolved").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.subjectId] })],
);

export const baskets = pgTable("baskets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 40 }).notNull(),
  sharedWithGroup: boolean("shared_with_group").notNull().default(false),
  createdAt: createdAt(),
});

export const basketItems = pgTable(
  "basket_items",
  {
    basketId: uuid("basket_id").notNull().references(() => baskets.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.basketId, t.subjectId] })],
);

export const dashboardLayouts = pgTable("dashboard_layouts", {
  profileId: uuid("profile_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  /** [{ id, type, x, y, w, h, settings }] */
  widgets: jsonb("widgets").notNull(),
  updatedAt: updatedAt(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    payload: jsonb("payload").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_profile_idx").on(t.profileId, t.createdAt)],
);

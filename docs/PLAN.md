# Peerstock: Build Plan (Private Beta → Commercial)

Working name: **Peerstock**. The name, colors and fonts live in one config file, so switching to Orra or Tessera later is a small change.

This plan is based on *Friend Market: Project Notes* (Sep 26, 2026) and the *Peerstock Dashboard and Stock Page* designs, plus these decisions:

| Decision | Answer |
| --- | --- |
| Platform | Web app first. It works on phones and can be installed to the home screen. Native iOS/Android apps come later. |
| Who builds | Claude writes and fixes the code. Craig directs and tests. |
| Budget | As cheap as possible: $0/month to start |
| Beta scope | All of Phase 1 before the group starts using it |
| Beta size | 5–20 people, play money |

---

## 1. Stack changes and why

**Language: TypeScript stays** for everything, plus plain SQL for the database. No other language is needed. Python, Go and Solidity would each add a second toolchain without solving a problem we have. TypeScript also means the web app, the server and the future mobile apps share the same pricing code.

What changes is **how many separate systems we run**. The original stack (Expo apps, a separate Fastify API, Redis, a WebSocket gateway, background workers, Clerk, R2 and Mux) is built for thousands of users. For 20 friends it would mean about 7 services to pay for, deploy and debug. That's a poor fit for a $0 budget and a builder who doesn't code. The plan below keeps the same structure (the data model, the pure pricing package, immutable trade events) but runs it on two managed services.

| Layer | Original notes | Beta choice | Why | Path to commercial |
| --- | --- | --- | --- | --- |
| App | React Native + Expo (web, iOS, Android) | **Next.js (React + TypeScript)**, responsive, installable as a PWA | The dashboard's resizable widget grid and charts are much easier to build well on the web. There's no app-store review and you share one link. | Add an Expo app later that reuses `packages/pricing`, `packages/shared` and the same API |
| Backend | Fastify or NestJS service | **Next.js server routes and server actions** on Vercel | One deploy instead of two. The business logic lives in `packages/`, not in the web app, so it can move out cleanly. | Move `packages/core` behind a standalone Fastify API when mobile ships or load requires it |
| Database | PostgreSQL | **PostgreSQL on Supabase** (free tier), schema and migrations with **Drizzle ORM** | Managed and backed up. Drizzle keeps the schema in TypeScript and portable to any Postgres. | Supabase Pro ($25/mo) or any Postgres host |
| Realtime | Redis + WebSockets gateway | **Supabase Realtime** | Live prices, trades and posts without running a server | Add Redis or a dedicated gateway only if volume requires it |
| Jobs | Redis job queue + workers | **Inline for scoring** (runs when a vote lands); **pg_cron** calls a secured endpoint every 15 min for the treasury | 20 users generate trivial load, so no queue is needed | Swap in a real queue (e.g. pg-boss or BullMQ) at scale |
| Auth | Clerk or Auth0 | **Supabase Auth** (email magic link + Google) | Free, lives in the same database, and powers row-level security | Keep as is, or migrate to Clerk. KYC is a separate vendor either way |
| Media | R2/S3 + Mux | **Supabase Storage** (1 GB free). Photos are resized in the browser before upload. Videos are capped at 60 s / 50 MB. | Free at this size | Move video to Mux or Cloudflare Stream if playback or storage becomes a problem |
| Charts | — | **TradingView Lightweight Charts** (free, open source) for price charts; small SVG sparklines | Built for exactly this: ranges and markers | Same |
| Styling | Brand notes | **Tailwind CSS** with brand tokens: violet-black, lime #C6FF4D, hot pink, violet, cyan; Unbounded + Figtree | Matches the designs | Same |
| Widget grid | — | **react-grid-layout** | Drag, resize and a saved layout per user | Same |
| Hosting | — | **Vercel Hobby** (free) | Every branch gets its own preview link for you to test | Vercel Pro ($20/mo) is required once it's commercial, since Hobby is non-commercial only |
| Quality | — | **Vitest** + property tests (fast-check) for the pricing math, **Playwright** browser tests, GitHub Actions CI, **Sentry** free tier for errors | You aren't reading code, so automated checks are the safety net | Same |

**Expected cost during beta: $0/month**, plus an optional domain (~$12/year). At commercial launch expect roughly $45/month to start (Vercel Pro + Supabase Pro), before video, KYC and legal costs.

**Not changing:** the bonding curve, fee split, treasury-with-caps design, off-chain tokens, trades stored as immutable events with an engine version, and the Phase 2–4 roadmap.

---

## 2. Issues found in the notes and designs (with my default fixes)

These are the points where the notes contradict themselves or where the math behaves badly with a small group. Each has a default I'll build unless you say otherwise.

1. **The treasury can only push prices up.** Dividends pay the treasury's purchased tokens out to holders, so the treasury never builds up inventory. Downward moves are "sells limited to what it holds", which is only the 10-token seed. The result is that bad news barely moves a price.
   **Default:** buys driven by score changes stay in the treasury as inventory, and that inventory funds later sells. Only buys from **events with a good outcome** are paid out as dividends. In play money, the treasury can also be issued a larger seed (e.g. 20% of launch supply).
2. **Is the fee on top or included?** The notes say the fee is added on top. The design shows $100 with a $5 fee and 2.23 tokens, meaning the fee comes out of the $100.
   **Default:** follow the design. You enter a total, the fee comes out of it, and selling works the same way.
3. **Group percentiles jump in a small group.** With 5 people, one vote can move someone's metric by 25 points. That's a 5% target price move, which uses the entire per-event cap.
   **Default:** score each metric on a smoothed scale (a running average with a minimum-votes rule instead of a raw rank), then tune it during the two-week test.
4. **Fractional tokens and rounding.** Trades produce amounts like 2.23 tokens and cube-based costs.
   **Default:** store tokens as whole micro-units (1 token = 1,000,000 units) and cash as whole cents, using exact integer math. Rounding always favors the reserve, so it can never be short. An automated test checks that "the reserve covers every token" after thousands of random trades.
5. **What delisting means for holders.** This isn't specified.
   **Default:** delisting stops new buys and hides the person from lists and widgets, but holders can still sell back to the curve at any time. The subject can relist later.
6. **Follow vs Watch.** The design still shows "Follow". Per the notes it becomes **Watch**.
7. **Phase 2 items in the Phase 1 designs.** The event-markets widget, the "Live odds" pill, the Markets tab and "includes tokens from event dividends" belong to Phase 2.
   **Default:** build the layout slots now and show "Coming soon" until Phase 2.
8. **Instagram embeds.** Instagram's official embed API needs an approved Meta app. The standard copy-paste embed and profile links work without one, so that's what the beta uses.

---

## 3. Repository layout

```
apps/
  web/                 Next.js app: pages, UI, server routes, cron endpoint
packages/
  pricing/             Pure math, no database: curve, fees, fixed-point, treasury sizing, caps (LMSR in Phase 2)
  core/                Business logic: trade, list, vote, score, treasury run. Talks to the database.
  db/                  Drizzle schema, migrations, seed script (the 10 friends from the designs)
  shared/              Types, validation schemas (Zod), brand config
docs/                  This plan, decisions log, how-to-test guides
.github/workflows/     CI: typecheck, lint, unit tests, browser tests on every push
```

The web app only calls `packages/core`, so a future mobile app or standalone API can reuse the same logic.

---

## 4. Build milestones (all of Phase 1)

The group gets the app only after milestone 13. You can still test every milestone on its own preview link, with seeded fake friends. For each one I'll send a short "what to click" checklist.

| # | Milestone | What you'll be able to test |
| --- | --- | --- |
| 0 | **Foundation.** Monorepo, Next.js, Supabase and Vercel projects, CI, brand tokens and fonts, app shell (top bar and nav from the design) | A live link showing the empty Peerstock shell in the brand colors |
| 1 | **Pricing package.** Curve, fees (subject/platform split), fixed-point math, treasury sizing, daily and per-event caps, with heavy tests including the reserve-invariant check | A readable test report, plus a small "curve playground" page to try trade sizes |
| 2 | **Database.** Full Phase 1 schema, row-level security, migrations, a seed script with Jake, Dani, Noah and the others, and past trades | The seeded data appears in the app |
| 3 | **Accounts and group.** Sign-in (magic link / Google), profile and avatar, invite-only group through an invite link, starting play cash, admin role | You invite a test account and it joins the group |
| 4 | **Listing.** Opt-in consent, ticker choice, starting price from the initial score (offset v), treasury seed position, delist and relist | A friend opts in, gets $TICKER and appears as a stock |
| 5 | **Trading.** Live quote, buy/sell with optional 140-character note, locked transactions, trades and price ticks, fee split, cash ledger, admin "balances reconcile" check | Buy and sell. The numbers match the quote and the balances always add up. |
| 6 | **Stock page.** Header, chart with 1D to All ranges and markers, stat tiles, trade panel, trade feed card, your position, and the Overview/Socials/Metrics/Markets/Holders tabs | Matches page 2 of the design |
| 7 | **Feed.** Text, photo and video posts, bull/bear tag, price at post, reactions, comments, the subject can hide or report posts, report and hide on trade notes | Post on someone's page, react and comment |
| 8 | **Metrics.** Vibe votes (one change per 24 h), superlative polls, hangouts and check-ins, feed activity, streaks with photo proof, smoothed 0–100 scoring, weights with a group vote to change them, Metrics tab | Vote, and watch the fundamentals score update right away |
| 9 | **Treasury.** 15-minute batch run, score-driven trades, 10%/day and 5%/event caps, treasury ledger, chart markers, dividend payout path | Change votes and see a capped treasury trade and a marker appear on the chart |
| 10 | **Realtime.** Live prices, trade feed, news and notifications with no page refresh | Two phones side by side, and a trade on one shows on the other |
| 11 | **Socials.** Profile links for every platform, and post embeds for Instagram, TikTok, X, Threads and YouTube | Add links and embeds, and they appear on the Socials tab and in the embed widget |
| 12 | **Portfolio, watchlist, homepage.** Portfolio P&L, watchlist with alerts, search, notifications, the widget grid (add, remove, resize, reorder, saved per user) with Portfolio, Gainers, Losers, News, Baskets, Watchlist, Trade feed and Social embed | Matches page 1 of the design. Your layout survives a refresh. |
| 13 | **Hardening.** Security review, rate limits, admin tools (reset a user, adjust cash, remove a post, pause trading), backups check, error monitoring, phone layout pass, full browser test run | Ready to invite the group |
| 14 | **Two-week beta.** Invite the group, watch the numbers, tune the curve constant k, the caps and the scoring | Phase 1 "done when": two weeks with no broken balances |

**How we'll work:** each milestone is developed on a branch and checked by CI. I send you the preview link and the checklist, you test it and report anything odd in plain English, I fix it, and we merge. The decisions log in `docs/` records every choice, so a future hired developer can pick it up.

---

## 5. Getting to commercial later (not built now, but not blocked)

- Separate groups are in the schema from day one (`groups`, `group_members`), so opening to other friend groups is mostly a UI change.
- The pricing engine is versioned, and trades record `engine_version`, so the history can be replayed if the math changes.
- Real money needs, in order: a securities/gambling lawyer, then the market structure they recommend (possibly a licensed partner, Kalshi-style), then KYC and a custodian. **We never hold user funds directly.**
- The native app is Expo, reusing `packages/pricing`, `packages/core` and `packages/shared`.
- In the play-money beta, avoid prizes that are worth money. Prizes can turn play money into regulated gambling or sweepstakes.

---

## 6. Open questions (defaults in brackets; I'll use the default unless told otherwise)

1. Starting play cash per person? [$10,000]
2. Treasury and dividends: is fix #1 above OK? [Yes]
3. Who can post on someone's feed? [Any group member who is a platform member. The subject can hide posts.]
4. First-cut metrics and weights? [Vibe vote, superlatives, hangout attendance, feed activity and streaks, equally weighted]
5. Are all beta members 18 or older? [Assumed yes. This matters for content and future legal structure.]
6. Name for the beta? [Peerstock, as in the designs]
7. Accounts you'll need to create when we reach milestone 0 (I'll walk you through each): **Supabase**, **Vercel** (sign in with GitHub) and optionally **Sentry**. All free.

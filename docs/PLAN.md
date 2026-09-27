# Peerstock: Build Plan (Private Beta → Commercial)

Working name: **Peerstock**. The name, colors and fonts live in one config file, so switching to Orra or Tessera later is a small change.

This plan is based on *Friend Market: Project Notes* (Sep 26, 2026) and the *Peerstock Dashboard and Stock Page* designs, plus these decisions:

| Decision | Answer |
| --- | --- |
| Platform | Web app first. It works on phones and can be installed to the home screen. Native iOS/Android apps come later. |
| Who builds | Claude writes and fixes the code. Craig directs and tests. |
| Budget | As cheap as possible: $0/month to start |
| Beta scope | All of Phase 1 before the group starts using it |
| Beta size | 5–20 people, all 18+, play money |
| Starting cash | **$100 play cash** per person in the demo. In the commercial version, users deposit real cash. |
| Business model | The platform earns a **commission on every trade** |
| Who posts on a page | **Only the subject** posts on their own page, and each post belongs to that person's stock. **Everyone** can see every post, both on the stock page and in the home News feed. Anyone who trades the stock can attach a note, and notes show in a separate Trade notes feed on the page. |
| Bullish/Bearish tag | Every post shows a Bullish/Bearish tag decided by **other members' votes**. The poster can't vote on their own posts. |
| Trading fee | Varies with trade size and goes **100% to the platform**. The subject gets no share. The admin can **turn fees on and off** during the beta. |
| Metrics | All five fun metrics at launch: vibe vote, superlatives, hangout attendance, feed activity and streaks, weighted equally |

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

**Not changing:** the bonding curve, treasury-with-caps design, off-chain tokens, trades stored as immutable events with an engine version, and the Phase 2–4 roadmap.

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

9. **$100 of play cash changes the scale.** The designs show prices around $40 and trade buttons for $10/$50/$100/$250, which assume much larger balances.
   **Default:** set the curve constant k so typical listing prices land around $1–$5 and a $10 buy visibly moves the price. Change the quick-amount buttons to $1/$5/$10/$25. Tune k during the two-week test.
10. **Only the subject posts on their page**, so the design's "Post an update about Jake" box is shown only to Jake. Other people's opinions go in trade notes. The home News feed shows every member's posts to everyone, each labeled with its stock.
    Members can still react and comment on posts. The subject can report trade notes on their page, and an admin can hide them. The "Feed activity" metric counts the subject's posts plus the reactions and comments those posts get.

11. **Sliding trading fee.** The fee is a percentage that depends on trade size and goes to a platform account.
    **Default:** smaller trades pay a higher rate. Under $5 pays 3%, $5–$25 pays 2%, and over $25 pays 1%. The admin can edit the tiers and turn fees on and off from the admin page. Each trade stores the rate it paid, so history stays accurate when the tiers change. While fees are off, trades cost 0%.
12. **Bullish/Bearish voting on posts.** Every member except the poster can vote Bullish or Bearish on a post, one vote each, changeable. The post shows the vote split, e.g. "Bullish 7 · 2", and its tag reflects the majority. The tag reads "No votes yet" until someone votes. The poster sees the results but gets no vote buttons.
    **Sentiment ratio per stock:** votes on all of a person's posts are combined into one number: **Bullish votes ÷ Bearish votes, rounded to 1 decimal place**, e.g. "3.5" (7 Bullish, 2 Bearish). Above 1.0 means more Bullish votes, and below 1.0 means more Bearish votes. The user picks the timeframe: 1D, 1W, 1M or All, like the other timeframe controls. A vote counts in the timeframe when it was cast or last changed. Dividing by zero isn't possible, so with Bullish votes but no Bearish votes it shows "All bullish", and with no votes at all it shows "No votes". Bearish votes with no Bullish votes show 0.0. The ratio appears as a stat tile on the stock page with its own timeframe switch, and on Watchlist rows and News items.
    **Default:** in the beta the votes are display-only and don't feed the fundamentals score. This can be added later as a metric.

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
| 1 | **Pricing package.** Curve, sliding fee tiers with an on/off switch, fixed-point math, treasury sizing, daily and per-event caps, with heavy tests including the reserve-invariant check | A readable test report, plus a small "curve playground" page to try trade sizes |
| 2 | **Database.** Full Phase 1 schema, row-level security, migrations, a seed script with Jake, Dani, Noah and the others, and past trades | The seeded data appears in the app |
| 3 | **Accounts and group.** Sign-in (magic link / Google), profile and avatar, invite-only group through an invite link, starting play cash, admin role | You invite a test account and it joins the group |
| 4 | **Listing.** Opt-in consent, ticker choice, starting price from the initial score (offset v), treasury seed position, delist and relist | A friend opts in, gets $TICKER and appears as a stock |
| 5 | **Trading.** Live quote, buy/sell with optional 140-character note, locked transactions, trades and price ticks, platform fee account, cash ledger, admin fee on/off switch and tier editor, admin "balances reconcile" check | Buy and sell. The numbers match the quote and the balances always add up. |
| 6 | **Stock page.** Header, chart with 1D to All ranges and markers, stat tiles (including the Bullish:Bearish sentiment ratio with a timeframe switch), trade panel, trade feed card, your position, and the Overview/Socials/Metrics/Markets/Holders tabs | Matches page 2 of the design |
| 7 | **Feed and trade notes.** Subject-only text, photo and video posts with price at post, visible to everyone in the News feed. Members vote Bullish/Bearish on others' posts (not their own), react and comment. There is also a separate Trade notes feed on each stock page. Trade notes can be reported; admins can hide them. | Post on your own page. Others see it in News, vote Bullish/Bearish, react, comment and leave trade notes. |
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

## 6. Open questions

Answered Sep 27, 2026: $100 starting play cash, the treasury fix, subject-only posting that everyone can see, trade notes, all five metrics, everyone 18+, and the name Peerstock for now. The trading fee varies with trade size, goes only to the platform, and the admin can turn it on and off. Posts carry a Bullish/Bearish tag that other members vote on. The votes are combined into a sentiment ratio per stock over a timeframe the user chooses.

Still open (defaults in brackets):

1. Fee tiers. [Under $5: 3%, $5–$25: 2%, over $25: 1%; editable by the admin]
2. Should post sentiment votes feed the fundamentals score? [Not in the beta; revisit after the two-week test]
3. Accounts you'll need to create when we reach milestone 0 (I'll walk you through each): **Supabase**, **Vercel** (sign in with GitHub) and optionally **Sentry**. All free.

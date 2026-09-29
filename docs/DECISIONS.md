# Decisions log

Short record of choices made while building, so anyone picking up the code knows why.

## Milestone 0: Foundation (Sep 29, 2026)

- Hosting: Vercel project `peerstock` (root directory `apps/web`), live at peerstock.vercel.app.
- Supabase settings are the Vercel environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They must be set as type **Config** (not Secret), because `NEXT_PUBLIC_` values are sent to the browser by design. Server-only secrets added later must NOT use the `NEXT_PUBLIC_` prefix.

## Milestone 1: Pricing engine (Sep 29, 2026)

- Exact integer math: cash in whole cents, tokens in micro-tokens (1e-6), prices in micro-dollars. Buyers' costs round up and sellers' proceeds round down, so the reserve can never be short. A randomized test checks this after thousands of trade sequences.
- Curve constant k = 20,000. A $2 stock moves about +5% on a $10 buy, +12% on $25 and +45% on $100.
- Listing price is $1 at a fundamentals score of 0 up to $5 at 100 (linear).
- At listing, the treasury buys a seed of 10% of the offset v, so it has tokens to sell when a score drops. v is chosen so the price *after* the seed buy equals the listing price.
- The fee is taken out of the amount entered (buys) or out of the proceeds (sells). Tiers: under $5 pays 3%, $5.00-$25.00 pays 2%, over $25 pays 1%. Rounded to the nearest cent. With fees off, the fee is 0.
- Treasury trades pay no fee.
- Treasury caps: 0.2% per score point; events move sentiment x 5% (min 3 votes); max 5% per event; max 10% per stock per day in total (sum of absolute moves).
- Dividends are split pro rata by holdings, with exact rounding (largest remainder), so the pieces always add up to the total.
- Every trade will store the engine version `curve-v1`.

## Milestone 2: Database (Sep 29, 2026)

- Schema lives in `packages/db/src/schema.ts` (Drizzle ORM). Migrations are generated into `packages/db/migrations` with `pnpm --filter @peerstock/db generate`. The generated init migration must not create `auth.users`, because Supabase owns it.
- Row-level security is on for every table, with no policies. The browser's public key can't touch data; the server connects with `DATABASE_URL` and acts for users. A test fails if any table lacks RLS, so new tables need `ENABLE ROW LEVEL SECURITY` in their migration.
- Cash lives on `profiles.cash_cents` (a user-level wallet, which suits real deposits later). Every change is also written to `ledger_entries`. Platform fee income and treasury-issued play money are ledger accounts too.
- Supabase login accounts link to `profiles.auth_user_id`. Demo people have no login and are flagged `is_demo`.
- `reconcile()` checks that cash matches the ledger, supply and reserve match the trade history, and holdings plus treasury equal supply.
- The GitHub workflow "Database" runs migrations and then the idempotent demo seed on pushes to `main` or `claude/**` that touch `packages/db`. It uses the repository secret `DATABASE_URL`.
- The demo group "Demo friends" (10 people from the designs, 30 days of simulated trading) is for testing only. Remove it before inviting the real group with `pnpm --filter @peerstock/db seed --remove`.
- `DATABASE_URL` is Supabase's transaction pooler string (port 6543). Prepared statements are off, as the pooler requires.

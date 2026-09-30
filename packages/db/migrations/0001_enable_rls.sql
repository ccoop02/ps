-- Lock every app table down: row-level security on, no policies.
-- The browser's public key can't read or write anything directly;
-- the app's server does all reads and writes on users' behalf.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
INSERT INTO platform_settings (id, fees_enabled, fee_tiers, trading_paused, starting_cash_cents)
VALUES (
  1,
  true,
  '[{"minCents":0,"bps":300},{"minCents":500,"bps":200},{"minCents":2501,"bps":100}]'::jsonb,
  false,
  10000
)
ON CONFLICT (id) DO NOTHING;

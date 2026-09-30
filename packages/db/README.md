# @peerstock/db

Database schema (Drizzle ORM), migrations, demo seed and the balance reconcile check.

| Command | What it does |
| --- | --- |
| `pnpm --filter @peerstock/db generate` | Create a migration from changes to `src/schema.ts` |
| `pnpm --filter @peerstock/db migrate` | Apply migrations (needs `DATABASE_URL`) |
| `pnpm --filter @peerstock/db seed` | Add the demo group if missing |
| `pnpm --filter @peerstock/db seed --reset` | Rebuild the demo group |
| `pnpm --filter @peerstock/db seed --remove` | Delete all demo data (do this before inviting the real group) |
| `pnpm --filter @peerstock/db test` | Integration tests; needs `TEST_DATABASE_URL` pointing at a database they may wipe |

Supabase is migrated and seeded automatically by the GitHub workflow "Database" on pushes to `main` or `claude/**` that change this folder.

New tables must enable row-level security in their migration; a test fails otherwise.

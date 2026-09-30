/**
 * Integration tests against a real Postgres. Set TEST_DATABASE_URL to a
 * database the tests may wipe; they're skipped otherwise.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { reserveCoversSupply } from "@peerstock/pricing";
import { createDb, reconcile, removeDemo, schema, seedDemo } from "./index";

const url = process.env.TEST_DATABASE_URL;
// These tests wipe the database, so never point them at Supabase.
if (url?.includes("supabase")) throw new Error("TEST_DATABASE_URL must not be a Supabase database");
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

describe.skipIf(!url)("database", () => {
  const { db, client } = createDb(url ?? "postgres://unused", { max: 1 });

  beforeAll(async () => {
    await client.unsafe(`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
    await client.unsafe(readFileSync(here("../scripts/local-bootstrap.sql"), "utf8"));
    await migrate(db, { migrationsFolder: here("../migrations") });
  });

  afterAll(async () => {
    await client.end();
  });

  it("locks every table with row-level security", async () => {
    const rows = await db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it("stores the default fee settings", async () => {
    const [settings] = await db.select().from(schema.platformSettings);
    expect(settings?.feesEnabled).toBe(true);
    expect(settings?.startingCashCents).toBe(10_000n);
    expect(settings?.feeTiers).toEqual([
      { minCents: 0, bps: 300 },
      { minCents: 500, bps: 200 },
      { minCents: 2501, bps: 100 },
    ]);
  });

  it("seeds demo data once, and everything reconciles", async () => {
    expect(await seedDemo(db, () => {})).toBe(true);
    expect(await seedDemo(db, () => {})).toBe(false);
    expect(await reconcile(db)).toEqual([]);

    const tokens = await db.select().from(schema.tokens);
    expect(tokens).toHaveLength(10);
    for (const t of tokens) {
      expect(
        reserveCoversSupply({ supplyMicro: t.supplyMicro, reserveCents: t.reserveCents, offsetMicro: t.offsetMicro, k: t.curveK }),
      ).toBe(true);
    }
  });

  it("reconcile catches a balance that doesn't match history", async () => {
    await db.execute(sql`update profiles set cash_cents = cash_cents + 1 where id = (select id from profiles limit 1)`);
    const problems = await reconcile(db);
    expect(problems.map((p) => p.check)).toContain("cash");
    await db.execute(sql`update profiles set cash_cents = cash_cents - 1 where id = (select id from profiles limit 1)`);
  });

  it("removes all demo data", async () => {
    await removeDemo(db);
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from profiles`);
    expect(row?.n).toBe(0);
    const [trades] = await db.execute<{ n: number }>(sql`select count(*)::int as n from trades`);
    expect(trades?.n).toBe(0);
  });

  it("rejects negative cash", async () => {
    await expect(db.execute(sql`insert into profiles (display_name, cash_cents) values ('x', -1)`)).rejects.toThrow();
  });
});

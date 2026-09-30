import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };
export { sql } from "drizzle-orm";
export * from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Connects to Postgres. Uses Supabase's connection pooler in production,
 * which doesn't support prepared statements, so they're switched off.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { prepare: false, max: options.max ?? 5 });
  return { db: drizzle(client, { schema }), client };
}

export { reconcile, type ReconcileProblem } from "./reconcile";
export { removeDemo, seedDemo } from "./seed";

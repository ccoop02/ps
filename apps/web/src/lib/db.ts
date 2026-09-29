import "server-only";
import { createDb, type Db } from "@peerstock/db";

// One connection pool per server instance, reused across requests.
const globalForDb = globalThis as unknown as { peerstockDb?: Db };

/** The database, or null when DATABASE_URL isn't configured yet. */
export function getDb(): Db | null {
  if (globalForDb.peerstockDb) return globalForDb.peerstockDb;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  globalForDb.peerstockDb = createDb(url, { max: 3 }).db;
  return globalForDb.peerstockDb;
}

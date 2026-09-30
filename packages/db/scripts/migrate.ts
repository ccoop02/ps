import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { requireDatabaseUrl } from "./env";

const client = postgres(requireDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  console.log("Migrations applied.");
} finally {
  await client.end();
}

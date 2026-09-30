/**
 *   pnpm seed            create demo data if missing (safe to repeat)
 *   pnpm seed --reset    delete demo data and create it again
 *   pnpm seed --remove   delete demo data
 */
import { createDb, removeDemo, seedDemo } from "../src/index";
import { requireDatabaseUrl } from "./env";

const { db, client } = createDb(requireDatabaseUrl(), { max: 1 });
const args = new Set(process.argv.slice(2));

try {
  if (args.has("--remove") || args.has("--reset")) {
    await removeDemo(db);
    console.log("Demo data removed.");
  }
  if (!args.has("--remove")) {
    const created = await seedDemo(db);
    if (!created) console.log("Demo data already present; nothing to do.");
  }
} finally {
  await client.end();
}

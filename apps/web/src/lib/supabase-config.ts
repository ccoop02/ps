/**
 * Supabase settings come from environment variables set in Vercel
 * (and in apps/web/.env.local for local development).
 */
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

export type ConnectionStatus =
  | { state: "not-configured" }
  | { state: "connected" }
  | { state: "error"; detail: string };

/** Pings Supabase's auth health endpoint to confirm the URL and key work. */
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  const config = getSupabaseConfig();
  if (!config) return { state: "not-configured" };
  try {
    const res = await fetch(`${config.url}/auth/v1/health`, {
      headers: { apikey: config.key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return { state: "connected" };
    return { state: "error", detail: `Supabase answered ${res.status}` };
  } catch (err) {
    return {
      state: "error",
      detail: err instanceof Error ? err.message : "Could not reach Supabase",
    };
  }
}

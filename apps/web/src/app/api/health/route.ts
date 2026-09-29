import { checkSupabaseConnection } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await checkSupabaseConnection();
  return Response.json({ app: "ok", supabase });
}

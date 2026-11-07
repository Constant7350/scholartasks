import { createClient } from "@supabase/supabase-js";

// Weekly (Vercel Cron, "Authorization: Bearer $CRON_SECRET"): deletes sign-in records older than
// 90 days (sharing guard). The team's counts are on /admin/families; nothing happens to accounts.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "not configured" }, { status: 503 });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("prune_signin_seen");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, deleted: data });
}

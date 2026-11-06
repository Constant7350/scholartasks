import { createClient } from "@supabase/supabase-js";
import { mondayOf } from "../../../admin/marketing/social";
import { writeAndSave } from "../../../admin/marketing/social-writer";

// Weekly social media drafts: Vercel Cron calls this every Monday morning (see
// vercel.json) with "Authorization: Bearer $CRON_SECRET". It writes this week's
// short-video scripts and written posts as drafts on /admin/marketing, unless the
// team turned the weekly writer off or this week already has AI drafts.
// Nothing is posted by itself. About 5 to 10 cents a week.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!apiKey || !url || !key) return Response.json({ error: "not configured" }, { status: 503 });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: set, error } = await sb.from("social_settings").select("auto_weekly").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (set && !set.auto_weekly) return Response.json({ skipped: "turned off" });
  const weekOf = mondayOf(new Date());
  const { count } = await sb.from("social_items").select("id", { count: "exact", head: true }).eq("week_of", weekOf).eq("ai_written", true);
  if ((count ?? 0) > 0) return Response.json({ skipped: "already written", weekOf });
  try {
    const r = await writeAndSave(sb, apiKey, weekOf);
    return Response.json({ weekOf, ...r });
  } catch (e) {
    console.error("weekly social writer failed", e);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}

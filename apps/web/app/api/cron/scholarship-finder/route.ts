import { createClient } from "@supabase/supabase-js";
import { findScholarships, saveFound, topicsForWeek } from "../../../../lib/scholarship-finder";

// Weekly finder: Vercel Cron calls this every Tuesday (see vercel.json) with
// "Authorization: Bearer $CRON_SECRET". It runs three topics a week, cycling
// through the whole list (about every 14 weeks), and saves new awards as
// 'found'. Families don't see them until the Monday/Thursday checker confirms
// each one on its official page. Cost: about 2 to 5 cents per topic with Haiku.
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
  const { data: names } = await sb.from("scholarships").select("name");
  const skip = ((names as { name: string }[]) ?? []).map((n) => n.name);
  const today = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(topicsForWeek(new Date()).map(async (t) => {
    try {
      const r = await findScholarships(apiKey, t, skip, today);
      const s = await saveFound(sb, r.awards, `Weekly finder: ${t.label}`);
      return { topic: t.id, added: s.added, error: s.error };
    } catch (e) {
      console.error("finder topic failed", t.id, e);
      return { topic: t.id, added: 0, error: "failed" };
    }
  }));
  return Response.json({ results });
}

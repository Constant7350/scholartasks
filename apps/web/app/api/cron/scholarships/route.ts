import { createClient } from "@supabase/supabase-js";
import { checkScholarship, type CheckRecord } from "../../../../lib/scholarship-check";

// Daily auto-check: Vercel Cron calls this once a day (see vercel.json) with
// "Authorization: Bearer $CRON_SECRET". It checks the scholarships that were
// checked longest ago against their official sites. Anything that changed is
// saved as a proposed update for the team to accept on /admin/scholarships;
// nothing families see changes until a person approves it.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_RUN = 10; // about 300 checks a month (roughly $2): every award is re-checked every few weeks

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!apiKey || !url || !key) return Response.json({ error: "not configured" }, { status: 503 });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Skip any award that already has a proposed update waiting for review.
  const { data: waiting } = await sb.from("scholarship_updates").select("scholarship_id").eq("status", "pending");
  const skip = new Set(((waiting as { scholarship_id: string }[]) ?? []).map((w) => w.scholarship_id));
  const { data } = await sb.from("scholarships").select("*").neq("status", "retired")
    .order("last_checked", { ascending: true, nullsFirst: true }).limit(PER_RUN + skip.size);
  const due = ((data as CheckRecord[]) ?? []).filter((r) => !skip.has(r.id)).slice(0, PER_RUN);

  const today = new Date().toISOString().slice(0, 10);
  // Run the checks side by side so the whole job finishes well within the time limit.
  const done = await Promise.all(due.map(async (rec) => {
    try {
      const r = await checkScholarship(apiKey, rec, today);
      const proposed = { ...r.changes, ...(r.still_offered === "no" ? { status: "retired" } : {}) };
      if (Object.keys(proposed).length || r.still_offered === "unclear") {
        await sb.from("scholarship_updates").insert({
          scholarship_id: rec.id, proposed, sources: r.sources, created_by: null,
          summary: `Daily check: ${r.still_offered === "no" ? "No longer offered. " : r.still_offered === "unclear" ? "Couldn't confirm it's still offered. " : ""}${r.summary}`,
        });
      }
      await sb.from("scholarships").update({ last_checked: today }).eq("id", rec.id);
      return { name: rec.name, changed: Object.keys(proposed).length > 0 };
    } catch (e) {
      return { name: rec.name, changed: false, error: e instanceof Error ? e.message : "failed" };
    }
  }));
  return Response.json({ checked: done });
}

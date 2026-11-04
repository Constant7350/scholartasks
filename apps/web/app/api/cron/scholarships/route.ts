import { createClient } from "@supabase/supabase-js";
import { checkScholarship, type CheckRecord } from "../../../../lib/scholarship-check";

// Weekly auto-check: Vercel Cron calls this every Monday and Thursday (see
// vercel.json) with "Authorization: Bearer $CRON_SECRET". It runs every Monday,
// and also on Thursdays in the busy aid season (September to March, when the
// FAFSA opens and most deadlines fall). It checks the scholarships that were
// checked longest ago against their official sites. Anything that changed is
// saved as a proposed update for the team to accept on /admin/scholarships;
// nothing families see changes until a person approves it.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_RUN = 25;  // about half a cent each with Haiku: 25 checks cost roughly 15 cents
const BATCH = 5;     // checks running at the same time
const BUSY_MONTHS = [8, 9, 10, 11, 0, 1, 2]; // September to March (0 = January)

/** Monday always; Thursday too in the busy season. Off-season that's ~100 checks a month, busy ~200. */
function shouldRun(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 1 || (day === 4 && BUSY_MONTHS.includes(d.getUTCMonth()));
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!apiKey || !url || !key) return Response.json({ error: "not configured" }, { status: 503 });
  const now = new Date();
  if (!shouldRun(now) && new URL(req.url).searchParams.get("force") !== "1") return Response.json({ skipped: "not a check day" });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Skip any award that already has a proposed update waiting for review.
  const { data: waiting } = await sb.from("scholarship_updates").select("scholarship_id").eq("status", "pending");
  const skip = new Set(((waiting as { scholarship_id: string }[]) ?? []).map((w) => w.scholarship_id));
  const { data } = await sb.from("scholarships").select("*").neq("status", "retired")
    .order("last_checked", { ascending: true, nullsFirst: true }).limit(PER_RUN + skip.size);
  const due = ((data as CheckRecord[]) ?? []).filter((r) => !skip.has(r.id)).slice(0, PER_RUN);

  const today = new Date().toISOString().slice(0, 10);
  // A few checks at a time, so the job finishes within the time limit without hitting rate limits.
  const checkOne = async (rec: CheckRecord) => {
    try {
      const r = await checkScholarship(apiKey, rec, today);
      const proposed = { ...r.changes, ...(r.still_offered === "no" ? { status: "retired" } : {}) };
      if (Object.keys(proposed).length || r.still_offered === "unclear") {
        await sb.from("scholarship_updates").insert({
          scholarship_id: rec.id, proposed, sources: r.sources, created_by: null,
          summary: `Weekly check: ${r.still_offered === "no" ? "No longer offered. " : r.still_offered === "unclear" ? "Couldn't confirm it's still offered. " : ""}${r.summary}`,
        });
      }
      await sb.from("scholarships").update({ last_checked: today }).eq("id", rec.id);
      return { name: rec.name, changed: Object.keys(proposed).length > 0 };
    } catch (e) {
      return { name: rec.name, changed: false, error: e instanceof Error ? e.message : "failed" };
    }
  };
  const done = [];
  for (let i = 0; i < due.length; i += BATCH) done.push(...(await Promise.all(due.slice(i, i + BATCH).map(checkOne))));
  return Response.json({ checked: done });
}

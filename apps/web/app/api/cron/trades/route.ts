import { createClient } from "@supabase/supabase-js";
import { checkableFacts } from "@scholartasks/core";
import { checkTradeFact } from "../../../../lib/trade-check";
import { TRADES_PACK } from "../../../../lib/trades";

// Monthly trades check: Vercel Cron calls this on the 1st to 5th of each
// month (see vercel.json) with "Authorization: Bearer $CRON_SECRET". Each run
// checks the facts checked longest ago (aid programs and Georgia license
// rules) against their official sites, so the whole list is covered every
// month. Anything that looks changed waits on /admin/trades for a person;
// nothing families see changes on its own.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_RUN = 15; // about half a cent each with Haiku
const BATCH = 5;

interface Row { subject: string; checked_on: string | null; status: string }

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!apiKey || !url || !key) return Response.json({ error: "not configured" }, { status: 503 });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await sb.from("trade_checks").select("subject, checked_on, status");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = new Map(((data as Row[]) ?? []).map((r) => [r.subject, r]));
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  // Not yet checked this month, and not already waiting for a person. Never-checked first.
  const due = checkableFacts(TRADES_PACK)
    .filter((f) => { const r = rows.get(f.subject); return !r || (r.status !== "review" && (r.checked_on ?? "") < monthStart); })
    .sort((a, b) => (rows.get(a.subject)?.checked_on ?? "").localeCompare(rows.get(b.subject)?.checked_on ?? ""))
    .slice(0, PER_RUN);

  const checkOne = async (f: (typeof due)[number]) => {
    try {
      const r = await checkTradeFact(apiKey, f, today);
      await sb.from("trade_checks").upsert({
        subject: f.subject, title: f.title, url: f.url, checked_on: today, result: r.result, summary: r.summary, sources: r.sources,
        status: r.result === "ok" ? "ok" : "review", reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString(),
      });
      return { subject: f.subject, result: r.result };
    } catch (e) {
      return { subject: f.subject, error: e instanceof Error ? e.message : "failed" };
    }
  };
  const done = [];
  for (let i = 0; i < due.length; i += BATCH) done.push(...(await Promise.all(due.slice(i, i + BATCH).map(checkOne))));
  return Response.json({ checked: done });
}

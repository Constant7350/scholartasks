import { createClient } from "@supabase/supabase-js";
import { autoVerified, checkScholarship, triage, type CheckRecord } from "../../../../lib/scholarship-check";

// "Check with AI" on the team's review page: checks one scholarship against
// its official site now. Confirmed with nothing changed: marked verified.
// Otherwise what it found is saved as a proposed update for a person.
// ScholarTasks team only (app_admins).
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The AI checker isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { id?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong."); }
  if (typeof body.id !== "string") return json(400, "Pick a scholarship.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = await sb.rpc("is_app_admin");
  if (admin.data !== true) return json(403, "This is for the ScholarTasks team.");
  const { data: rec } = await sb.from("scholarships").select("*").eq("id", body.id).maybeSingle();
  if (!rec) return json(404, "That scholarship wasn't found.");

  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await checkScholarship(apiKey, rec as CheckRecord, today);
    const t = triage(r);
    if (t.autoVerify) {
      // Confirmed on the official site with nothing new: verified, nothing to review.
      const { error } = await sb.from("scholarships").update((rec as { status: string }).status === "pending" ? autoVerified(today) : { last_checked: today }).eq("id", body.id);
      if (error) return json(500, "Couldn't save the result.");
      return Response.json({ verified: true, summary: r.summary });
    }
    const { data: up, error } = await sb.from("scholarship_updates")
      .insert({ scholarship_id: body.id, summary: t.summary, proposed: t.proposed, sources: r.sources })
      .select("id, scholarship_id, summary, proposed, sources, status, created_at").single();
    if (error) return json(500, "Couldn't save the result.");
    await sb.from("scholarships").update({ last_checked: today }).eq("id", body.id);
    return Response.json({ update: up });
  } catch (e) {
    console.error("scholarship check failed", e);
    return json(502, "The AI checker couldn't finish. Try again in a minute.");
  }
}

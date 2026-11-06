import { createClient } from "@supabase/supabase-js";
import type { Draft } from "../../../admin/marketing/social-writer";
import { rewriteOne } from "../../../admin/marketing/social-writer";

// "Ask for a change" on one social media draft: the AI rewrites it the way the
// team asked, and the draft goes back to "Draft" so a person checks it again.
// ScholarTasks team only (app_admins).
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The AI writer isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { id?: unknown; ask?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong."); }
  const ask = typeof body.ask === "string" ? body.ask.trim().slice(0, 600) : "";
  if (typeof body.id !== "string" || !ask) return json(400, "Say what to change.");
  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = await sb.rpc("is_app_admin");
  if (admin.data !== true) return json(403, "This is for the ScholarTasks team.");
  const [{ data: item }, { data: set }] = await Promise.all([
    sb.from("social_items").select("kind, network, week_of, topic, title, hook, body, caption, hashtags, shot_notes").eq("id", body.id).maybeSingle(),
    sb.from("social_settings").select("host_note").maybeSingle(),
  ]);
  if (!item) return json(404, "That draft is gone.");
  try {
    const d = await rewriteOne(apiKey, { ...(item as Omit<Draft, "ai_written">), ai_written: true }, ask, set?.host_note ?? "A high school student.");
    if (!d) return json(502, "The AI writer couldn't finish. Try again in a minute.");
    const { week_of: _w, network: _n, kind: _k, ...fields } = d;
    const { data, error } = await sb.from("social_items").update({ ...fields, status: "draft" }).eq("id", body.id).select("*").single();
    if (error) return json(500, "Couldn't save the new draft.");
    return Response.json({ item: data });
  } catch (e) {
    console.error("social rewrite failed", e);
    return json(502, "The AI writer couldn't finish. Try again in a minute.");
  }
}

import { createClient } from "@supabase/supabase-js";
import { mondayOf } from "../../../admin/marketing/social";
import { writeAndSave } from "../../../admin/marketing/social-writer";

// "Write this week's" on the Social media tab of /admin/marketing: the AI writes
// short-video scripts and written posts as drafts for the team to check.
// Nothing is posted by itself. ScholarTasks team only (app_admins).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The AI writer isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { week?: unknown; focus?: unknown; only?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong."); }
  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = await sb.rpc("is_app_admin");
  if (admin.data !== true) return json(403, "This is for the ScholarTasks team.");
  const { data: who } = await sb.auth.getUser(token);
  const weekOf = mondayOf(new Date(), body.week === "next" ? 1 : 0);
  const focus = typeof body.focus === "string" ? body.focus.slice(0, 600) : null;
  const only = body.only === "videos" || body.only === "posts" ? body.only : undefined;
  try {
    const r = await writeAndSave(sb, apiKey, weekOf, { focus, userId: who.user?.id ?? null, only });
    if (r.error) return json(502, r.error);
    return Response.json({ added: r.added, weekOf });
  } catch (e) {
    console.error("social writer failed", e);
    return json(502, "The AI writer couldn't finish. Try again in a minute.");
  }
}

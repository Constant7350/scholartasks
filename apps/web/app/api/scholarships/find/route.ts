import { createClient } from "@supabase/supabase-js";
import { FINDER_TOPICS, findScholarships, saveFound } from "../../../../lib/scholarship-finder";

// "Find new awards" on the team's review page: runs the AI finder on one topic
// (or one page address) and saves what it finds as 'found', hidden from families
// until the checker confirms each one on its official page.
// ScholarTasks team only (app_admins).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The AI finder isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { topic?: unknown; url?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong."); }
  const topic = FINDER_TOPICS.find((t) => t.id === body.topic);
  const page = typeof body.url === "string" && /^https:\/\/[^\s]{4,490}$/.test(body.url.trim()) ? body.url.trim() : null;
  if (!topic && !page) return json(400, "Pick a topic or paste a page address that starts with https://");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = await sb.rpc("is_app_admin");
  if (admin.data !== true) return json(403, "This is for the ScholarTasks team.");
  const { data: names } = await sb.from("scholarships").select("name");
  const skip = ((names as { name: string }[]) ?? []).map((n) => n.name);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const source = topic ?? { label: page!, url: page! };
    const r = await findScholarships(apiKey, source, skip, today);
    const saved = await saveFound(sb, r.awards, topic ? `Finder: ${topic.label}` : `Finder: ${page}`);
    if (saved.error) return json(500, "Couldn't save what it found.");
    return Response.json({ added: saved.added, found: r.awards.length, note: r.note });
  } catch (e) {
    console.error("scholarship finder failed", e);
    return json(502, "The AI finder couldn't finish. Try again in a minute.");
  }
}

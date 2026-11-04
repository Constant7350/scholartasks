import { createClient } from "@supabase/supabase-js";
const SUPPORT_EMAIL = "support@scholartasks.com";

export const runtime = "nodejs";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Someone reported an AI answer: save it (as them) and email the team. */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return json(503, { error: "Not set up yet." });
  if (!token) return json(401, { error: "Please sign in again." });
  const body = (await req.json().catch(() => null)) as { feature?: unknown; answer?: unknown; note?: unknown } | null;
  const feature = typeof body?.feature === "string" ? body.feature.slice(0, 40) : "";
  const answer = typeof body?.answer === "string" ? body.answer.slice(0, 8000) : "";
  const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : "";
  if (!feature || (!answer && !note)) return json(400, { error: "Nothing to report." });

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return json(401, { error: "Please sign in again." });
  const { error } = await sb.from("ai_reports").insert({ feature, answer: answer || null, note: note || null });
  if (error) return json(500, { error: "Couldn't save the report." });

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ScholarTasks <noreply@scholartasks.com>",
        to: [SUPPORT_EMAIL],
        subject: `AI answer reported (${feature})`,
        html: `<p>Someone reported an AI answer in <b>${esc(feature)}</b>.</p><p><b>Their note:</b> ${esc(note || "(none)")}</p><p><b>The answer:</b></p><pre style="white-space:pre-wrap">${esc(answer || "(not included)")}</pre><p>Saved in the ai_reports table.</p>`,
      }),
    }).catch(() => {});
  }
  return json(200, { ok: true });
}

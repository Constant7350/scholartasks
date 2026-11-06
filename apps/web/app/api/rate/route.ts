import { createClient } from "@supabase/supabase-js";
const SUPPORT_EMAIL = "support@scholartasks.com";

export const runtime = "nodejs";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Someone rated ScholarTasks: save it (as them) and, when they wrote a note, email it to the team. */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return json(503, { error: "Not set up yet." });
  if (!token) return json(401, { error: "Please sign in again." });
  const body = (await req.json().catch(() => null)) as { stars?: unknown; note?: unknown; platform?: unknown } | null;
  const stars = typeof body?.stars === "number" ? Math.round(body.stars) : 0;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const platform = body?.platform === "ios" || body?.platform === "android" ? body.platform : "web";
  if (stars < 1 || stars > 5) return json(400, { error: "Pick 1 to 5 stars." });

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return json(401, { error: "Please sign in again." });
  const { error } = await sb.rpc("rate_app", { p_stars: stars, p_note: note, p_platform: platform });
  if (error) return json(500, { error: "Couldn't save your rating." });

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && note) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ScholarTasks <noreply@scholartasks.com>",
        to: [SUPPORT_EMAIL],
        subject: `New rating: ${"★".repeat(stars)}${"☆".repeat(5 - stars)} (${platform})`,
        html: `<p>Someone rated ScholarTasks <b>${stars} of 5</b> on ${esc(platform)}.</p><p><b>Their note:</b></p><pre style="white-space:pre-wrap">${esc(note)}</pre><p>See every rating on <a href="https://scholartasks.com/admin/ratings">/admin/ratings</a>.</p>`,
      }),
    }).catch(() => {});
  }
  return json(200, { ok: true });
}

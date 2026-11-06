import { createClient } from "@supabase/supabase-js";
import { emailShell, esc, sendEmail } from "../../../../lib/openings";

export const runtime = "nodejs";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Our team approves, turns down or takes down a listing on /admin/openings.
 * Saved as the team member (the database checks they are on the team), then the company is emailed.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return json(503, { error: "Not set up yet." });
  if (!token) return json(401, { error: "Please sign in again." });
  const b = (await req.json().catch(() => null)) as { id?: unknown; action?: unknown; note?: unknown; verified?: unknown; email?: unknown } | null;
  const id = typeof b?.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null;
  const action = b?.action === "approve" || b?.action === "reject" || b?.action === "hide" ? b.action : null;
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 2000) : "";
  if (!id || !action) return json(400, { error: "Something went wrong. Please try again." });
  if (action === "reject" && note.length < 5) return json(400, { error: "Please write a short reason. The company gets it by email." });

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return json(401, { error: "Please sign in again." });
  const isAdmin = await sb.rpc("is_app_admin");
  if (isAdmin.data !== true) return json(403, { error: "This is for the ScholarTasks team." });

  const now = new Date().toISOString();
  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "hidden";
  const { data, error } = await sb.from("local_openings")
    .update({
      status, review_note: note || null, reviewed_by: u.user.id, reviewed_at: now,
      ...(action === "approve" ? { approved_at: now, reports: 0, registered_verified: b?.verified === true } : {}),
    })
    .eq("id", id).select("title, contact_name, contact_email, show_until").single();
  if (error || !data) return json(500, { error: "Couldn't save that. Please try again." });
  const o = data as { title: string; contact_name: string; contact_email: string; show_until: string };

  // Taking a listing down after reports doesn't email the company unless the team asks to.
  let emailed = false;
  if (action !== "hide" || b?.email === true) {
    const until = new Date(`${o.show_until}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const body = action === "approve"
      ? `<p>Hi ${esc(o.contact_name)},</p><p>Good news: <b>${esc(o.title)}</b> is now live for students on ScholarTasks, under Trades and Local openings. It shows until ${until}.</p>
         ${note ? `<p>A note from our review team: ${esc(note)}</p>` : ""}<p>To change it or take it down early, reply to this email.</p>
         <p><a href="https://scholartasks.com/trades/openings">See it on ScholarTasks</a></p>`
      : action === "reject"
        ? `<p>Hi ${esc(o.contact_name)},</p><p>Thanks for sending <b>${esc(o.title)}</b>. Our review team couldn't post it as it is.</p><p><b>Why:</b> ${esc(note)}</p>
           <p>You're welcome to fix it and <a href="https://scholartasks.com/trades/post">send it again</a>, or reply to this email with questions.</p>`
        : `<p>Hi ${esc(o.contact_name)},</p><p>We've taken <b>${esc(o.title)}</b> off ScholarTasks for now.</p>${note ? `<p><b>Why:</b> ${esc(note)}</p>` : ""}<p>Reply to this email if you have questions.</p>`;
    emailed = await sendEmail({
      to: o.contact_email,
      subject: action === "approve" ? `Your listing is live: ${o.title}` : action === "reject" ? `About your listing: ${o.title}` : `Your listing was taken down: ${o.title}`,
      html: emailShell(action === "approve" ? "Your listing is live" : action === "reject" ? "About your listing" : "Your listing was taken down", body),
    });
  }
  return json(200, { ok: true, emailed });
}

import { adminClient, json, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A counselor emails the families connected to their school (optionally only some grades).
 * The database checks the counselor is staff at an approved school, saves the message,
 * writes the audit log and returns the addresses. Each person gets their own email,
 * so nobody sees anyone else's address. Replies go to the counselor.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  const resendKey = process.env.RESEND_API_KEY;
  if (!admin || !resendKey) return json({ error: "School messages aren't switched on yet." }, 503);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);

  const b = (await req.json().catch(() => null)) as { school?: unknown; grades?: unknown; subject?: unknown; body?: unknown } | null;
  const school = typeof b?.school === "string" && /^[0-9a-f-]{36}$/i.test(b.school) ? b.school : null;
  const grades = Array.isArray(b?.grades) ? b.grades.filter((g): g is number => Number.isInteger(g) && g >= 6 && g <= 12) : [];
  const subject = typeof b?.subject === "string" ? b.subject.trim().slice(0, 150) : "";
  const body = typeof b?.body === "string" ? b.body.trim().slice(0, 3000) : "";
  if (!school || subject.length < 2 || body.length < 2) return json({ error: "Please add a subject and a message." }, 400);

  const { data, error } = await admin.rpc("school_message_recipients", {
    p_school: school, p_user: user.id, p_grades: grades, p_subject: subject, p_body: body,
  });
  if (error) {
    if (/school_message_recipients/.test(error.message) && /exist|schema cache/i.test(error.message)) {
      return json({ error: "Run database update 37 in Supabase first, then try again." }, 400);
    }
    return json({ error: error.message === "not allowed" ? "You don't have access to this school." : error.message }, 400);
  }
  const emails = ((data as { email: string }[] | null) ?? []).map((r) => r.email);
  const { data: sch } = await admin.from("schools").select("name").eq("id", school).single();
  const schoolName = (sch as { name: string } | null)?.name ?? "Your school";
  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2a3a">
    <p style="color:#5d6878;font-size:13px;margin:0 0 8px">A message from ${esc(schoolName)}</p>
    <h2 style="color:#14305a;margin:0 0 12px">${esc(subject)}</h2>
    <div style="white-space:pre-wrap;line-height:1.5">${esc(body)}</div>
    <p style="color:#5d6878;font-size:12px;margin-top:24px">You get this because your family connected to ${esc(schoolName)} in ScholarTasks.
    To stop, open <a href="${appUrl}/my-school">My school</a> and stop sharing.</p></div>`;

  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((to) => ({
      from: `${schoolName.replace(/[<>"]/g, "")} via ScholarTasks <noreply@scholartasks.com>`,
      to: [to], reply_to: user.email ? [user.email] : undefined, subject, html,
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
    else console.error("school message: email batch failed", res.status, await res.text().catch(() => ""));
  }
  if (emails.length && !sent) return json({ error: "The message was saved but the emails didn't go out. Please try again later." }, 502);
  return json({ ok: true, sent });
}

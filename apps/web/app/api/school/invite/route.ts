import { adminClient, json, userFromRequest } from "../../../../lib/passkeys";
import { mailingAddress, unsubscribeUrl } from "../../../../lib/unsubscribe";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Emails the school's join code to roster families who haven't connected yet.
 * The database checks the sender is staff at an approved school, picks the
 * addresses (each at most once a week) and logs it. One email per person.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  const resendKey = process.env.RESEND_API_KEY;
  if (!admin || !resendKey) return json({ error: "School invites aren't switched on yet." }, 503);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const b = (await req.json().catch(() => null)) as { school?: unknown; grades?: unknown } | null;
  const school = typeof b?.school === "string" && /^[0-9a-f-]{36}$/i.test(b.school) ? b.school : null;
  const grades = Array.isArray(b?.grades) ? b.grades.filter((g): g is number => Number.isInteger(g) && g >= 6 && g <= 12) : [];
  if (!school) return json({ error: "Something went wrong. Please try again." }, 400);

  const { data, error } = await admin.rpc("school_roster_invitees", { p_school: school, p_user: user.id, p_grades: grades });
  if (error) return json({ error: error.message === "not allowed" ? "You don't have access to this school." : /exist|schema cache/i.test(error.message) ? "Run database update 44 in Supabase first." : error.message }, 400);
  const emails = ((data as { email: string }[] | null) ?? []).map((r) => r.email);
  const { data: sch } = await admin.from("schools").select("name, join_code").eq("id", school).single();
  const s = sch as { name: string; join_code: string } | null;
  if (!s) return json({ error: "School not found." }, 404);
  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";
  const subject = `${s.name} invites your family to ScholarTasks`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2a3a">
    <h2 style="color:#14305a;margin:0 0 12px">${esc(s.name)} uses ScholarTasks</h2>
    <p style="line-height:1.5">Your school counselor invites your family to ScholarTasks, a free app that keeps college plans, scholarships, aid forms and deadlines in one place. Connecting lets your counselor see how your student is doing on deadlines, so they can help. You choose what to share and can stop any time.</p>
    <p style="font-size:18px">School code: <b style="letter-spacing:2px">${esc(s.join_code)}</b></p>
    <p><a href="${appUrl}/my-school?code=${encodeURIComponent(s.join_code)}" style="background:#14305a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Connect to ${esc(s.name)}</a></p>
    <p style="color:#5d6878;font-size:13px">¿Prefiere español? Abra el enlace y elija Español en el menú.</p>
    <p style="color:#5d6878;font-size:12px;margin-top:24px">You got this email because ${esc(s.name)} has your address on its class list. ScholarTasks never sells your information.</p>
    {{OPTOUT}}</div>`;
  const address = mailingAddress();
  const htmlFor = (to: string) => {
    const stop = unsubscribeUrl(appUrl, to);
    const optOut = stop
      ? `<a href="${esc(stop)}" style="color:#5d6878">Stop these invite emails</a>`
      : `To stop these invite emails, email <a href="mailto:support@scholartasks.com?subject=Stop%20school%20invites" style="color:#5d6878">support@scholartasks.com</a>`;
    return html.replace("{{OPTOUT}}", `<p style="color:#5d6878;font-size:12px">${optOut}.${address ? `<br>ScholarTasks · ${esc(address)}` : ""}</p>`);
  };

  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((to) => ({
      from: `${s.name.replace(/[<>"]/g, "")} via ScholarTasks <noreply@scholartasks.com>`,
      to: [to], reply_to: user.email ? [user.email] : undefined, subject, html: htmlFor(to),
      headers: (() => {
        const stop = unsubscribeUrl(appUrl, to);
        if (!stop) return undefined;
        const api = stop.replace("/unsubscribe?", "/api/unsubscribe?");
        return { "List-Unsubscribe": `<${api}>, <mailto:support@scholartasks.com?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
      })(),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
    else console.error("school invite: email batch failed", res.status, await res.text().catch(() => ""));
  }
  return json({ sent });
}

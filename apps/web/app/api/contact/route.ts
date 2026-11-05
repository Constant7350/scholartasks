import { checkContact } from "@scholartasks/core";

const SUPPORT_EMAIL = "support@scholartasks.com";

export const runtime = "nodejs";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

// Best-effort limit per visitor (each server copy keeps its own count): 5 messages per 10 minutes.
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 5;
}

/** Public contact form: emails the message to the team, with Reply going straight to the visitor. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) return json(429, { error: `That's a lot of messages in a short time. Please wait a few minutes, or email ${SUPPORT_EMAIL}.` });
  const check = checkContact(await req.json().catch(() => null));
  if (!check.ok) return check.spam ? json(200, { ok: true }) : json(400, { error: check.error });
  const m = check.msg;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return json(503, { error: `Our message form isn't connected yet. Please email ${SUPPORT_EMAIL}.` });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ScholarTasks website <noreply@scholartasks.com>",
      to: [SUPPORT_EMAIL],
      reply_to: m.email,
      subject: `Website message from ${m.name} (${m.topic})`,
      html:
        `<p><b>From:</b> ${esc(m.name)} &lt;${esc(m.email)}&gt;</p>` +
        `<p><b>About:</b> ${esc(m.topic)}${m.school ? ` · <b>School:</b> ${esc(m.school)}` : ""}</p>` +
        `<pre style="white-space:pre-wrap;font:inherit">${esc(m.message)}</pre>` +
        `<p style="color:#666">Sent from the contact form on scholartasks.com. Press Reply to answer ${esc(m.name)}.</p>`,
    }),
  }).catch(() => null);
  if (!res?.ok) return json(502, { error: `Sorry, that didn't go through. Please try again, or email ${SUPPORT_EMAIL}.` });
  return json(200, { ok: true });
}

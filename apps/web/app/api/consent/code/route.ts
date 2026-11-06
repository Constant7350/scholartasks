import { CODE_MINUTES, audit, clientIp, codeEmail, hashCode, newCode, sendEmail } from "../../../../lib/consent-server";
import { adminClient, json, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends a 6-digit signing code to the signed-in person's own email. One a minute at most. */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin || !process.env.RESEND_API_KEY) return json({ error: "Signing isn't switched on yet. Please try again later." }, 503);
  const user = await userFromRequest(admin, req);
  if (!user?.email) return json({ error: "Please sign in again." }, 401);
  const { data: last } = await admin.from("consent_codes").select("sent_at").eq("user_id", user.id).maybeSingle();
  if (last && Date.now() - new Date((last as { sent_at: string }).sent_at).getTime() < 60_000) {
    return json({ error: "We just sent a code. Check your email, or wait a minute to get a new one." }, 429);
  }
  const code = newCode();
  const now = new Date();
  const { error } = await admin.from("consent_codes").upsert({
    user_id: user.id, code_hash: hashCode(user.id, code), tries: 0, sent_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
  });
  if (error) return json({ error: "Something went wrong. Please try again." }, 500);
  if (!(await sendEmail(user.email, `Your ScholarTasks signing code: ${code}`, codeEmail(code)))) {
    return json({ error: "We couldn't send the email. Please try again in a minute." }, 502);
  }
  await audit(admin, user.id, "consent_code_sent", "identity", null, { ip: clientIp(req) });
  const [name, domain] = user.email.split("@");
  return json({ sentTo: `${name!.slice(0, 2)}…@${domain}` });
}

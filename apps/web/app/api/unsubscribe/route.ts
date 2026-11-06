import { adminClient } from "../../../lib/passkeys";
import { validUnsubscribe } from "../../../lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Stops school invite emails to one address. Takes e and t from the link
 * (query string, for the email's one-click List-Unsubscribe header) or a JSON body
 * (from the /unsubscribe page button). Never needs a sign-in.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  let e = q.get("e") ?? "", t = q.get("t") ?? "";
  if (!e || !t) {
    const b = (await req.json().catch(() => null)) as { e?: unknown; t?: unknown } | null;
    e = typeof b?.e === "string" ? b.e : "";
    t = typeof b?.t === "string" ? b.t : "";
  }
  const email = e.trim().toLowerCase();
  if (!email || email.length > 320 || !validUnsubscribe(email, t)) return json(400, { error: "This link isn't valid. Email support@scholartasks.com and we'll stop the emails." });
  const admin = adminClient();
  if (!admin) return json(503, { error: "Please email support@scholartasks.com and we'll stop the emails." });
  const { error } = await admin.from("email_opt_outs").upsert({ email, kind: "school_invites" }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return json(500, { error: "That didn't work. Please email support@scholartasks.com and we'll stop the emails." });
  return json(200, { ok: true });
}

import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { CODE_TRIES, KINDS, audit, clientIp, hashCode, receiptEmail, sendEmail, type ConsentKind } from "../../../../lib/consent-server";
import { adminClient, fromB64url, json, relyingParty, useChallenge, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

/**
 * Saves a signed consent after checking it's really the signed-in person right now:
 * Face ID / fingerprint on this device (passkey), or the 6-digit code from their email.
 * The database then only lets the consent through for that same person, once, within
 * 15 minutes, and refuses student accounts. An email receipt goes to the signer.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Signing isn't switched on yet. Please try again later." }, 503);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: "Something went wrong." }, 400);
  const kind = b.kind as ConsentKind;
  if (!KINDS.includes(kind)) return json({ error: "Something went wrong." }, 400);
  const wording = str(b.wording, 6000) ?? "";
  const name = (str(b.name, 120) ?? "").trim();
  const signature = str(b.signature, 300000) ?? "";
  const ip = clientIp(req);

  // 1. Is it really them?
  let method: "passkey" | "email_code";
  if (b.method === "passkey") {
    const rp = relyingParty(req);
    const p = b.passkey as { challengeId?: unknown; response?: { id?: unknown } } | undefined;
    const saved = rp ? await useChallenge(admin, p?.challengeId, "login") : null;
    const credId = p?.response?.id;
    if (!rp || !saved || typeof credId !== "string") return json({ error: "That took too long. Please try again." }, 400);
    const { data: pk } = await admin.from("passkeys").select("id, user_id, public_key, counter, transports").eq("id", credId).maybeSingle();
    const k = pk as { id: string; user_id: string; public_key: string; counter: number; transports: string[] } | null;
    if (!k || k.user_id !== user.id) {
      await audit(admin, user.id, "consent_identity_failed", kind, null, { method: "passkey", ip });
      return json({ error: "Face ID didn't match this account. Use the email code instead." }, 403);
    }
    try {
      const r = await verifyAuthenticationResponse({
        response: p!.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
        expectedChallenge: saved.challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true,
        credential: { id: k.id, publicKey: fromB64url(k.public_key), counter: Number(k.counter), transports: k.transports as AuthenticatorTransport[] },
      });
      if (!r.verified) throw new Error("no");
      await admin.from("passkeys").update({ counter: r.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", k.id);
    } catch {
      await audit(admin, user.id, "consent_identity_failed", kind, null, { method: "passkey", ip });
      return json({ error: "Face ID didn't match this account. Use the email code instead." }, 403);
    }
    method = "passkey";
  } else {
    const code = str(b.code, 12)?.replace(/\D/g, "") ?? "";
    const { data: row } = await admin.from("consent_codes").select("code_hash, expires_at, tries").eq("user_id", user.id).maybeSingle();
    const c = row as { code_hash: string; expires_at: string; tries: number } | null;
    if (!c || new Date(c.expires_at).getTime() < Date.now()) return json({ error: "That code has run out. Press \"Email me a code\" again." }, 400);
    if (c.tries >= CODE_TRIES) return json({ error: "Too many wrong codes. Press \"Email me a code\" to get a new one." }, 429);
    if (hashCode(user.id, code) !== c.code_hash) {
      await admin.from("consent_codes").update({ tries: c.tries + 1 }).eq("user_id", user.id);
      await audit(admin, user.id, "consent_identity_failed", kind, null, { method: "email_code", ip });
      return json({ error: "That code isn't right. Check the newest email from ScholarTasks." }, 403);
    }
    await admin.from("consent_codes").delete().eq("user_id", user.id);
    method = "email_code";
  }

  // 2. Save the signature (the database checks who may sign what and writes the audit log).
  const { data: id, error } = await admin.rpc("record_consent_signature", {
    p_user: user.id, p_kind: kind, p_target: str(b.target, 80), p_student: typeof b.student === "string" && b.student ? b.student : null,
    p_name: name, p_signature: signature, p_version: str(b.version, 40), p_wording: wording, p_method: method,
    p_ip: ip, p_agent: str(req.headers.get("user-agent"), 300),
  });
  if (error) return json({ error: error.message || "Something went wrong." }, 400);

  // 3. Receipt to the signer's own email, so a signature they didn't make is noticed.
  if (user.email) await sendEmail(user.email, "You signed a consent in ScholarTasks", receiptEmail(kind, name, wording, new Date()));
  return json({ id });
}

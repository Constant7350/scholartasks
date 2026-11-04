import { createClient } from "@supabase/supabase-js";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { adminClient, fromB64url, json, relyingParty, useChallenge } from "../../../../lib/passkeys";

export const runtime = "nodejs";

const NOPE = "Face ID didn't match a ScholarTasks account on this device. Sign in another way, then turn Face ID on again.";

/** Step 2: checks the device's signed answer, then starts a normal sign-in session. */
export async function POST(req: Request) {
  const admin = adminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!admin || !url || !key) return json({ error: "Face ID sign-in isn't switched on yet." }, 503);
  const rp = relyingParty(req);
  if (!rp) return json({ error: "Please open ScholarTasks at its usual web address and try again." }, 400);
  const body = await req.json().catch(() => null);
  const saved = await useChallenge(admin, body?.challengeId, "login");
  if (!saved) return json({ error: "That took too long. Please try again." }, 400);
  const credId = body?.response?.id;
  if (typeof credId !== "string") return json({ error: NOPE }, 400);

  const { data: pk } = await admin.from("passkeys").select("id, user_id, public_key, counter, transports").eq("id", credId).maybeSingle();
  if (!pk) return json({ error: NOPE }, 400);
  const p = pk as { id: string; user_id: string; public_key: string; counter: number; transports: string[] };

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
      credential: { id: p.id, publicKey: fromB64url(p.public_key), counter: Number(p.counter), transports: p.transports as AuthenticatorTransport[] },
    });
  } catch {
    return json({ error: NOPE }, 400);
  }
  if (!result.verified) return json({ error: NOPE }, 400);
  await admin.from("passkeys").update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", p.id);

  // Make a one-time sign-in token for this person (no email is sent) and trade it for a session.
  const { data: u } = await admin.auth.admin.getUserById(p.user_id);
  const email = u?.user?.email;
  if (!email) return json({ error: NOPE }, 400);
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return json({ error: "Couldn't sign you in. Please try again." }, 500);
  const pub = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: otpErr } = await pub.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (otpErr || !s.session) return json({ error: "Couldn't sign you in. Please try again." }, 500);
  return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
}

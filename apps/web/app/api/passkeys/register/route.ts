import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { adminClient, json, relyingParty, toB64url, useChallenge, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";

/** Step 2: checks what the phone or computer made and saves its public key. */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Face ID sign-in isn't switched on yet." }, 503);
  const rp = relyingParty(req);
  if (!rp) return json({ error: "Please open ScholarTasks at its usual web address and try again." }, 400);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const body = await req.json().catch(() => null);
  const saved = await useChallenge(admin, body?.challengeId, "register");
  if (!saved || saved.user_id !== user.id) return json({ error: "That took too long. Please try again." }, 400);

  let result;
  try {
    result = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });
  } catch {
    return json({ error: "Your device's answer couldn't be checked. Please try again." }, 400);
  }
  if (!result.verified) return json({ error: "Your device's answer couldn't be checked. Please try again." }, 400);

  const c = result.registrationInfo.credential;
  const name = typeof body.deviceName === "string" && body.deviceName.trim() ? body.deviceName.trim().slice(0, 80) : "This device";
  const { error } = await admin.from("passkeys").insert({
    id: c.id,
    user_id: user.id,
    public_key: toB64url(c.publicKey),
    counter: c.counter,
    transports: c.transports ?? [],
    device_name: name,
  });
  if (error) return json({ error: /duplicate/i.test(error.message) ? "This device is already set up." : "Couldn't save it. Please try again." }, 400);
  return json({ ok: true });
}

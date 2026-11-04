import { generateRegistrationOptions } from "@simplewebauthn/server";
import { adminClient, json, relyingParty, RP_NAME, saveChallenge, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";

/** Step 1 of turning on Face ID / fingerprint sign-in for a signed-in person. */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Face ID sign-in isn't switched on yet." }, 503);
  const rp = relyingParty(req);
  if (!rp) return json({ error: "Please open ScholarTasks at its usual web address and try again." }, 400);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);

  const { data: existing } = await admin.from("passkeys").select("id, transports").eq("user_id", user.id);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpID,
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "ScholarTasks",
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: ((existing as { id: string; transports: string[] }[]) ?? []).map((p) => ({
      id: p.id,
      transports: p.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = await saveChallenge(admin, "register", options.challenge, user.id);
  return json({ options, challengeId });
}

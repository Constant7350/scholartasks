import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { adminClient, json, relyingParty, saveChallenge } from "../../../../lib/passkeys";

export const runtime = "nodejs";

/** Step 1 of signing in with Face ID / fingerprint. No email needed: the device knows the account. */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Face ID sign-in isn't switched on yet." }, 503);
  const rp = relyingParty(req);
  if (!rp) return json({ error: "Please open ScholarTasks at its usual web address and try again." }, 400);
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required" });
  const challengeId = await saveChallenge(admin, "login", options.challenge, null);
  return json({ options, challengeId });
}

import { adminClient, json, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";

/**
 * Deletes the signed-in person's account (required by Apple and Google Play).
 * The database removes the family's data (or just this person's link to it) and
 * says which sign-ins to remove; then the sign-ins themselves are deleted.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Account deletion isn't switched on yet. Email support@scholartasks.com and we'll do it for you." }, 503);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== true) return json({ error: "Please confirm that you want to delete your account." }, 400);

  const { data, error } = await admin.rpc("delete_account", { p_user: user.id });
  if (error) return json({ error: error.message }, 400);

  const failed: string[] = [];
  for (const id of (data as string[] | null) ?? [user.id]) {
    const { error: e } = await admin.auth.admin.deleteUser(id);
    if (e && !/not found/i.test(e.message)) failed.push(id);
  }
  if (failed.length) {
    console.error("account delete: could not remove sign-ins", failed);
    return json({ ok: true, note: "Your information is deleted. Removing the sign-in itself didn't finish; we'll complete it within 30 days." });
  }
  return json({ ok: true });
}

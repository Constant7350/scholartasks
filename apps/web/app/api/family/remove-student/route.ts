import { adminClient, json, userFromRequest } from "../../../../lib/passkeys";

export const runtime = "nodejs";

/**
 * A parent removes one student from the family. The database checks the caller
 * is a parent there, deletes the student's information and says which student
 * sign-in to remove; then that sign-in is deleted.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  if (!admin) return json({ error: "Removing a student isn't switched on yet. Email support@scholartasks.com and we'll do it for you." }, 503);
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const body = (await req.json().catch(() => null)) as { student?: unknown; confirm?: unknown } | null;
  if (typeof body?.student !== "string" || !/^[0-9a-f-]{36}$/i.test(body.student)) return json({ error: "Which student?" }, 400);
  if (body.confirm !== true) return json({ error: "Please confirm that you want to remove this student." }, 400);

  const { data, error } = await admin.rpc("remove_student", { p_student: body.student, p_user: user.id });
  if (error) {
    if (/remove_student/.test(error.message) && /exist|schema cache/i.test(error.message)) {
      return json({ error: "Run database update 35 in Supabase first, then try again." }, 400);
    }
    return json({ error: error.message }, 400);
  }

  const failed: string[] = [];
  for (const id of (data as string[] | null) ?? []) {
    const { error: e } = await admin.auth.admin.deleteUser(id);
    if (e && !/not found/i.test(e.message)) failed.push(id);
  }
  if (failed.length) console.error("remove student: could not remove sign-ins", failed);
  return json({ ok: true, signInsRemoved: ((data as string[] | null) ?? []).length - failed.length });
}

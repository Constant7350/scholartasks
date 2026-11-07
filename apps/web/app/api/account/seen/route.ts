import { createHmac } from "node:crypto";
import { adminClient, json, userFromRequest } from "../../../../lib/passkeys";
import { clientIp } from "../../../../lib/consent-server";

export const runtime = "nodejs";

/**
 * Sharing guard (Constant, 2026-11-07): notes, at most once a day per device, that this parent or
 * student signed in from this device on this network. Keeps only a random device id the app made,
 * a one-way hash of the network address (the address itself is never stored) and the day. Kept 90
 * days. Nothing is kept for students under 13. Only the team sees the counts; nothing happens
 * to an account automatically.
 */
export async function POST(req: Request) {
  const admin = adminClient();
  const secret = process.env.SIGNIN_HASH_SECRET || process.env.CRON_SECRET;
  if (!admin || !secret) return json({ ok: true, skipped: true });
  const user = await userFromRequest(admin, req);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const body = (await req.json().catch(() => null)) as { device?: unknown } | null;
  const device = typeof body?.device === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.device) ? body.device : null;
  const ip = clientIp(req);
  if (!device || !ip) return json({ ok: true, skipped: true });

  const { data: m } = await admin.from("family_members").select("family_id, role, student_id").eq("user_id", user.id);
  const rows = (m as { family_id: string; role: "parent" | "student"; student_id: string | null }[] | null) ?? [];
  if (!rows.length) return json({ ok: true });
  const netHash = createHmac("sha256", secret).update(`net:${ip}`).digest("hex").slice(0, 32);
  const day = new Date().toISOString().slice(0, 10);
  const keep = [];
  for (const r of rows) {
    if (r.student_id && (await admin.rpc("is_under_13", { p_student: r.student_id })).data === true) continue;
    keep.push({ user_id: user.id, family_id: r.family_id, role: r.role, student_id: r.student_id, device_id: device, net_hash: netHash, day });
  }
  if (keep.length) {
    const { error } = await admin.from("signin_seen").upsert(keep, { onConflict: "user_id,device_id,net_hash,day", ignoreDuplicates: true });
    if (error && !/signin_seen/.test(error.message)) console.error("signin seen", error.message);
  }
  return json({ ok: true });
}

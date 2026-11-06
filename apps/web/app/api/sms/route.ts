import { createClient } from "@supabase/supabase-js";
import { hashCode, newCode, sendText, showPhone, smsConfigured, usPhone } from "../../../lib/sms";

// Turn text reminders on or off. "start" texts a 6-digit code to the number,
// "confirm" checks it and switches texts on, "off" switches them off.
// The server writes sms_settings, so only a number that got the code can be saved.
export const dynamic = "force-dynamic";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const MAX_CODES_A_DAY = 5;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !pub || !secret || !smsConfigured()) return json(503, { error: "Text reminders aren't switched on yet. Email and phone reminders still work." });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Please sign in again." });
  const asUser = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: u, error: ue } = await asUser.auth.getUser(token);
  if (ue || !u.user) return json(401, { error: "Please sign in again." });
  const userId = u.user.id;

  let body: { action?: unknown; phone?: unknown; code?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Something went wrong. Please try again." }); }
  const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row } = await sb.from("sms_settings").select("*").eq("user_id", userId).maybeSingle();
  const cur = row as { pending_phone: string | null; code_hash: string | null; code_expires: string | null; code_tries: number; codes_sent_on: string | null; codes_sent: number } | null;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (body.action === "off") {
    await sb.from("sms_settings").upsert({ user_id: userId, sms_on: false, updated_at: now.toISOString() });
    return json(200, { ok: true, message: "Text reminders are off." });
  }

  if (body.action === "start") {
    const phone = typeof body.phone === "string" ? usPhone(body.phone) : null;
    if (!phone) return json(400, { error: "Please enter a 10-digit U.S. cell phone number." });
    const sentToday = cur?.codes_sent_on === today ? cur.codes_sent : 0;
    if (sentToday >= MAX_CODES_A_DAY) return json(429, { error: "Too many codes today. Please try again tomorrow." });
    const code = newCode();
    const r = await sendText(phone, `ScholarTasks code: ${code}. It expires in 10 minutes. If you didn't ask for this, ignore it.`);
    if (!r.ok) return json(502, { error: r.code === 21610 ? "This number has texts blocked. Text START to our number first, then try again." : "The text couldn't be sent. Check the number and try again." });
    await sb.from("sms_settings").upsert({
      user_id: userId, pending_phone: phone, code_hash: hashCode(code, userId), code_expires: new Date(now.getTime() + 10 * 60000).toISOString(),
      code_tries: 0, codes_sent_on: today, codes_sent: sentToday + 1, updated_at: now.toISOString(),
    });
    return json(200, { ok: true, message: `We texted a code to ${showPhone(phone)}.` });
  }

  if (body.action === "confirm") {
    const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
    if (!cur?.pending_phone || !cur.code_hash || !cur.code_expires || new Date(cur.code_expires) < now) return json(400, { error: "That code has expired. Send a new one." });
    if (cur.code_tries >= 5) return json(429, { error: "Too many tries. Send a new code." });
    if (hashCode(code, userId) !== cur.code_hash) {
      await sb.from("sms_settings").update({ code_tries: cur.code_tries + 1 }).eq("user_id", userId);
      return json(400, { error: "That code doesn't match. Check the text and try again." });
    }
    await sb.from("sms_settings").update({
      phone: cur.pending_phone, sms_on: true, verified_at: now.toISOString(), pending_phone: null, code_hash: null, code_expires: null, code_tries: 0, updated_at: now.toISOString(),
    }).eq("user_id", userId);
    await sendText(cur.pending_phone, "ScholarTasks: text reminders are on. We text 7 days before, the day before and the day of each deadline, up to 20 texts a month. Reply STOP to stop.");
    return json(200, { ok: true, message: `Text reminders are on for ${showPhone(cur.pending_phone)}.` });
  }
  return json(400, { error: "Something went wrong. Please try again." });
}

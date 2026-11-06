import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { itemTitle, langsFor, whenDue, wordsFor } from "./reminder-words";

// Text messages through Twilio. Server only. Needs TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN and TWILIO_FROM (a phone number or a Messaging Service SID
// starting with "MG") in Vercel. Texts are opt-in and capped each month.

export const MONTHLY_TEXT_CAP = 20;

/** A U.S. number as +1XXXXXXXXXX, or null if it isn't one. */
export function usPhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}

/** "+14045550123" → "(404) 555-0123". */
export const showPhone = (p: string) => `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}`;

export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

export const newCode = () => String(randomInt(0, 1000000)).padStart(6, "0");
export const hashCode = (code: string, userId: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

/** Sends one text. Returns the Twilio error code on failure (21610 means the person replied STOP). */
export async function sendText(to: string, body: string): Promise<{ ok: true } | { ok: false; code: number | null }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!, token = process.env.TWILIO_AUTH_TOKEN!, from = process.env.TWILIO_FROM!;
  const form = new URLSearchParams({ To: to, Body: body.slice(0, 600) });
  if (from.startsWith("MG")) form.set("MessagingServiceSid", from); else form.set("From", from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (res.ok) return { ok: true };
  const out = (await res.json().catch(() => null)) as { code?: number } | null;
  return { ok: false, code: out?.code ?? null };
}

interface SmsDue { user_id: string; phone: string; student_first_name: string; item_type: "task" | "college"; item_id: string; title: string; days_before: number; texts_this_month: number }

/** The daily text job: one text per person listing what's due, within the monthly cap. */
export async function sendTextReminders(sb: SupabaseClient, today: string, appUrl: string): Promise<{ texts_sent: number; skipped_cap: number; failed: number }> {
  if (!smsConfigured()) return { texts_sent: 0, skipped_cap: 0, failed: 0 };
  const { data, error } = await sb.rpc("sms_reminders_due", { p_today: today });
  if (error) throw new Error(error.message);
  const byUser = new Map<string, SmsDue[]>();
  for (const d of (data as SmsDue[]) ?? []) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);
  let sent = 0, capped = 0, failed = 0;
  const langs = await langsFor(sb, [...byUser.keys()]);
  const words = await wordsFor(sb, [...langs.values()].includes("es"));
  for (const [userId, items] of byUser) {
    const lang = langs.get(userId) ?? "en";
    const T = (en: string) => words(lang, en);
    const first = items[0]!;
    if (first.texts_this_month >= MONTHLY_TEXT_CAP) { capped++; continue; }
    items.sort((a, b) => a.days_before - b.days_before);
    const lines = items.slice(0, 3).map((i) => T(`${itemTitle(i.title, lang)} (${i.student_first_name}) is due ${whenDue(i.days_before, lang)}.`));
    const more = items.length > 3 ? " " + T(`+${items.length - 3} more.`) : "";
    const body = `ScholarTasks: ${lines.join(" ")}${more} ${appUrl}/plan ${T("Reply STOP to stop texts.")}`;
    const r = await sendText(first.phone, body);
    if (!r.ok) {
      failed++;
      if (r.code === 21610) await sb.from("sms_settings").update({ sms_on: false, updated_at: new Date().toISOString() }).eq("user_id", userId);
      continue;
    }
    await sb.from("sms_log").insert([{ user_id: userId, item_type: "batch" }, ...items.map((i) => ({ user_id: userId, item_type: i.item_type, item_id: i.item_id, days_before: i.days_before }))]);
    sent++;
  }
  return { texts_sent: sent, skipped_cap: capped, failed };
}

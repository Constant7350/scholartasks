import { createClient } from "@supabase/supabase-js";
import { sendTextReminders } from "../../../../lib/sms";

// Daily reminder emails. Vercel Cron calls this once a day (see vercel.json) with
// "Authorization: Bearer $CRON_SECRET". Runs on the server only; the secret keys
// below are set in Vercel's environment settings and never reach the browser.
export const dynamic = "force-dynamic";

interface Due {
  user_id: string;
  email: string;
  student_first_name: string;
  item_type: "task" | "college";
  item_id: string;
  title: string;
  due_on: string;
  days_before: number;
  url: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

/** Today's date in Georgia (Eastern time), as YYYY-MM-DD. */
function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function emailHtml(items: Due[], appUrl: string): string {
  const rows = items
    .sort((a, b) => a.days_before - b.days_before)
    .map(
      (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e3e7ee">
        <div style="font-weight:700;color:#14305a">${esc(i.title)}</div>
        <div style="color:#5d6878;font-size:14px">${esc(i.student_first_name)} · due ${when(i.days_before)} (${esc(i.due_on)})</div>
        ${i.url ? `<div style="font-size:14px"><a href="${esc(i.url)}">Open the application</a></div>` : ""}
      </td></tr>`,
    )
    .join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b2433">
    <h2 style="color:#14305a;margin:0 0 6px">Coming up on your college plan</h2>
    <p style="color:#5d6878;margin:0 0 12px">Here's what's due soon.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin:20px 0"><a href="${appUrl}/plan" style="background:#14305a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open your plan</a></p>
    <p style="color:#93a4c2;font-size:12px">You get these because reminders are on in ScholarTasks. Turn them off any time on your <a href="${appUrl}/plan">plan page</a>.</p>
  </div>`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !key || !resendKey) return Response.json({ ok: false, error: "reminder email is not configured yet" }, { status: 503 });

  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("reminders_due", { p_today: todayEastern() });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const byUser = new Map<string, Due[]>();
  for (const d of (data as Due[]) ?? []) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  let sent = 0;
  const failed: string[] = [];
  for (const [userId, items] of byUser) {
    const first = items[0]!;
    const soonest = Math.min(...items.map((i) => i.days_before));
    const subject =
      items.length === 1 ? `${first.title} is due ${when(first.days_before)}` : `${items.length} college deadlines coming up (first one ${when(soonest)})`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "ScholarTasks <noreply@scholartasks.com>", to: [first.email], subject, html: emailHtml(items, appUrl) }),
    });
    if (!res.ok) {
      failed.push(userId);
      continue;
    }
    for (const i of items) await sb.rpc("mark_reminder_sent", { p_user: userId, p_item_type: i.item_type, p_item: i.item_id, p_days: i.days_before });
    sent++;
  }
  // Text reminders (opt-in, 7 days, 1 day and the day of; capped each month).
  let texts: Awaited<ReturnType<typeof sendTextReminders>> | { error: string };
  try { texts = await sendTextReminders(sb, todayEastern(), appUrl); } catch (e) { texts = { error: e instanceof Error ? e.message : "texts failed" }; }
  return Response.json({ ok: failed.length === 0, emails_sent: sent, failed: failed.length, texts });
}

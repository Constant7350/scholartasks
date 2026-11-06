import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { wordsFor } from "../../../../lib/reminder-words";
import { mailingAddress, unsubscribeUrl } from "../../../../lib/unsubscribe";
import {
  NOTE_SCHEMA, NOTE_SYSTEM, PROGRESS_MODEL, cleanNote, fallbackNote, lastWeekStart, noteMessage, progressFor,
  type LogLine, type MailLang, type Note, type Progress,
} from "../../../../lib/progress-email";

// Weekly Homework Helper progress email to parents. Vercel Cron calls this on Monday morning
// (and again on Tuesday to catch anyone Monday missed; nobody gets two) with
// "Authorization: Bearer $CRON_SECRET". One small AI call per student (claude-haiku-5-5,
// well under a cent each); if the AI is off or fails, the email goes out with plain words.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Due { user_id: string; email: string; student_id: string; first_name: string; grade_level: number; lang: string; last_tactic: string | null; last_trend: string | null }
interface Section { due: Due; progress: Progress; note: Note }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const BUDGET_MS = 240_000;

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function writeNote(client: Anthropic | null, d: Due, lang: MailLang, progress: Progress): Promise<Note> {
  const fb = fallbackNote(progress.trend, lang);
  if (!client) return fb;
  try {
    const res = await client.messages.create({
      model: PROGRESS_MODEL,
      max_tokens: 600,
      output_config: { format: { type: "json_schema", schema: NOTE_SCHEMA } },
      system: NOTE_SYSTEM,
      messages: [{ role: "user", content: noteMessage({ grade: d.grade_level, lang, progress, lastTactic: d.last_tactic, lastTrend: d.last_trend }) }],
    });
    const text = res.content.map((x) => (x.type === "text" ? x.text : "")).join("");
    return cleanNote(JSON.parse(text) as Note, fb);
  } catch (err) {
    console.error("progress note failed", err);
    return fb;
  }
}

function sectionHtml(s: Section, T: (en: string) => string, many: boolean): string {
  const name = esc(s.due.first_name);
  const put = (x: string) => esc(x).replace(/STUDENT/g, name);
  const w = s.progress.thisWeek;
  const subjects = w.subjects.map((x) => esc(x.subject)).join(", ");
  const stats = w.replies === 0 ? "" : `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:10px 0">
      <tr><td style="padding:4px 0;color:#5d6878">${T("Problems finished")}</td><td style="text-align:right;font-weight:700">${w.finished}</td></tr>
      <tr><td style="padding:4px 0;color:#5d6878">${T("Finished with no hints or 1 hint")}</td><td style="text-align:right;font-weight:700">${w.finished ? `${w.byHints[0] + w.byHints[1]}` : "0"}</td></tr>
      <tr><td style="padding:4px 0;color:#5d6878">${T("Hints per finished problem")}</td><td style="text-align:right;font-weight:700">${w.avgHints ?? "–"}${s.progress.before.avgHints != null ? ` <span style="color:#5d6878;font-weight:400">(${T(`before: ${s.progress.before.avgHints}`)})</span>` : ""}</td></tr>
      ${subjects ? `<tr><td style="padding:4px 0;color:#5d6878">${T("Subjects")}</td><td style="text-align:right">${subjects}</td></tr>` : ""}
      ${w.saidNo ? `<tr><td style="padding:4px 0;color:#5d6878">${T("Times the helper said no")}</td><td style="text-align:right;font-weight:700">${w.saidNo}</td></tr>` : ""}
    </table>`;
  return `<div style="border:1px solid #e3e7ee;border-radius:12px;padding:16px;margin:0 0 16px">
    ${many ? `<div style="font-size:13px;font-weight:700;color:#8a5a00;text-transform:uppercase;letter-spacing:1px">${name}</div>` : ""}
    <h3 style="color:#14305a;margin:4px 0 8px;font-size:18px">${put(s.note.headline)}</h3>
    <p style="margin:0 0 8px;line-height:1.5">${put(s.note.note)}</p>
    ${stats}
    <div style="background:#fff8ee;border-radius:10px;padding:12px 14px;margin-top:8px">
      <div style="font-weight:700;color:#14305a;margin-bottom:4px">${T("Try this week")}</div>
      <div style="line-height:1.5">${put(s.note.try_this)}</div>
    </div>
    ${w.safety ? `<p style="margin:10px 0 0;color:#a3261c;font-weight:600">${T(`Please check in with ${name}: the helper suggested talking to a trusted adult this week. Details are on the Homework Helper page.`)}</p>` : ""}
  </div>`;
}

function emailHtml(sections: Section[], appUrl: string, lang: MailLang, T: (en: string) => string, stop: string | null): string {
  const address = mailingAddress();
  return `<div lang="${lang}" style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b2433">
    <h2 style="color:#14305a;margin:0 0 6px">${T("Your weekly Homework Helper update")}</h2>
    <p style="color:#5d6878;margin:0 0 16px">${T("How the thinking went this week, and one idea to try at home.")}</p>
    ${sections.map((s) => sectionHtml(s, T, sections.length > 1)).join("")}
    <p style="margin:20px 0"><a href="${appUrl}/homework" style="background:#14305a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">${T("See the full week")}</a></p>
    <p style="color:#5d6878;font-size:12px">${T("Written with AI from the Homework Helper summary you see in the app. Chats are never saved or read.")}</p>
    <p style="color:#5d6878;font-size:12px">${T("Turn this email off any time on the Homework Helper page.")}${stop ? ` <a href="${esc(stop)}">${T("Stop these emails")}</a>` : ""}</p>
    ${address ? `<p style="color:#5d6878;font-size:12px">ScholarTasks · ${esc(address)}</p>` : ""}
  </div>`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !key || !resendKey) return Response.json({ ok: false, error: "progress email is not configured yet" }, { status: 503 });

  const started = Date.now();
  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const weekStart = lastWeekStart(todayEastern());
  const { data, error } = await sb.rpc("progress_email_due", { p_week_start: weekStart });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const due = (data as Due[]) ?? [];
  if (!due.length) return Response.json({ ok: true, week_start: weekStart, emails_sent: 0 });

  // The log lines for every student at once: the finished week and the three before it.
  const studentIds = [...new Set(due.map((d) => d.student_id))];
  const from = new Date(Date.parse(`${weekStart}T00:00:00Z`) - 21 * 86400000).toISOString();
  const to = new Date(Date.parse(`${weekStart}T00:00:00Z`) + 7 * 86400000).toISOString();
  const logs = new Map<string, LogLine[]>();
  for (let i = 0; i < studentIds.length; i += 100) {
    const { data: rows, error: e } = await sb.from("homework_log").select("student_id, created_at, subject, topic, hints, solved, said_no, safety")
      .in("student_id", studentIds.slice(i, i + 100)).gte("created_at", from).lt("created_at", to).limit(20000);
    if (e) return Response.json({ ok: false, error: e.message }, { status: 500 });
    for (const r of (rows as (LogLine & { student_id: string })[]) ?? []) logs.set(r.student_id, [...(logs.get(r.student_id) ?? []), r]);
  }

  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  const words = await wordsFor(sb, due.some((d) => d.lang === "es"));
  const byParent = new Map<string, Due[]>();
  for (const d of due) byParent.set(d.user_id, [...(byParent.get(d.user_id) ?? []), d]);

  // A student's numbers are the same for both parents, so write each student's note once per language.
  const notes = new Map<string, Promise<Note>>();
  let sent = 0, left = 0;
  const failed: string[] = [];
  for (const [userId, kids] of byParent) {
    if (Date.now() - started > BUDGET_MS) { left++; continue; } // Tuesday's run picks these up.
    const lang: MailLang = kids[0]!.lang === "es" ? "es" : "en";
    const T = (en: string) => words(lang, en);
    const sections: Section[] = await Promise.all(kids.map(async (d) => {
      const progress = progressFor(logs.get(d.student_id) ?? [], weekStart);
      const k = `${d.student_id}:${lang}:${d.last_tactic ?? ""}`;
      if (!notes.has(k)) notes.set(k, writeNote(client, d, lang, progress));
      return { due: d, progress, note: await notes.get(k)! };
    }));
    const email = kids[0]!.email;
    const stop = unsubscribeUrl(appUrl, email, "progress");
    const names = kids.map((k) => k.first_name).join(lang === "es" ? " y " : " and ");
    const subject = sections.length === 1 ? sections[0]!.note.headline.replace(/STUDENT/g, kids[0]!.first_name) : T(`This week with the Homework Helper: ${names}`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ScholarTasks <noreply@scholartasks.com>",
        to: [email],
        subject,
        html: emailHtml(sections, appUrl, lang, T, stop),
        ...(stop ? { headers: { "List-Unsubscribe": `<${stop.replace("/unsubscribe?", "/api/unsubscribe?")}>, <mailto:support@scholartasks.com?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
    }).catch(() => null);
    if (!res?.ok) { failed.push(userId); continue; }
    await sb.from("progress_email_log").upsert(
      sections.map((s) => ({ user_id: userId, student_id: s.due.student_id, week_start: weekStart, trend: s.progress.trend, tactic: s.note.tactic_short.replace(/STUDENT/g, "the student") })),
      { onConflict: "user_id,student_id,week_start", ignoreDuplicates: true },
    );
    sent++;
  }
  return Response.json({ ok: failed.length === 0, week_start: weekStart, emails_sent: sent, failed: failed.length, left_for_next_run: left, notes_written: notes.size });
}

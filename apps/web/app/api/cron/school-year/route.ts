import { createClient } from "@supabase/supabase-js";
import { sendText, smsConfigured } from "../../../../lib/sms";

// New school year (Vercel Cron, "Authorization: Bearer $CRON_SECRET"), August 1-7. On the first
// run every student moves up one grade and seniors are marked graduated (database update 67);
// later runs that week change nothing and only retry parents who weren't told yet. Each parent
// gets one email in their language listing their students, plus a short text if they turned
// texts on. Grades are fixed on the Family page. A family's price level follows on its own:
// the daily price check emails about 30 days before the next bill if the level changes.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Row { user_id: string; email: string; lang: string; phone: string | null; family_id: string; student_id: string; first_name: string; old_grade: number; new_grade: number; graduated: boolean }

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function line(r: Row, es: boolean): string {
  const n = esc(r.first_name);
  if (r.graduated) return es ? `🎓 <b>${n}</b> terminó el grado 12. ¡Felicidades! Su cuenta sigue abierta y ya no cuenta en el precio.` : `🎓 <b>${n}</b> finished grade 12. Congratulations! ${n}'s account stays open and no longer counts toward your price.`;
  return es ? `<b>${n}</b> pasó del grado ${r.old_grade} al <b>grado ${r.new_grade}</b>.` : `<b>${n}</b> moved from grade ${r.old_grade} to <b>grade ${r.new_grade}</b>.`;
}

function schoolYearEmail(rows: Row[], appUrl: string): { subject: string; html: string; text: string } {
  const es = rows[0]!.lang === "es";
  const fam = `${appUrl}/family`;
  const names = rows.map((r) => r.first_name).join(", ");
  const subject = es ? "Nuevo año escolar: grados actualizados en ScholarTasks" : "New school year: grades updated in ScholarTasks";
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b2433">
    <h2 style="color:#14305a">${es ? "¡Feliz nuevo año escolar!" : "Happy new school year!"}</h2>
    <p>${es ? "Cada agosto ScholarTasks sube a cada estudiante un grado, para que sus páginas, metas y ayuda de IA sigan al día." : "Every August, ScholarTasks moves each student up one grade so their pages, goals and AI help stay right for the year."}</p>
    <ul style="padding-left:18px">${rows.map((r) => `<li style="margin:6px 0">${line(r, es)}</li>`).join("")}</ul>
    <p>${es ? `¿Algún grado no está bien? Arréglelo en un toque en la página <a href="${fam}">Familia y permisos</a>.` : `Is a grade wrong? Fix it in one tap on the <a href="${fam}">Family and permissions</a> page.`}</p>
    <p style="color:#5a6577;font-size:13px">${es ? "Si el nuevo grado cambia el nivel de precio de su familia, le avisaremos por correo unos 30 días antes de su próximo cobro." : "If a new grade changes your family's price level, we'll email you about 30 days before your next bill."}</p>
  </div>`;
  const text = es
    ? `ScholarTasks: nuevo año escolar. Actualizamos los grados de ${names}. ¿Algún error? Arréglelo aquí: ${fam} Responda STOP para no recibir textos.`
    : `ScholarTasks: new school year. We moved ${names} up a grade. Anything wrong? Fix it here: ${fam} Reply STOP to stop texts.`;
  return { subject, html, text };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "not configured" }, { status: 503 });
  const resendKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = todayEastern();
  // Only in August, so a stray manual run in spring can't move anyone early.
  if (today.slice(5, 7) !== "08") return Response.json({ ok: true, skipped: "only runs in August", today });
  const year = Number(today.slice(0, 4));

  const { data: moved, error } = await sb.rpc("advance_school_year", { p_today: today });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!resendKey) return Response.json({ ok: false, moved, error: "RESEND_API_KEY is needed to tell parents" }, { status: 503 });

  const { data, error: e2 } = await sb.rpc("school_year_notices", { p_year: year });
  if (e2) return Response.json({ ok: false, moved, error: e2.message }, { status: 500 });
  const byParent = new Map<string, Row[]>();
  for (const r of (data as Row[]) ?? []) byParent.set(r.user_id, [...(byParent.get(r.user_id) ?? []), r]);

  const failedFamilies = new Set<string>(), families = new Set<string>();
  let emails = 0, texts = 0;
  for (const [userId, rows] of byParent) {
    const first = rows[0]!;
    families.add(first.family_id);
    const msg = schoolYearEmail(rows, appUrl);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `school-year-${year}-${userId}` },
      body: JSON.stringify({ from: "ScholarTasks <noreply@scholartasks.com>", to: [first.email], subject: msg.subject, html: msg.html }),
    }).catch(() => null);
    if (!res?.ok) { failedFamilies.add(first.family_id); continue; }
    emails++;
    if (first.phone && smsConfigured()) {
      const t = await sendText(first.phone, msg.text);
      if (t.ok) texts++;
      else if (t.code === 21610) await sb.from("sms_settings").update({ sms_on: false, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
  }
  // A family is marked told once every parent's email went out; otherwise tomorrow's run retries.
  for (const f of families) if (!failedFamilies.has(f)) await sb.rpc("school_year_notified", { p_year: year, p_family: f });
  return Response.json({ ok: failedFamilies.size === 0, today, moved, emails, texts, failed_families: failedFamilies.size });
}

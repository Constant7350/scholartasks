import { createClient } from "@supabase/supabase-js";
import { adminClient } from "../../../../lib/passkeys";
import { emailShell, esc, sendEmail, SUPPORT_EMAIL } from "../../../../lib/openings";

export const runtime = "nodejs";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const SITE = "https://scholartasks.com";
const FRESH_MS = 10 * 60_000;

/**
 * Sends the emails for weekend and holiday job applications, after the change was saved in the database:
 * - "applied": a student applied, so their parents are asked to read the consent and agree (or a parent applied, so the company hears).
 * - "decided": a parent agreed, so the company hears there's a new application.
 * - "status": the company moved an application along, so the parent hears.
 * - "posted": a company posted a job from its account, so our team reviews it.
 * The caller must be able to see the row, and only fresh changes send mail, so this can't be used to spam.
 * Emails never hold the student's details: people sign in to see them.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const admin = adminClient();
  if (!url || !key || !admin) return json(503, { error: "Not set up yet." });
  if (!token) return json(401, { error: "Please sign in again." });
  const b = (await req.json().catch(() => null)) as { id?: unknown; event?: unknown } | null;
  const id = typeof b?.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null;
  const event = ["applied", "decided", "status", "posted"].includes(b?.event as string) ? (b!.event as string) : null;
  if (!id || !event) return json(400, { error: "Something went wrong." });
  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const fresh = (at: string | null | undefined) => !!at && Date.now() - new Date(at).getTime() < FRESH_MS;

  if (event === "posted") {
    const { data } = await sb.from("local_openings").select("id, title, company_name, city, state, kind, created_at").eq("id", id).maybeSingle();
    const o = data as { title: string; company_name: string; city: string; state: string; kind: string; created_at: string } | null;
    if (!o || !fresh(o.created_at)) return json(200, { ok: true, emailed: false });
    const emailed = await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `New job to review: ${o.title}`,
      html: emailShell("New job to review", `<p><b>${esc(o.title)}</b> from ${esc(o.company_name)} (${esc(o.city)}, ${esc(o.state)}) was posted from a company account.</p>
        <p><a href="${SITE}/admin/openings">Review it</a></p>`),
    });
    return json(200, { ok: true, emailed });
  }

  if (event === "status") {
    const { data } = await sb.rpc("employer_applications");
    const a = ((data as { id: string; opening_title: string; first_name: string; parent_email: string | null; share_email: string | null; status: string }[]) ?? []).find((r) => r.id === id);
    if (!a || !["interview", "hired", "not_selected"].includes(a.status)) return json(200, { ok: true, emailed: false });
    const { data: row } = await admin.from("job_applications").select("updated_at").eq("id", id).maybeSingle();
    if (!fresh((row as { updated_at: string } | null)?.updated_at)) return json(200, { ok: true, emailed: false });
    const words = a.status === "hired" ? "offered the job" : a.status === "interview" ? "asked to meet" : "chosen someone else this time";
    const to = [a.parent_email, a.share_email].filter((x): x is string => !!x);
    let emailed = false;
    for (const t of new Set(to)) {
      emailed = (await sendEmail({
        to: t,
        subject: `Job update: ${a.opening_title}`,
        html: emailShell("Job application update", `<p>The company has ${words} for <b>${esc(a.opening_title)}</b>.</p>
          <p><a href="${SITE}/jobs">See the details in ScholarTasks</a></p>
          <p style="font-size:13px">Meet at the workplace, in public, and if the student is under 18, go along to the first visit.</p>`),
      })) || emailed;
    }
    return json(200, { ok: true, emailed });
  }

  // applied / decided: the family can see this row.
  const { data } = await sb.from("job_applications").select("id, status, student_id, opening_id, updated_at, applied_outside").eq("id", id).maybeSingle();
  const a = data as { status: string; student_id: string; opening_id: string; updated_at: string; applied_outside: boolean } | null;
  if (!a || !fresh(a.updated_at)) return json(200, { ok: true, emailed: false });
  const { data: op } = await admin.from("local_openings").select("title, contact_name, contact_email, employer_id").eq("id", a.opening_id).maybeSingle();
  const o = op as { title: string; contact_name: string; contact_email: string; employer_id: string | null } | null;
  if (!o) return json(200, { ok: true, emailed: false });

  if (a.status === "needs_parent") {
    const { data: st } = await admin.from("students").select("first_name, family_id").eq("id", a.student_id).maybeSingle();
    const s = st as { first_name: string; family_id: string } | null;
    if (!s) return json(200, { ok: true, emailed: false });
    const { data: mem } = await admin.from("family_members").select("user_id").eq("family_id", s.family_id).eq("role", "parent");
    let emailed = false;
    for (const m of (mem as { user_id: string }[]) ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      if (!u.user?.email) continue;
      emailed = (await sendEmail({
        to: u.user.email,
        subject: `${s.first_name} applied for a job: please review`,
        html: emailShell("Your OK is needed", `<p>${esc(s.first_name)} applied for <b>${esc(o.title)}</b> in ScholarTasks.</p>
          <p>${a.applied_outside ? "They applied on the company's own site and logged it here. Please read the consent and check <b>I agree</b> or decline." : "Nothing goes to the company until you read the application and check <b>I agree</b>."}</p>
          <p><a href="${SITE}/jobs">Review the application</a></p>`),
      })) || emailed;
    }
    return json(200, { ok: true, emailed });
  }
  if (a.status === "sent" && !a.applied_outside) {
    const emailed = await sendEmail({
      to: o.contact_email,
      subject: `New application: ${o.title}`,
      html: emailShell("You have a new application", `<p>Hi ${esc(o.contact_name)},</p><p>A student applied for <b>${esc(o.title)}</b>, and a parent agreed to send it.</p>
        <p><a href="${SITE}/employers/dashboard">Sign in to read it</a></p>
        <p style="font-size:13px">Please copy the parent on every reply, and follow the teen work rules you agreed to.</p>`),
    });
    return json(200, { ok: true, emailed });
  }
  return json(200, { ok: true, emailed: false });
}

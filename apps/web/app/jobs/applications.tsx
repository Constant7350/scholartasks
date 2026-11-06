"use client";

import { useCallback, useEffect, useState } from "react";
import { PART_TIME_KINDS, type JobApplicationStatus } from "@scholartasks/core";
import { supabase } from "../../lib/supabase";
import { kindLabel } from "../../lib/openings";
import { consentText, jobError, notifyJobs, statusLabel } from "../../lib/jobs";

interface MyApp {
  id: string; opening_id: string; student_id: string; first_name: string; title: string; company_name: string; city: string; state: string;
  kind: string; pay: string | null; schedule: string | null; message: string; availability: string | null; share_email: string | null;
  share_phone: string | null; parent_email: string | null; status: JobApplicationStatus; employer_note: string | null;
  parent_decided_at: string | null; consent_version: string | null; sent_at: string | null; created_at: string;
  applied_outside?: boolean; questions?: string[]; answers?: string[]; apply_url?: string | null;
}
interface Consent { at: string; agreed: boolean; version: string; wording: string; parent_email: string }
type Wording = { version: string; wording: string };

const when = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const isPartTime = (k: string) => (PART_TIME_KINDS as readonly string[]).includes(k);

/** Consent wording for applying on the company's own site (kept in the database so the saved record matches). */
export async function outsideConsentText(): Promise<Wording | null> {
  const { data } = (await supabase()?.rpc("job_consent_outside_text")) ?? { data: null };
  return ((data as Wording[] | null) ?? [])[0] ?? null;
}

/**
 * The family's applications. `part` keeps the two places apart:
 * "parttime" = weekend and holiday jobs (/jobs), "trades" = apprenticeships and trade openings (/trades/openings).
 * Parents agree here; families take an application back, say they got the job, and add it to the resume.
 */
export function MyApplications({ part }: { part: "parttime" | "trades" }) {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [apps, setApps] = useState<MyApp[]>([]);
  const [wording, setWording] = useState<{ inApp: Wording | null; outside: Wording | null }>({ inApp: null, outside: null });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return;
    setSignedIn(true);
    const [mem, a, inApp, outside] = await Promise.all([
      sb.from("family_members").select("role").eq("user_id", s.session.user.id),
      sb.rpc("my_job_applications"),
      consentText(),
      outsideConsentText(),
    ]);
    setIsParent(((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent"));
    setApps(((a.data as MyApp[]) ?? []).filter((x) => isPartTime(x.kind) === (part === "parttime")));
    setWording({ inApp, outside });
  }, [sb, part]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => void) => {
    setError(null); setMsg(null);
    const { error: e } = await fn();
    if (e) return setError(jobError(e.message));
    setMsg(ok);
    after?.();
    void load();
  };

  const addToActivities = async (a: MyApp, category: "work" | "leadership") => {
    if (!sb) return;
    const { data } = await sb.from("students").select("grade_level").eq("id", a.student_id).maybeSingle();
    const grade = (data as { grade_level: number } | null)?.grade_level;
    await run(() => sb.from("student_activities").insert({
      student_id: a.student_id, kind: "activity", category, position: a.title.slice(0, 100), organization: a.company_name.slice(0, 100),
      description: `${kindLabel(a.kind as never)} in ${a.city}, ${a.state}.`.slice(0, 150),
      grades: grade ? [grade] : [], ongoing: true,
    }), category === "work" ? "Added to Activities and the resume as work experience." : "Added to Activities and the resume as leadership.");
  };

  if (!signedIn) return null;
  return (
    <section className="panel">
      <h2>My applications ({apps.length})</h2>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}
      {apps.length === 0 ? <p className="hint">{part === "parttime" ? "None yet. Find a job below and press Apply in ScholarTasks." : "None yet. After you apply to an opening below, tap I applied: keep track, so a parent can agree and it can go on your resume if you're hired."}</p> : (
        <ul className="opening-list">{apps.map((a) => {
          const w = a.applied_outside ? wording.outside : wording.inApp;
          const label = a.applied_outside && a.status === "sent" ? "Parent agreed" : statusLabel(a.status);
          return (
            <li key={a.id} className="opening-card">
              <h3>{a.title}</h3>
              <p><b>{a.company_name}</b> · {a.city}, {a.state} · for {a.first_name}</p>
              <p className="trade-tags">
                <span className={`pill${a.status === "hired" ? " pill-ok" : a.status === "needs_parent" ? " pill-soon" : ""}`}>{label}</span>
                {a.applied_outside && <span className="pill">Applied on the company&apos;s site</span>}
              </p>
              {a.employer_note && <p><b>From the company:</b> {a.employer_note}</p>}
              <details><summary>The application</summary>
                <p className="pre">{a.message}</p>
                {a.availability && <p><b>Can work:</b> {a.availability}</p>}
                {(a.questions ?? []).map((q, i) => <p key={q}><b>{q}</b><br />{a.answers?.[i]}</p>)}
                {!a.applied_outside && <p className="hint small">Shared with the company: {[a.share_email, a.share_phone, a.parent_email && `parent ${a.parent_email}`].filter(Boolean).join(" · ")}</p>}
                {a.applied_outside && a.apply_url && <p className="hint small"><a href={a.apply_url} target="_blank" rel="noreferrer nofollow">The company&apos;s page</a></p>}
                <ConsentRecord id={a.id} />
              </details>

              {a.status === "needs_parent" && (isParent && w ? (
                <ParentAgree wording={w.wording} button={a.applied_outside ? "Agree" : "Agree and send"}
                  onAgree={() => run(() => sb!.rpc("decide_job_application", { p_id: a.id, p_ok: true, p_agree: true }),
                    a.applied_outside ? "Thank you. Your consent is saved." : "Thank you. It's on its way to the company, with your email so they include you.",
                    a.applied_outside ? undefined : () => void notifyJobs(a.id, "decided"))}
                  onDecline={() => run(() => sb!.rpc("decide_job_application", { p_id: a.id, p_ok: false, p_agree: false }), a.applied_outside ? "Declined." : "Declined. Nothing was sent to the company.")} />
              ) : <p className="hint">{a.applied_outside ? "A parent needs to open ScholarTasks and agree. We emailed them." : "A parent needs to open ScholarTasks and agree before this goes to the company. We emailed them."}</p>)}

              <p className="opening-actions">
                {["sent", "seen", "interview"].includes(a.status) && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void run(() => sb!.rpc("family_update_job_application", { p_id: a.id, p_status: "hired" }), "Congratulations!")}>We got the job</button>}
                {["needs_parent", "sent", "seen", "interview"].includes(a.status) && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void run(() => sb!.rpc("family_update_job_application", { p_id: a.id, p_status: "withdrawn" }), "Taken back.")}>Take it back</button>}
                {a.status === "hired" && <>
                  <button className="btn btn-inline btn-sm" onClick={() => void addToActivities(a, "work")}>Add to activities and resume (work)</button>
                  <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void addToActivities(a, "leadership")}>Add as leadership</button>
                </>}
              </p>
            </li>
          );
        })}</ul>
      )}
      <p className="hint small">Meet companies at their workplace, in public. Never pay to apply. If you&apos;re under 18, bring a parent to the first visit.</p>
    </section>
  );
}

/** The parent's "I agree": the exact consent wording, a box to tick, then agree or decline. */
export function ParentAgree({ wording, onAgree, onDecline, button = "Agree and send" }: { wording: string; onAgree: () => void; onDecline?: () => void; button?: string }) {
  const [ticked, setTicked] = useState(false);
  return (
    <div className="note note-info" style={{ display: "grid", gap: 8 }}>
      <b>Parent consent</b>
      <span>{wording}</span>
      <label className="check"><input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} /> I agree</label>
      <span className="opening-actions">
        <button className="btn btn-inline btn-sm" disabled={!ticked} onClick={onAgree}>{button}</button>
        {onDecline && <button className="btn btn-inline btn-sm btn-ghost" onClick={onDecline}>Decline</button>}
      </span>
      <span className="hint small">Your consent, the wording and the time are saved to a permanent record that can&apos;t be changed.</span>
    </div>
  );
}

/** Shows the saved consent record (who agreed, when, and the exact wording) from the permanent audit log. */
function ConsentRecord({ id }: { id: string }) {
  const [rows, setRows] = useState<Consent[] | null>(null);
  if (rows === null) return <button className="btn btn-inline btn-sm btn-ghost" onClick={async () => {
    const { data } = (await supabase()?.rpc("job_application_consents", { p_id: id })) ?? { data: null };
    setRows((data as Consent[]) ?? []);
  }}>See the consent record</button>;
  if (rows.length === 0) return <p className="hint small">No consent saved yet.</p>;
  return <ul className="hint small">{rows.map((c) => <li key={c.at}>{c.agreed ? "Agreed" : "Declined"} by {c.parent_email} on {when(c.at)} ({c.version})</li>)}</ul>;
}

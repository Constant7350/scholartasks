"use client";

import { useCallback, useEffect, useState } from "react";
import { PART_TIME_KINDS, type JobApplicationStatus } from "@scholartasks/core";
import { supabase } from "../../lib/supabase";
import { kindLabel } from "../../lib/openings";
import { consentText, jobError, notifyJobs, statusLabel } from "../../lib/jobs";
import { OpeningsList } from "../trades/openings-list";

interface MyApp {
  id: string; opening_id: string; student_id: string; first_name: string; title: string; company_name: string; city: string; state: string;
  kind: string; pay: string | null; schedule: string | null; message: string; availability: string | null; share_email: string | null;
  share_phone: string | null; parent_email: string | null; status: JobApplicationStatus; employer_note: string | null;
  parent_decided_at: string | null; consent_version: string | null; sent_at: string | null; created_at: string;
}
interface Ref {
  id: string; student_id: string; company_name: string; job_title: string; writer_name: string; writer_role: string | null;
  worked_from: string | null; worked_to: string | null; letter: string; family_status: "new" | "kept" | "hidden"; created_at: string;
}
interface Consent { at: string; agreed: boolean; version: string; wording: string; parent_email: string }

const when = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const gradeNow = async (studentId: string) => {
  const { data } = (await supabase()?.from("students").select("grade_level").eq("id", studentId).maybeSingle()) ?? { data: null };
  return (data as { grade_level: number } | null)?.grade_level ?? null;
};

/** The family's side: applications (parents agree here), reference letters, then jobs to apply for. */
export function JobsHome() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [apps, setApps] = useState<MyApp[]>([]);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [consent, setConsent] = useState<{ version: string; wording: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return;
    setSignedIn(true);
    const [mem, a, r, c] = await Promise.all([
      sb.from("family_members").select("role").eq("user_id", s.session.user.id),
      sb.rpc("my_job_applications"),
      sb.from("job_references").select("*").order("created_at", { ascending: false }),
      consentText(),
    ]);
    setIsParent(((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent"));
    setApps((a.data as MyApp[]) ?? []);
    setRefs((r.data as Ref[]) ?? []);
    setConsent(c);
  }, [sb]);
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
    const grade = await gradeNow(a.student_id);
    await run(() => sb.from("student_activities").insert({
      student_id: a.student_id, kind: "activity", category, position: a.title.slice(0, 100), organization: a.company_name.slice(0, 100),
      description: `${kindLabel(a.kind as never)} in ${a.city}, ${a.state}.`.slice(0, 150),
      grades: grade ? [grade] : [], ongoing: true,
    }), category === "work" ? "Added to Activities and the resume as work experience." : "Added to Activities and the resume as leadership.");
  };

  return (
    <>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}

      {signedIn && (
        <section className="panel">
          <h2>My job applications ({apps.length})</h2>
          {apps.length === 0 ? <p className="hint">None yet. Find a job below and press Apply in ScholarTasks.</p> : (
            <ul className="opening-list">{apps.map((a) => (
              <li key={a.id} className="opening-card">
                <h3>{a.title}</h3>
                <p><b>{a.company_name}</b> · {a.city}, {a.state} · for {a.first_name}</p>
                <p className="trade-tags"><span className={`pill${a.status === "hired" ? " pill-ok" : a.status === "needs_parent" ? " pill-soon" : ""}`}>{statusLabel(a.status)}</span></p>
                {a.employer_note && <p><b>From the company:</b> {a.employer_note}</p>}
                <details><summary>The application</summary>
                  <p className="pre">{a.message}</p>
                  {a.availability && <p><b>Can work:</b> {a.availability}</p>}
                  <p className="hint small">Shared with the company: {[a.share_email, a.share_phone, a.parent_email && `parent ${a.parent_email}`].filter(Boolean).join(" · ")}</p>
                  <ConsentRecord id={a.id} />
                </details>

                {a.status === "needs_parent" && (isParent && consent ? (
                  <ParentAgree wording={consent.wording} onAgree={() => run(() => sb!.rpc("decide_job_application", { p_id: a.id, p_ok: true, p_agree: true }), "Thank you. It's on its way to the company, with your email so they include you.", () => void notifyJobs(a.id, "decided"))}
                    onDecline={() => run(() => sb!.rpc("decide_job_application", { p_id: a.id, p_ok: false, p_agree: false }), "Declined. Nothing was sent to the company.")} />
                ) : <p className="hint">A parent needs to open ScholarTasks and agree before this goes to the company. We emailed them.</p>)}

                <p className="opening-actions">
                  {["sent", "seen", "interview"].includes(a.status) && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void run(() => sb!.rpc("family_update_job_application", { p_id: a.id, p_status: "hired" }), "Congratulations!")}>We got the job</button>}
                  {["needs_parent", "sent", "seen", "interview"].includes(a.status) && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void run(() => sb!.rpc("family_update_job_application", { p_id: a.id, p_status: "withdrawn" }), "Taken back.")}>Take it back</button>}
                  {a.status === "hired" && <>
                    <button className="btn btn-inline btn-sm" onClick={() => void addToActivities(a, "work")}>Add to activities and resume (work)</button>
                    <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void addToActivities(a, "leadership")}>Add as leadership</button>
                  </>}
                </p>
              </li>
            ))}</ul>
          )}
          <p className="hint small">Meet companies at their workplace, in public. Never pay to apply. If you&apos;re under 18, bring a parent to the first visit.</p>
        </section>
      )}

      {signedIn && refs.length > 0 && (
        <section className="panel">
          <h2>Reference letters ({refs.length})</h2>
          <p className="hint">Letters from employers about work ethic and character. A parent decides: keep a letter in the records (it shows on the resume), or hide it so it never counts. The company isn&apos;t told.</p>
          <ul className="opening-list">{refs.map((r) => (
            <li key={r.id} className="opening-card">
              <h3>{r.company_name}: {r.job_title}</h3>
              <p className="hint">From {r.writer_name}{r.writer_role ? `, ${r.writer_role}` : ""}{r.worked_from ? ` · worked ${r.worked_from}${r.worked_to ? ` to ${r.worked_to}` : ""}` : ""}</p>
              <details open={r.family_status === "new"}><summary>Read the letter</summary><p className="pre">{r.letter}</p></details>
              <p className="opening-actions">
                <span className={`pill${r.family_status === "kept" ? " pill-ok" : ""}`}>{r.family_status === "kept" ? "In the records" : r.family_status === "hidden" ? "Hidden" : "New"}</span>
                {isParent && r.family_status !== "kept" && <button className="btn btn-inline btn-sm" onClick={() => void run(() => sb!.rpc("family_set_reference", { p_id: r.id, p_keep: true }), "Kept in the records.")}>Keep in records</button>}
                {isParent && r.family_status !== "hidden" && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void run(() => sb!.rpc("family_set_reference", { p_id: r.id, p_keep: false }), "Hidden.")}>Hide</button>}
              </p>
            </li>
          ))}</ul>
        </section>
      )}

      {!signedIn && <p className="note note-info"><a href="/signin?next=/jobs">Sign in</a> to apply and to see your applications. Companies: <a href="/employers">hire students here</a>.</p>}

      <h2>Jobs to apply for</h2>
      <OpeningsList kinds={PART_TIME_KINDS} />
      <p className="hint" style={{ marginTop: 24 }}>Do you hire students? <a href="/employers">Make a company account</a>. Read the <a href="/employers/rules">teen job rules</a> every company agrees to.</p>
    </>
  );
}

/** The parent's "I agree": the exact consent wording, a box to tick, then Agree and send or Decline. */
export function ParentAgree({ wording, onAgree, onDecline }: { wording: string; onAgree: () => void; onDecline?: () => void }) {
  const [ticked, setTicked] = useState(false);
  return (
    <div className="note note-info" style={{ display: "grid", gap: 8 }}>
      <b>Parent consent</b>
      <span>{wording}</span>
      <label className="check"><input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} /> I agree</label>
      <span className="opening-actions">
        <button className="btn btn-inline btn-sm" disabled={!ticked} onClick={onAgree}>Agree and send</button>
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

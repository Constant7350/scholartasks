"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PART_TIME_KINDS } from "@scholartasks/core";
import { supabase } from "../../../lib/supabase";
import { pickStudent } from "../../../lib/current-student";
import { ageLabel, kindLabel, place, type PublicOpening } from "../../../lib/openings";
import { consentText, jobError, notifyJobs } from "../../../lib/jobs";
import { NotConfigured, Page } from "../../ui";
import { outsideConsentText, ParentAgree } from "../applications";
import "../../trades/trades.css";

interface Student { id: string; first_name: string; birth_date: string }
interface Fields { message: string; availability: string; email: string; phone: string; answers: string[] }
type Opening = PublicOpening & { extra_questions?: string[] };

/**
 * Apply for a weekend or holiday job inside ScholarTasks, or (?outside=1) keep track of an apprenticeship or
 * trade opening the student applied to on the company's own site. A parent always agrees, and it's logged.
 */
export default function ApplyPage() {
  const sb = supabase();
  const [o, setO] = useState<Opening | null | undefined>(undefined);
  const [outside, setOutside] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [isParent, setIsParent] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<{ version: string; wording: string } | null>(null);
  const [done, setDone] = useState<"needs_parent" | "sent" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Fields | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const q = new URLSearchParams(window.location.search);
      const id = q.get("opening") ?? "";
      const out = q.get("outside") === "1";
      setOutside(out);
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace(`/signin?next=${encodeURIComponent(`/jobs/apply?opening=${id}${out ? "&outside=1" : ""}`)}`);
      const [op, st, mem, c] = await Promise.all([
        sb.from("public_openings").select("*").eq("id", id).maybeSingle(),
        sb.from("students").select("id, first_name, birth_date").order("first_name"),
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        out ? outsideConsentText() : consentText(),
      ]);
      setO((op.data as Opening) ?? null);
      const list = (st.data as Student[]) ?? [];
      setStudents(list);
      const roles = (mem.data as { role: string; student_id: string | null }[]) ?? [];
      setIsParent(roles.some((r) => r.role === "parent"));
      const own = roles.find((r) => r.role === "student")?.student_id;
      setStudentId(own ?? pickStudent(list, list[0]?.id));
      setEmail(s.session.user.email ?? "");
      setConsent(c);
    })();
  }, [sb]);

  if (!sb) return <Page title="Apply"><NotConfigured /></Page>;
  if (o === undefined) return <Page title="Apply"><p className="hint">Loading…</p></Page>;
  const partTime = !!o && (PART_TIME_KINDS as readonly string[]).includes(o.kind);
  const back = partTime ? <a href="/jobs">← Weekend and holiday jobs</a> : <a href="/trades/openings">← Apprenticeships and local openings</a>;
  const home = partTime ? "/jobs" : "/trades/openings";
  if (!o || (outside ? o.apply_in_app : !o.apply_in_app)) {
    return <Page title="Apply"><p className="note note-info">This opening isn&apos;t taking applications this way. <a href={home}>See other openings</a>.</p></Page>;
  }
  const questions = o.extra_questions ?? [];

  const send = async (f: Fields, agree: boolean) => {
    if (!studentId) return;
    setBusy(true); setError("");
    const { data, error: e } = outside
      ? await sb.rpc("log_outside_application", { p_opening: o.id, p_student: studentId, p_note: f.message, p_parent_agree: agree })
      : await sb.rpc("apply_for_job", {
        p_opening: o.id, p_student: studentId, p_message: f.message, p_availability: f.availability, p_email: f.email, p_phone: f.phone,
        p_parent_agree: agree, p_answers: f.answers,
      });
    setBusy(false);
    if (e) return setError(jobError(e.message));
    const status = data as "needs_parent" | "sent";
    const { data: row } = await sb.from("job_applications").select("id").eq("opening_id", o.id).eq("student_id", studentId).maybeSingle();
    if (row && (status === "needs_parent" || !outside)) void notifyJobs((row as { id: string }).id, "applied");
    setDone(status);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const get = (k: string) => String(d.get(k) ?? "");
    const f: Fields = { message: get("message"), availability: get("availability"), email: get("email"), phone: get("phone"), answers: questions.map((_, i) => get(`q${i}`)) };
    if (!outside && !f.email.trim() && !f.phone.trim()) return setError("Please share an email or phone so the company can reach you.");
    if (f.answers.some((a) => !a.trim())) return setError("Please answer the company's questions.");
    // A parent reads the consent and agrees in the next step; a student's goes to a parent.
    if (isParent) return setForm(f);
    void send(f, false);
  };

  if (done) {
    return (
      <Page title="Application saved">
        <section className="panel" role="status">
          {done === "needs_parent"
            ? <><h2>✓ Sent to your parent</h2><p>We emailed your parent. Once they read it and check I agree{outside ? ", it's saved in your applications" : `, it goes to ${o.company_name}`}. You can follow it on <a href={home}>{partTime ? "Weekend and holiday jobs" : "Apprenticeships and local openings"}</a>.</p></>
            : outside
              ? <><h2>✓ Saved</h2><p>Your consent was saved. You can follow it on <a href={home}>Apprenticeships and local openings</a>, and add it to the resume if hired.</p></>
              : <><h2>✓ Sent to {o.company_name}</h2><p>Your consent was saved. The company gets the application with your email, and you can follow it on <a href={home}>Weekend and holiday jobs</a>.</p></>}
        </section>
      </Page>
    );
  }

  const who = students.find((s) => s.id === studentId);
  return (
    <Page title={outside ? `Keep track: ${o.title}` : `Apply: ${o.title}`}>
      <p className="hint">{back}</p>
      <section className="panel">
        <p><b>{o.company_name}</b> · {place(o)}</p>
        <p className="trade-tags"><span className="pill">{kindLabel(o.kind)}</span><span className="pill">{ageLabel(o.min_age)}</span></p>
        {(o.pay || o.schedule) && <p className="hint">{[o.pay, o.schedule].filter(Boolean).join(" · ")}</p>}
        <p className="pre">{o.description}</p>
        {outside && <p className="hint">Apply the company&apos;s way: <span className="pre">{o.how_to_apply}</span>{o.apply_url && <> · <a href={o.apply_url} target="_blank" rel="noreferrer nofollow">their page</a></>}</p>}
      </section>
      {form && consent ? (
        <section className="panel">
          <ParentAgree wording={consent.wording} version={consent.version} student={studentId ?? ""} button={outside ? "Agree" : "Agree and send"} onAgree={() => void send(form, true)} />
          <button className="btn btn-inline btn-sm btn-ghost" onClick={() => setForm(null)} disabled={busy}>Back</button>
          {error && <p className="note note-err" role="alert">{error}</p>}
        </section>
      ) : (
        <form className="panel opening-form" onSubmit={submit}>
          {outside && <p>Keep track of this opening in ScholarTasks. A parent agrees, you can follow it under My applications, and if you&apos;re hired it goes on your resume in one tap. Nothing is sent to the company from here.</p>}
          {students.length > 1 && isParent && (
            <div className="field"><label htmlFor="a-st">Applying for</label>
              <select className="input" id="a-st" value={studentId ?? ""} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
              </select>
            </div>
          )}
          {outside ? (
            <div className="field"><label htmlFor="a-msg">A note for yourself (optional)</label>
              <textarea className="input" id="a-msg" name="message" maxLength={2000} rows={3} placeholder="Applied online on Monday. They said they'd call within a week." />
            </div>
          ) : (
            <>
              <div className="field"><label htmlFor="a-msg">A short message to the company</label>
                <textarea className="input" id="a-msg" name="message" required minLength={10} maxLength={2000} rows={5}
                  placeholder={`Hi! I'm ${who?.first_name ?? "a student"} and I'd like to help on weekends. I'm good with people and I show up on time…`} />
              </div>
              {questions.map((q, i) => (
                <div className="field" key={q}><label htmlFor={`a-q${i}`}>{q}</label><input className="input" id={`a-q${i}`} name={`q${i}`} required maxLength={1000} /></div>
              ))}
              <div className="field"><label htmlFor="a-av">When can you work? (optional)</label><input className="input" id="a-av" name="availability" maxLength={500} placeholder="Saturdays, and every day over winter break" /></div>
              <div className="row">
                <div className="field"><label htmlFor="a-em">Email to share</label><input className="input" id="a-em" name="email" type="email" maxLength={200} defaultValue={email} /></div>
                <div className="field"><label htmlFor="a-ph">Phone to share (optional)</label><input className="input" id="a-ph" name="phone" type="tel" maxLength={30} /></div>
              </div>
              <p className="hint small">The company sees only this application: first name, grade, age, this message, your answers, when you can work, the contact you share here and a parent&apos;s email. Nothing else from ScholarTasks.</p>
            </>
          )}
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : isParent ? "Next: parent consent" : "Send to my parent to agree"}</button>
          {error && <p className="note note-err" role="alert">{error}</p>}
        </form>
      )}
    </Page>
  );
}

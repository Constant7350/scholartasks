"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../../lib/supabase";
import { pickStudent } from "../../../lib/current-student";
import { ageLabel, kindLabel, place, type PublicOpening } from "../../../lib/openings";
import { consentText, jobError, notifyJobs } from "../../../lib/jobs";
import { NotConfigured, Page } from "../../ui";
import { ParentAgree } from "../jobs-home";
import "../../trades/trades.css";

interface Student { id: string; first_name: string; birth_date: string }

/** Apply for one weekend or holiday job inside ScholarTasks. A parent always agrees before it is sent. */
export default function ApplyPage() {
  const sb = supabase();
  const [o, setO] = useState<PublicOpening | null | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [isParent, setIsParent] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<{ version: string; wording: string } | null>(null);
  const [done, setDone] = useState<"needs_parent" | "sent" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ message: string; availability: string; email: string; phone: string } | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const id = new URLSearchParams(window.location.search).get("opening") ?? "";
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace(`/signin?next=${encodeURIComponent(`/jobs/apply?opening=${id}`)}`);
      const [op, st, mem, c] = await Promise.all([
        sb.from("public_openings").select("*").eq("id", id).maybeSingle(),
        sb.from("students").select("id, first_name, birth_date").order("first_name"),
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        consentText(),
      ]);
      setO((op.data as PublicOpening) ?? null);
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
  if (!o || !o.apply_in_app) return <Page title="Apply"><p className="note note-info">This job isn&apos;t taking applications here any more. <a href="/jobs">See other jobs</a>.</p></Page>;

  const send = async (f: { message: string; availability: string; email: string; phone: string }, agree: boolean) => {
    if (!studentId) return;
    setBusy(true); setError("");
    const { data, error: e } = await sb.rpc("apply_for_job", {
      p_opening: o.id, p_student: studentId, p_message: f.message, p_availability: f.availability, p_email: f.email, p_phone: f.phone, p_parent_agree: agree,
    });
    setBusy(false);
    if (e) return setError(jobError(e.message));
    const status = data as "needs_parent" | "sent";
    const { data: row } = await sb.from("job_applications").select("id").eq("opening_id", o.id).eq("student_id", studentId).maybeSingle();
    if (row) void notifyJobs((row as { id: string }).id, "applied");
    setDone(status);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as { message: string; availability: string; email: string; phone: string };
    if (!f.email.trim() && !f.phone.trim()) return setError("Please share an email or phone so the company can reach you.");
    // A parent applying reads the consent and agrees in the next step; a student's goes to a parent.
    if (isParent) return setForm(f);
    void send(f, false);
  };

  if (done) {
    return (
      <Page title="Application saved">
        <section className="panel" role="status">
          {done === "needs_parent"
            ? <><h2>✓ Sent to your parent</h2><p>We emailed your parent. Once they read it and tick I agree, it goes to {o.company_name}. You can follow it on <a href="/jobs">Weekend and holiday jobs</a>.</p></>
            : <><h2>✓ Sent to {o.company_name}</h2><p>Your consent was saved. The company gets the application with your email, and you can follow it on <a href="/jobs">Weekend and holiday jobs</a>.</p></>}
        </section>
      </Page>
    );
  }

  const who = students.find((s) => s.id === studentId);
  return (
    <Page title={`Apply: ${o.title}`}>
      <p className="hint"><a href="/jobs">← Weekend and holiday jobs</a></p>
      <section className="panel">
        <p><b>{o.company_name}</b> · {place(o)}</p>
        <p className="trade-tags"><span className="pill">{kindLabel(o.kind)}</span><span className="pill">{ageLabel(o.min_age)}</span></p>
        {(o.pay || o.schedule) && <p className="hint">{[o.pay, o.schedule].filter(Boolean).join(" · ")}</p>}
        <p className="pre">{o.description}</p>
      </section>
      {form && consent ? (
        <section className="panel">
          <ParentAgree wording={consent.wording} onAgree={() => void send(form, true)} />
          <button className="btn btn-inline btn-sm btn-ghost" onClick={() => setForm(null)} disabled={busy}>Back</button>
          {error && <p className="note note-err" role="alert">{error}</p>}
        </section>
      ) : (
        <form className="panel opening-form" onSubmit={submit}>
          {students.length > 1 && isParent && (
            <div className="field"><label htmlFor="a-st">Applying for</label>
              <select className="input" id="a-st" value={studentId ?? ""} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
              </select>
            </div>
          )}
          <div className="field"><label htmlFor="a-msg">A short message to the company</label>
            <textarea className="input" id="a-msg" name="message" required minLength={10} maxLength={2000} rows={5}
              placeholder={`Hi! I'm ${who?.first_name ?? "a student"} and I'd like to help on weekends. I'm good with people and I show up on time…`} />
          </div>
          <div className="field"><label htmlFor="a-av">When can you work? (optional)</label><input className="input" id="a-av" name="availability" maxLength={500} placeholder="Saturdays, and every day over winter break" /></div>
          <div className="row">
            <div className="field"><label htmlFor="a-em">Email to share</label><input className="input" id="a-em" name="email" type="email" maxLength={200} defaultValue={email} /></div>
            <div className="field"><label htmlFor="a-ph">Phone to share (optional)</label><input className="input" id="a-ph" name="phone" type="tel" maxLength={30} /></div>
          </div>
          <p className="hint small">The company sees only this application: first name, grade, age, this message, when you can work, the contact you share here and a parent&apos;s email. Nothing else from ScholarTasks.</p>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : isParent ? "Next: parent consent" : "Send to my parent to agree"}</button>
          {error && <p className="note note-err" role="alert">{error}</p>}
        </form>
      )}
    </Page>
  );
}

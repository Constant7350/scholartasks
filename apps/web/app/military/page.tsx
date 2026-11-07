"use client";

import { useEffect, useState } from "react";
import { IconTabs } from "../icon-tabs";
import { MILITARY_COLLEGES, MILITARY_PATHS, SERVICE_ACADEMIES, militaryTodoDates } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { STATE_NAMES } from "../../lib/trades";

interface Student { id: string; first_name: string; state: string; grade_level: number }

/**
 * The military as a path after high school: service academies (with the
 * nomination steps), ROTC, military colleges and enlisting, with the steps
 * added to the student's To-do list in one tap.
 */
export default function MilitaryPage() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [have, setHave] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return setSignedIn(false);
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return setSignedIn(false);
      setSignedIn(true);
      const [mem, st] = await Promise.all([
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name, state, grade_level").order("first_name"),
      ]);
      const own = ((mem.data as { role: string; student_id: string | null }[]) ?? []).find((r) => r.role === "student")?.student_id;
      const list = (st.data as Student[]) ?? [];
      setStudents(list);
      setCurrent((x) => (x && list.some((s2) => s2.id === x) ? x : own ?? pickStudent(list, list[0]?.id)));
    })();
  }, [sb, setCurrent]);

  const student = students.find((s) => s.id === current);
  const home = student?.state ?? "GA";
  const today = new Date().toLocaleDateString("en-CA");
  const steps = student ? militaryTodoDates(student.grade_level, today) : [];

  useEffect(() => {
    if (!sb || !student) return;
    void sb.from("tasks").select("deadline_id").eq("student_id", student.id).like("deadline_id", "mil:%")
      .then(({ data }) => setHave(new Set(((data as { deadline_id: string }[]) ?? []).map((r) => r.deadline_id))));
  }, [sb, student]);

  const missing = steps.filter((s) => !have.has(`mil:${s.key}`));

  const add = async () => {
    if (!sb || !student) return;
    setBusy(true); setError(null); setMsg(null);
    const rows = missing.map((s) => ({
      student_id: student.id, kind: "other", status: "todo", deadline_id: `mil:${s.key}`,
      title: `Military: ${s.title}`, due_on: s.due, url: s.url ?? "/military",
    }));
    const { error: e } = await sb.from("tasks").insert(rows);
    setBusy(false);
    if (e) return setError(friendly(e));
    setHave(new Set([...have, ...rows.map((r) => r.deadline_id)]));
    setMsg(`Added ${rows.length} steps to ${student.first_name}'s To-do list.`);
  };

  const colleges = [...MILITARY_COLLEGES].sort((a, b) => Number(b.state === home) - Number(a.state === home) || a.name.localeCompare(b.name));

  return (
    <Page title="Military paths">
      <p className="hint">Serving in the military is a real path after high school, with college paid for, job training and a career. There are four main ways in. Compare them here, then talk it over as a family. Every service commitment is serious: read the contract and ask questions before signing anything.</p>

      <IconTabs label="Parts of military paths" tabs={[
        { key: "ways", icon: "🎖️", label: "Ways in", body: <>
      <section className="panel">
        <h2>Four ways in</h2>
        <div className="mil-paths" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {MILITARY_PATHS.map((p) => (
            <div key={p.id} className="panel" style={{ margin: 0 }} id={p.id}>
              <h3 style={{ marginTop: 0 }}>{p.title}</h3>
              <p>{p.summary}</p>
              <p className="hint"><b>Cost:</b> {p.cost}</p>
              <p className="hint"><b>Service after:</b> {p.serve}</p>
              <ol>{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="hint" style={{ margin: 0 }}>{p.links.map((l, i) => <span key={l.url}>{i ? " · " : ""}<a href={l.url} target="_blank" rel="noreferrer noopener">{l.label}</a></span>)}</p>
            </div>
          ))}
        </div>
      </section>
        </> },
        { key: "steps", icon: "✅", label: "Steps", body: <>
      <section className="panel">
        <h2>Steps on your To-do list</h2>
        <p className="hint">Thinking about an academy or an ROTC scholarship? The timeline starts in grade 11. Add the steps and they show on the To-do list and calendar with reminders.</p>
        {signedIn === false && <a className="btn btn-inline btn-sm" href="/signin?next=/military">Sign in to add these to a To-do list</a>}
        {signedIn && students.length === 0 && <p className="hint">Add a student on the <a href="/family">Family page</a> first.</p>}
        {signedIn && students.length > 1 && (
          <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
            {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
          </div>
        )}
        {student && (steps.length === 0
          ? <p className="hint">No dates left for grade {student.grade_level} this year. Enlisting, ROTC at college and the Guard are still open; talk with a recruiter and your school counselor.</p>
          : <>
              <ul>{steps.map((s) => <li key={s.key}>{new Date(s.due + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}: {s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}</li>)}</ul>
              {missing.length === 0
                ? <p className="hint">✓ On {student.first_name}&apos;s <a href="/todo">To-do list</a>.</p>
                : <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void add()}>{busy ? "Adding…" : `Add ${missing.length} steps to ${student.first_name}'s To-do list`}</button>}
            </>)}
        {msg && <p className="hint" role="status">{msg} <a href="/todo">Open To-do list</a></p>}
        {error && <p className="note note-err" role="alert">{error}</p>}
        <p className="hint" style={{ marginBottom: 0 }}>Dates are typical. Each academy, ROTC program and congressional office sets its own deadlines every year: check their sites.</p>
      </section>
        </> },
        { key: "academies", icon: "🏛️", label: "Academies", body: <>
      <section className="panel">
        <h2>The five service academies</h2>
        <p className="hint">Free college with a monthly stipend, then about 5 years of service. Very selective: strong grades, scores, sports, leadership and fitness all count.</p>
        <ul className="items">
          {SERVICE_ACADEMIES.map((a) => (
            <li key={a.id}>
              <div className="item-main">
                <b>{a.short}</b>
                <span className="hint">{a.state} · {a.branch} · {a.nomination ? "Nomination needed" : "No nomination needed"} · Summer program: {a.summer}</span>
                <span className="hint">{a.note}</span>
              </div>
              <div className="item-actions"><a className="btn btn-ghost btn-inline btn-sm" href={a.url} target="_blank" rel="noreferrer noopener">Admissions</a></div>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ marginBottom: 0 }}><b>Nominations:</b> apply to both of your U.S. senators and your U.S. representative (each picks a few students a year), and the Vice President. Children of service members and veterans can have extra nomination routes. <a href="https://www.house.gov/representatives/find-your-representative" target="_blank" rel="noreferrer noopener">Find your representative</a> · <a href="https://www.senate.gov/senators/senators-contact.htm" target="_blank" rel="noreferrer noopener">Find your senators</a></p>
      </section>
        </> },
        { key: "colleges", icon: "🏫", label: "Colleges", body: <>
      <section className="panel">
        <h2>Military colleges</h2>
        <p className="hint">{STATE_NAMES[home] ?? "Your state"} first, then the rest of the U.S. These are regular colleges with a corps of cadets; you can also pick them on <a href="/colleges">Find colleges</a> (What kind of college? Military academies and colleges) to see a yearly price for your family.</p>
        <ul className="items">
          {colleges.map((c) => (
            <li key={c.id}>
              <div className="item-main">
                <b>{c.name}</b>
                <span className="hint">{c.state} · {c.kind === "senior" ? "Senior military college" : "Military junior college (two years)"}</span>
                <span className="hint">{c.note}</span>
              </div>
              <div className="item-actions"><a className="btn btn-ghost btn-inline btn-sm" href={c.url} target="_blank" rel="noreferrer noopener">Website</a></div>
            </li>
          ))}
        </ul>
      </section>
        </> },
        { key: "paying", icon: "💰", label: "Paying", body: <>
      <section className="panel">
        <h2>Paying for college through service</h2>
        <ul>
          <li><b>ROTC scholarships</b> can pay full tuition plus books and a monthly stipend at colleges that host ROTC.</li>
          <li><b>Tuition Assistance</b> helps pay for college classes while you serve (most branches pay up to about $250 a credit hour, with a yearly limit).</li>
          <li><b>The Post-9/11 GI Bill</b> can pay full in-state tuition at public colleges, plus housing, after enough active service; it also pays for trade school and apprenticeships.</li>
          <li><b>National Guard</b> members serve part time and get state and federal tuition help. {home === "GA" ? <>In Georgia, ask about the Georgia National Guard Service Cancelable Loan on <a href="https://www.gafutures.org" target="_blank" rel="noreferrer noopener">GAfutures</a>.</> : "Ask your state's Guard about state tuition benefits."}</li>
          <li>Military jobs teach trades too (mechanics, electrical, aviation, medical, IT). See <a href="/trades">Trades and trade schools</a> for civilian training.</li>
        </ul>
        <p className="hint" style={{ marginBottom: 0 }}>Amounts and rules change. Confirm with <a href="https://www.va.gov/education/about-gi-bill-benefits/" target="_blank" rel="noreferrer noopener">VA.gov</a>, the branch and the college. This is advice to help you compare; the choice is your family&apos;s.</p>
      </section>
        </> },
      ]} />

    </Page>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APPLICATION_STATUS, applicationProgress, buildScorecard, countWords, daysLeft, displayGpa, letterRequest, lettersNeeded,
  packetProblems, questionsFromPrompts, suggestAnswers, suggestedDocs, thankYouStarter,
  type ApplicationStatus, type CourseGrade, type DocItem, type FormAnswer, type Recommender, type SavedAnswer, type SchoolPacket,
} from "@scholartasks/core";
import { PLAIN_GPA } from "../../../lib/state-packs";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { CopyButton } from "../../copy-button";
import { ApplyHelp, type Steps } from "../apply-help";
import { CATEGORIES, REC_ROLES, gradeText, type Activity } from "../../activities/shared";
import type { Choice, Row } from "../types";

interface Student {
  id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null;
  high_school?: string | null; grad_year?: number | null; weight_rigor?: number; weight_honors?: number;
  permissions?: Record<string, boolean>;
}
interface App {
  id: string; student_id: string; scholarship_id: string; status: ApplicationStatus;
  answers: FormAnswer[]; docs: DocItem[]; recommenders: Recommender[];
  submitted_on: string | null; confirmation: string | null; heard_on: string | null; amount_won: number | null; thanked: boolean; notes: string | null;
}
interface Submission { id: string; status: "new" | "reviewing" | "awarded" | "not_awarded"; school_note: string | null; sent_at: string; packet: SchoolPacket }
interface GradeRow { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }
interface LetterWriter { id: string; name: string; role: string }

const today = () => new Date().toISOString().slice(0, 10);
const dateText = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const SCHOOL_STATUS: Record<Submission["status"], string> = {
  new: "Sent. Your school has it.", reviewing: "Your school is reviewing it.", awarded: "Your school chose you! 🎉", not_awarded: "Your school chose someone else this time.",
};

/**
 * One scholarship, start to finish: what the form asks, papers and letters, sending it
 * (on the official site, or to your school right here for your school's own awards) and what happened.
 */
export default function ApplyWorkspace() {
  const sb = supabase();
  const [s, setS] = useState<Row | null | undefined>(undefined);
  const [student, setStudent] = useState<Student | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [app, setApp] = useState<App | null>(null);
  const [sub, setSub] = useState<Submission | null>(null);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  const [saved, setSaved] = useState<SavedAnswer[]>([]);
  const [writers, setWriters] = useState<LetterWriter[]>([]);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const q = new URLSearchParams(window.location.search);
    const id = q.get("id");
    const { data: ses } = await sb.auth.getSession();
    if (!ses.session) return window.location.replace(`/signin?next=${encodeURIComponent("/scholarships/apply" + window.location.search)}`);
    if (!id) return setS(null);
    const [sc, mem, sts] = await Promise.all([
      sb.from("scholarships").select("*").eq("id", id).maybeSingle(),
      sb.from("family_members").select("role, student_id").eq("user_id", ses.session.user.id),
      sb.from("students").select("*").order("first_name"),
    ]);
    const list = (sts.data as Student[]) ?? [];
    const own = ((mem.data as { role: string; student_id: string | null }[]) ?? []).find((m) => m.role === "student")?.student_id;
    const want = q.get("student") ?? own ?? null;
    const st = list.find((x) => x.id === want) ?? list[0] ?? null;
    setS((sc.data as Row) ?? null);
    setStudent(st);
    if (!sc.data || !st) return;
    const [ch, ap, su, gr, ac, es, rc, ln] = await Promise.all([
      sb.from("scholarship_choices").select("id, student_id, scholarship_id, choice, task_id, done_steps, essay_draft").eq("student_id", st.id).eq("scholarship_id", id).maybeSingle(),
      sb.from("scholarship_applications").select("*").eq("student_id", st.id).eq("scholarship_id", id).maybeSingle(),
      sb.from("school_scholarship_submissions").select("id, status, school_note, sent_at, packet").eq("student_id", st.id).eq("scholarship_id", id).maybeSingle(),
      sb.from("course_grades").select("course, grade, level, core, grade_level, term").eq("student_id", st.id),
      sb.from("student_activities").select("*").eq("student_id", st.id).order("sort_order").order("created_at"),
      sb.from("student_essays").select("id, title, prompt, draft").eq("student_id", st.id).order("created_at"),
      sb.from("recommenders").select("id, name, role").eq("student_id", st.id).order("created_at"),
      sb.rpc("my_school_links"),
    ]);
    setChoice((ch.data as Choice) ?? null);
    setSub((su.data as Submission) ?? null);
    setGrades((gr.data as GradeRow[]) ?? []);
    setActs((ac.data as Activity[]) ?? []);
    setSaved(((es.data as SavedAnswer[]) ?? []).map((e) => ({ ...e, draft: e.draft ?? "" })));
    setWriters((rc.data as LetterWriter[]) ?? []);
    const row = sc.data as Row;
    setLinked(!!row.school_id && ((ln.data as { school_id: string; student_id: string; status: string }[]) ?? [])
      .some((l) => l.student_id === st.id && l.status === "active" && l.school_id === row.school_id));
    let a = ap.data as App | null;
    if (!a) {
      // First visit: start the workspace with the papers and letters the award's own words ask for.
      const text = [row.how_to_apply, row.summary, row.other_requirements].filter(Boolean).join(" ");
      const ins = await sb.from("scholarship_applications").insert({
        student_id: st.id, scholarship_id: id, docs: suggestedDocs(text, { needBased: !!row.need_based }),
        recommenders: [],
      }).select("*").single();
      if (ins.error) setError(friendly(ins.error));
      a = (ins.data as App) ?? null;
    }
    setApp(a);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (patch: Partial<App>) => {
    if (!sb || !app) return;
    const next = { ...app, ...patch };
    setApp(next);
    setError(null);
    const { error: e } = await sb.from("scholarship_applications").update(patch).eq("id", app.id);
    if (e) setError(friendly(e));
  }, [sb, app]);

  const onSteps = useCallback((st: Steps) => {
    // The essay prompts from the official page become the form questions, once.
    setApp((a) => {
      if (!a || a.answers.length || !st.essay_prompts.length) return a;
      const answers = questionsFromPrompts(st.essay_prompts);
      void sb?.from("scholarship_applications").update({ answers }).eq("id", a.id);
      return { ...a, answers };
    });
  }, [sb]);

  const card = useMemo(() => {
    if (!student || !grades.length) return null;
    const cg: CourseGrade[] = grades.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
    return buildScorecard(cg, { currentGrade: student.grade_level, formula: PLAIN_GPA, target: 3, schoolWeights: { rigor: Number(student.weight_rigor ?? 1), honors: Number(student.weight_honors ?? 0.5) } });
  }, [student, grades]);

  const title = "Apply";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (s === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!s || !student) return <Page title={title}><p className="hint">We couldn&apos;t find that scholarship. <a href="/scholarships">Back to scholarships</a></p></Page>;

  const left = daysLeft(s.deadline);
  const gpa = card?.overallGpa != null ? displayGpa(card.overallGpa) : "";
  const letters = lettersNeeded([s.how_to_apply, s.summary, s.other_requirements].filter(Boolean).join(" "));
  const prog = app ? applicationProgress({ ...app, lettersNeeded: letters }) : null;
  const inApp = !!s.school_id;

  return (
    <Page title={s.name}>
      <p className="hint"><a href="/scholarships">← Scholarships</a> · <a href="/activities/profile">Copy-ready profile</a> · <a href="/essays">Essays</a></p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      <section className="panel">
        <div className="score-head">
          <div>
            <b className="sch-amount" style={{ fontSize: 20 }}>{s.amount_text}</b>
            <div className="hint" style={{ fontSize: 14 }}>From {s.sponsor}{inApp && <> · <span className="pill pill-ok">Apply right here</span></>}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            {app && <span className={`pill ${app.status === "won" ? "pill-ok" : app.status === "getting_ready" ? "pill-soon" : ""}`}>{APPLICATION_STATUS[app.status]}</span>}
            <div className="hint" style={{ fontSize: 14 }}>
              {s.deadline ? <>Due {dateText(s.deadline)}{left !== null && app?.status === "getting_ready" && <b style={{ color: left < 7 ? "var(--err)" : undefined }}> · {left < 0 ? "deadline passed" : left === 0 ? "today" : `${left} day${left === 1 ? "" : "s"} left`}</b>}</> : s.deadline_text ?? "Check the deadline on the official site"}
            </div>
          </div>
        </div>
        <p style={{ margin: "10px 0 6px" }}>{s.summary}</p>
        {s.how_to_apply && <p className="hint" style={{ margin: 0 }}><b>How to apply:</b> {s.how_to_apply}</p>}
        {prog && (
          <div style={{ marginTop: 12 }}>
            <div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: `${Math.round((prog.done / Math.max(prog.total, 1)) * 100)}%` }} /></div>
            <p className="hint" style={{ margin: "6px 0 0" }} role="status">{prog.done} of {prog.total} done{prog.next ? <> · <b>Next:</b> {prog.next}</> : ""}</p>
          </div>
        )}
      </section>

      {!choice ? (
        <p className="note note-info">Save this scholarship on the <a href="/scholarships">Scholarships</a> page to get the checklist and essay coach here.</p>
      ) : (
        <section className="panel"><ApplyHelp s={s} choice={choice} startOpen onSteps={onSteps} /></section>
      )}

      {app && (
        <>
          <Questions app={app} saved={saved} onSave={save} />
          <Papers app={app} letters={letters} writers={writers} student={student} s={s} onSave={save} onWriterAdded={(w) => setWriters([...writers, w])} />
          {inApp ? (
            <SendToSchool s={s} student={student} app={app} sub={sub} linked={linked} gpa={gpa} acts={acts} essay={choice?.essay_draft ?? ""} onSent={load} />
          ) : (
            <SendOfficial s={s} student={student} app={app} gpa={gpa} choice={choice} onSave={save} />
          )}
          {app.status !== "getting_ready" && <AfterYouApply s={s} student={student} app={app} sub={sub} onSave={save} />}
        </>
      )}
      <p className="hint" style={{ marginTop: 20, fontSize: 13 }}>
        ScholarTasks helps you get ready and keep track. Write every answer in your own words, and always check the official rules.
      </p>
    </Page>
  );
}

/** The questions on the form, with saved answers to start from. */
function Questions({ app, saved, onSave }: { app: App; saved: SavedAnswer[]; onSave: (p: Partial<App>) => Promise<void> }) {
  const [list, setList] = useState<FormAnswer[]>(app.answers);
  const [newQ, setNewQ] = useState("");
  useEffect(() => setList(app.answers), [app.answers]);
  const put = (i: number, patch: Partial<FormAnswer>) => setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const commit = (next = list) => void onSave({ answers: next });
  return (
    <section className="panel">
      <h2>1. Questions on the form</h2>
      <p className="hint">Copy each question from the application, then answer it here, so everything is in one place and saved. Short answers you wrote on the <a href="/essays">Essays</a> page show up as a starting point.</p>
      {list.length === 0 && <p className="hint">No questions yet. Add the first one below.</p>}
      <ol className="sch-steps">
        {list.map((x, i) => {
          const words = countWords(x.a);
          const ideas = x.a.trim() ? [] : suggestAnswers(x.q, saved);
          return (
            <li key={i} style={{ marginBottom: 14 }}>
              <b>{x.q}</b>
              <textarea className="input" rows={4} style={{ marginTop: 6 }} value={x.a} maxLength={8000} aria-label={`Answer: ${x.q}`}
                onChange={(e) => put(i, { a: e.target.value })} onBlur={() => commit()} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                <span className="hint" style={{ color: x.limit && words > x.limit ? "var(--err)" : undefined }}>{words} words{x.limit ? ` of ${x.limit}` : ""}</span>
                <CopyButton text={x.a} label="Copy answer" />
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => { const next = list.filter((_, j) => j !== i); setList(next); commit(next); }}>Remove</button>
              </div>
              {ideas.length > 0 && (
                <p className="hint" style={{ margin: "6px 0 0" }}>Start from what you wrote before:{" "}
                  {ideas.map((d) => <button key={d.id} className="btn btn-ghost btn-inline btn-sm" onClick={() => { const next = list.map((y, j) => (j === i ? { ...y, a: d.draft } : y)); setList(next); commit(next); }}>{d.title}</button>)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="input" style={{ flex: "1 1 280px" }} placeholder="Paste a question from the form" value={newQ} onChange={(e) => setNewQ(e.target.value)} maxLength={1000} />
        <button className="btn btn-inline btn-sm" disabled={!newQ.trim()} onClick={() => { const next = [...list, ...questionsFromPrompts([newQ])]; setList(next); setNewQ(""); commit(next); }}>Add question</button>
      </div>
    </section>
  );
}

/** Papers to gather and letters to ask for. */
function Papers({ app, letters, writers, student, s, onSave, onWriterAdded }: {
  app: App; letters: number; writers: LetterWriter[]; student: Student; s: Row;
  onSave: (p: Partial<App>) => Promise<void>; onWriterAdded: (w: LetterWriter) => void;
}) {
  const sb = supabase();
  const [newDoc, setNewDoc] = useState("");
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const recs = app.recommenders;
  const setRec = (i: number, patch: Partial<Recommender>) => void onSave({ recommenders: recs.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRec = async () => {
    const w = writers.find((x) => x.id === pick);
    const n = (w?.name ?? name).trim();
    if (!n) return;
    if (!w && sb) {
      // Keep one list of letter writers: new names also go on the Beyond grades list.
      const { data } = await sb.from("recommenders").insert({ student_id: student.id, name: n, role: "teacher" }).select("id, name, role").single();
      if (data) onWriterAdded(data as LetterWriter);
    }
    void onSave({ recommenders: [...recs, { name: n, role: w?.role ?? "teacher", email: null, asked_on: null, received: false }] });
    setPick(""); setName("");
  };
  return (
    <section className="panel">
      <h2>2. Papers and letters</h2>
      {app.docs.length === 0 && <p className="hint">Nothing extra found in the rules. Add anything the form asks for.</p>}
      <ul className="items">
        {app.docs.map((d, i) => (
          <li key={d.name} className={d.done ? "is-done" : ""}>
            <label className="item-main" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={d.done} onChange={() => void onSave({ docs: app.docs.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} style={{ marginTop: 4 }} />
              <b>{d.name}</b>
            </label>
            <div className="item-actions">
              {d.link && <a className="btn btn-ghost btn-inline btn-sm link-btn" href={d.link}>Open</a>}
              <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onSave({ docs: app.docs.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input className="input" style={{ flex: "1 1 240px" }} placeholder="Something else the form asks for" value={newDoc} maxLength={200} onChange={(e) => setNewDoc(e.target.value)} />
        <button className="btn btn-ghost btn-inline btn-sm" disabled={!newDoc.trim() || app.docs.some((d) => d.name === newDoc.trim())}
          onClick={() => { void onSave({ docs: [...app.docs, { name: newDoc.trim(), done: false }] }); setNewDoc(""); }}>Add</button>
      </div>

      <h3 style={{ margin: "18px 0 6px" }}>Letters of recommendation{letters ? ` (asks for ${letters})` : ""}</h3>
      {!letters && !recs.length && <p className="hint">The rules don&apos;t mention letters. If the form asks for one, add who will write it.</p>}
      <ul className="items">
        {recs.map((r, i) => {
          const mail = letterRequest({ student: student.first_name, recommender: r.name, award: s.name, deadline: s.deadline, howToSend: s.how_to_apply });
          return (
            <li key={`${r.name}-${i}`} className={r.received ? "is-done" : ""}>
              <div className="item-main">
                <b>{r.name}</b>
                <span className="hint">{REC_ROLES[r.role ?? "other"] ?? r.role} · {r.received ? "Letter sent ✓" : r.asked_on ? `Asked ${dateText(r.asked_on)}` : "Not asked yet"}</span>
                <input className="input" type="email" style={{ maxWidth: 300, marginTop: 4 }} placeholder="Their email (to ask in one tap)" defaultValue={r.email ?? ""}
                  onBlur={(e) => { if ((e.target.value.trim() || null) !== (r.email ?? null)) setRec(i, { email: e.target.value.trim() || null }); }} />
              </div>
              <div className="item-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                {!r.asked_on && (
                  <a className="btn btn-inline btn-sm link-btn" href={`mailto:${encodeURIComponent(r.email ?? "")}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`}
                    onClick={() => setRec(i, { asked_on: today() })}>Ask by email</a>
                )}
                <CopyButton text={mail.body} label="Copy the ask" />
                <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={r.received} onChange={() => setRec(i, { received: !r.received, asked_on: r.asked_on ?? today() })} /> Letter sent
                </label>
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onSave({ recommenders: recs.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {writers.length > 0 && (
          <select className="input" style={{ flex: "1 1 200px" }} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pick a letter writer">
            <option value="">Pick from my letter writers…</option>
            {writers.filter((w) => !recs.some((r) => r.name === w.name)).map((w) => <option key={w.id} value={w.id}>{w.name} ({REC_ROLES[w.role] ?? w.role})</option>)}
          </select>
        )}
        {!pick && <input className="input" style={{ flex: "1 1 200px" }} placeholder="Or type a name, e.g. Ms. Lee" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
        <button className="btn btn-ghost btn-inline btn-sm" disabled={!pick && !name.trim()} onClick={() => void addRec()}>Add letter writer</button>
      </div>
      <p className="hint small" style={{ marginTop: 6 }}>Give writers at least two weeks. A <a href="/activities">brag sheet</a> helps them write a strong letter.</p>
    </section>
  );
}

/** For awards applied to on their own website: everything to paste, then "I sent it". */
function SendOfficial({ s, student, app, gpa, choice, onSave }: {
  s: Row; student: Student; app: App; gpa: string; choice: Choice | null; onSave: (p: Partial<App>) => Promise<void>;
}) {
  const sb = supabase();
  const [on, setOn] = useState(app.submitted_on ?? today());
  const [conf, setConf] = useState(app.confirmation ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const facts: [string, string][] = ([
    ["First name", student.first_name], ["High school", student.high_school ?? ""], ["Graduation year", student.grad_year ? String(student.grad_year) : ""],
    ["GPA (unweighted)", gpa], ["SAT", student.sat ? String(student.sat) : ""], ["ACT", student.act ? String(student.act) : ""],
  ] as [string, string][]).filter(([, v]) => v);
  const markSent = async () => {
    setMsg(null);
    await onSave({ status: "submitted", submitted_on: on || today(), confirmation: conf.trim() || null });
    // Check off the deadline on the plan too (it waits for a parent's OK when the student needs approval).
    if (choice?.task_id && sb) {
      const may = student.permissions?.mark_done_without_approval !== false;
      const r = await sb.from("tasks").update({ status: "done" }).eq("id", choice.task_id);
      if (r.error && !may) await sb.from("tasks").update({ status: "needs_parent_approval" }).eq("id", choice.task_id);
    }
    setMsg("Marked as sent. Good luck!");
  };
  return (
    <section className="panel">
      <h2>3. Send it</h2>
      <p className="hint">This award takes applications on its own website. Open it next to this page, then copy and paste your answers.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}>
        <a className="btn btn-inline" href={s.url} target="_blank" rel="noopener noreferrer">Open the application ↗</a>
        <a className="btn btn-ghost btn-inline" href="/activities/profile">All my copy-ready answers</a>
      </div>
      <ul className="items">
        {facts.map(([k, v]) => (
          <li key={k}><div className="item-main"><span className="hint">{k}</span><span>{v}</span></div><div className="item-actions"><CopyButton text={v} /></div></li>
        ))}
        {app.answers.filter((x) => x.a.trim()).map((x, i) => (
          <li key={i}><div className="item-main"><span className="hint">{x.q}</span><span style={{ whiteSpace: "pre-wrap" }}>{x.a.length > 220 ? x.a.slice(0, 217) + "…" : x.a}</span></div><div className="item-actions"><CopyButton text={x.a} /></div></li>
        ))}
        {choice?.essay_draft?.trim() && (
          <li><div className="item-main"><span className="hint">Essay · {countWords(choice.essay_draft)} words</span><span>{choice.essay_draft.slice(0, 160)}…</span></div><div className="item-actions"><CopyButton text={choice.essay_draft} label="Copy essay" /></div></li>
        )}
      </ul>
      {app.status === "getting_ready" ? (
        <div className="panel" style={{ marginTop: 12, background: "var(--warm-tint)" }}>
          <b>Done on the official site?</b>
          <div className="row" style={{ marginTop: 8 }}>
            <div className="field" style={{ flex: "0 1 180px" }}><label htmlFor="sent-on">Sent on</label><input id="sent-on" type="date" className="input" value={on} onChange={(e) => setOn(e.target.value)} /></div>
            <div className="field"><label htmlFor="conf">Confirmation number (if you got one)</label><input id="conf" className="input" value={conf} maxLength={200} onChange={(e) => setConf(e.target.value)} /></div>
          </div>
          <button className="btn btn-inline" onClick={() => void markSent()}>I sent it ✓</button>
        </div>
      ) : (
        <p className="note note-ok" role="status">Sent {app.submitted_on ? dateText(app.submitted_on) : ""}{app.confirmation ? ` · Confirmation ${app.confirmation}` : ""}.{" "}
          <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onSave({ status: "getting_ready", submitted_on: null })}>Undo</button></p>
      )}
      {msg && <p className="hint" role="status">{msg}</p>}
    </section>
  );
}

/** For a school's own local award: send the application to the school right here. */
function SendToSchool({ s, student, app, sub, linked, gpa, acts, essay, onSent }: {
  s: Row; student: Student; app: App; sub: Submission | null; linked: boolean; gpa: string; acts: Activity[]; essay: string; onSent: () => void;
}) {
  const sb = supabase();
  const [fullName, setFullName] = useState(sub?.packet.full_name ?? "");
  const [email, setEmail] = useState(sub?.packet.email ?? "");
  const [inc, setInc] = useState({ scores: true, activities: true, essay: !!essay.trim() });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const activities = acts.filter((a) => a.kind === "activity").map((a) => `${a.position}${a.organization ? `, ${a.organization}` : ""} (${CATEGORIES[a.category] ?? a.category}, ${gradeText(a.grades)})${a.description ? `: ${a.description}` : ""}`);
  const honors = acts.filter((a) => a.kind === "honor").map((h) => `${h.position}${h.grades.length ? ` (${gradeText(h.grades)})` : ""}`);
  const packet: SchoolPacket = {
    full_name: fullName.trim(), email: email.trim() || null, grade_level: student.grade_level, high_school: student.high_school ?? null,
    ...(inc.scores ? { gpa: gpa || null, sat: student.sat, act: student.act } : {}),
    ...(inc.activities ? { activities, honors } : {}),
    answers: app.answers.map((x) => ({ q: x.q, a: x.a })),
    essay: inc.essay && essay.trim() ? { prompt: "Essay", text: essay } : null,
    letters: app.recommenders.map((r) => r.name),
  };
  const problems = packetProblems(packet);
  const locked = !!sub && sub.status !== "new";
  const send = async () => {
    if (!sb) return;
    setBusy(true); setMsg(null);
    const { error } = await sb.rpc("send_school_application", { p_student: student.id, p_scholarship: s.id, p_packet: packet });
    setBusy(false);
    if (error) return setMsg(friendly(error));
    setMsg(sub ? "Updated. Your school has the new version." : `Sent to ${s.sponsor}. 🎉`);
    onSent();
  };
  const withdraw = async () => {
    if (!sb || !sub) return;
    const { error } = await sb.rpc("withdraw_school_application", { p_id: sub.id });
    if (error) return setMsg(friendly(error));
    setMsg("Taken back. You can send it again before the deadline.");
    onSent();
  };
  return (
    <section className="panel">
      <h2>3. Send it to {s.sponsor}</h2>
      {!linked && !sub ? (
        <p className="note note-info">This is your school&apos;s own scholarship, so you can send it right here. First connect to your school on the <a href="/my-school">My school</a> page (it takes a minute and a parent may need to approve).</p>
      ) : locked ? (
        <p className="hint">Your school is reviewing it, so it can&apos;t be changed now. Questions? Ask your school counselor.</p>
      ) : (
        <>
          <p className="hint">Only the counselors at {s.sponsor} will see what you send, and only for this scholarship. You choose what goes in.</p>
          <div className="row">
            <div className="field"><label htmlFor="full-name">Your full name (as the school knows you)</label><input id="full-name" className="input" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="field"><label htmlFor="sch-email">Email the school can reach you at (optional)</label><input id="sch-email" type="email" className="input" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <p className="checkin-label" style={{ margin: "10px 0 4px" }}>Include:</p>
          <label style={{ display: "block" }}><input type="checkbox" checked disabled /> Your answers to the form questions ({app.answers.length})</label>
          <label style={{ display: "block" }}><input type="checkbox" checked={inc.scores} onChange={() => setInc({ ...inc, scores: !inc.scores })} /> GPA and test scores{gpa ? ` (GPA ${gpa})` : ""}</label>
          <label style={{ display: "block" }}><input type="checkbox" checked={inc.activities} onChange={() => setInc({ ...inc, activities: !inc.activities })} /> Activities and honors ({activities.length + honors.length})</label>
          <label style={{ display: "block" }}><input type="checkbox" checked={inc.essay} disabled={!essay.trim()} onChange={() => setInc({ ...inc, essay: !inc.essay })} /> Your essay{essay.trim() ? ` (${countWords(essay)} words)` : " (write it in the essay coach above)"}</label>
          {app.recommenders.length > 0 && <p className="hint small">Your letter writers&apos; names go in too. They send their letters to the school the way the school asks.</p>}
          {problems.length > 0 && <ul className="gaps">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn btn-inline" disabled={busy || problems.length > 0} onClick={() => void send()}>{busy ? "Sending…" : sub ? "Send the new version" : `Send to ${s.sponsor}`}</button>
            {sub?.status === "new" && <button className="btn btn-ghost btn-inline" onClick={() => void withdraw()}>Take it back</button>}
          </div>
        </>
      )}
      {sub && <p className={`note ${sub.status === "awarded" ? "note-ok" : "note-info"}`} role="status" style={{ marginTop: 10 }}>{SCHOOL_STATUS[sub.status]} Sent {new Date(sub.sent_at).toLocaleDateString()}.{sub.school_note ? ` Note from your school: “${sub.school_note}”` : ""}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
    </section>
  );
}

/** Heard back? Won, not this time, and the thank-you note. */
function AfterYouApply({ s, student, app, sub, onSave }: { s: Row; student: Student; app: App; sub: Submission | null; onSave: (p: Partial<App>) => Promise<void> }) {
  const [amount, setAmount] = useState(app.amount_won ? String(app.amount_won) : s.amount_max ? String(s.amount_max) : "");
  const decidedBySchool = !!sub && (sub.status === "awarded" || sub.status === "not_awarded");
  const note = thankYouStarter({ student: student.first_name, award: s.name, giver: s.sponsor });
  return (
    <section className="panel">
      <h2>4. After you apply</h2>
      {app.status === "submitted" && !decidedBySchool && (
        <>
          <p className="hint">Did you hear back? Most awards answer within one to three months.</p>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "0 1 180px" }}><label htmlFor="won-amt">Amount won ($)</label><input id="won-amt" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></div>
            <button className="btn btn-inline" onClick={() => void onSave({ status: "won", amount_won: amount ? Math.min(Number(amount), 1000000) : null, heard_on: today() })}>We won 🎉</button>
            <button className="btn btn-ghost btn-inline" onClick={() => void onSave({ status: "not_won", heard_on: today() })}>Not this time</button>
          </div>
        </>
      )}
      {app.status === "won" && (
        <>
          <p className="note note-ok">Congratulations! {app.amount_won ? `$${app.amount_won.toLocaleString()} won.` : ""}{decidedBySchool ? "" : " "}</p>
          {decidedBySchool && app.amount_won == null && (
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "0 1 180px" }}><label htmlFor="won-amt2">Amount won ($)</label><input id="won-amt2" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></div>
              <button className="btn btn-ghost btn-inline" onClick={() => void onSave({ amount_won: amount ? Math.min(Number(amount), 1000000) : null })}>Save amount</button>
            </div>
          )}
          <ul className="gaps">
            <li>Tell your college&apos;s financial aid office about the award. It can change your aid package.</li>
            <li>Send a thank-you note. Start from this and finish it in your own words:</li>
          </ul>
          <pre id="thanks" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--warm-tint)", padding: 12, borderRadius: 10 }}>{note}</pre>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <CopyButton text={note} targetId="thanks" label="Copy the note" />
            <label className="hint"><input type="checkbox" checked={app.thanked} onChange={() => void onSave({ thanked: !app.thanked })} /> Thank-you sent</label>
          </div>
        </>
      )}
      {app.status === "not_won" && <p className="hint">That&apos;s OK. Most students win some and miss some. Your answers are saved here and on the <a href="/essays">Essays</a> page, so the next one is faster.</p>}
      {(app.status === "won" || app.status === "not_won") && !decidedBySchool && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onSave({ status: "submitted", heard_on: null })}>Change answer</button>}
    </section>
  );
}

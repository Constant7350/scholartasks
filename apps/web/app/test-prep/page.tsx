"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PAYWALL_ON } from "../../lib/prices";
import type { StatePack } from "@scholartasks/core";
import gaPack from "../../../../packs/states/GA.json";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { loadStudy, type StudyContext } from "../study/context";
import { BLUEPRINT, estimate, pickQuestions, type Exam, type Section } from "./scoring";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { ReportAi } from "../report-ai";

interface Question { id: string; exam: Exam; subject: string; topic: string; passage: string | null; question: string; options: string[]; answer_index: number; explanation: string | null; status: string }
interface Attempt { question_id: string; correct: boolean; created_at: string }
interface Result { id: string; exam: Exam; sections: Record<string, { right: number; total: number; estimate: number }>; estimate: number; created_at: string }
interface Scores { id: string; sat: number | null; act: number | null }
interface Tutor { feedback: string; next_step: string }

// Full timed practice tests belong to the "Study Coach" add-on. Billing isn't
// switched on yet (PAYWALL_ON in lib/prices.ts), so everyone gets them in beta.
const STUDY_COACH_OPEN = !PAYWALL_ON;
const DRILL = 10;

const zell = (gaPack as unknown as StatePack).programs.find((p) => p.id === "ga-zell")?.rules as { tests_any?: { sat?: number; act?: number } } | undefined;

type Run =
  | { kind: "drill"; section: Section; qs: Question[]; i: number; picked: number | null; right: number }
  | { kind: "test"; exam: Exam; parts: { section: Section; qs: Question[] }[]; part: number; i: number; answers: Record<string, number>; flags: Record<string, boolean>; endsAt: number; startedAt: number }
  | { kind: "done"; exam: Exam; parts: { section: Section; qs: Question[] }[]; answers: Record<string, number>; minutes: number };

/** Underline the [[marked]] part of an ACT English sentence. */
function Marked({ text }: { text: string }) {
  const bits = text.split(/(\[\[.+?\]\])/g);
  return <>{bits.map((b, k) => (b.startsWith("[[") ? <u key={k} className="tp-underline">{b.slice(2, -2)}</u> : <span key={k}>{b}</span>))}</>;
}

function Passage({ text }: { text: string }) {
  return <div className="tp-passage">{text.split(/\n\s*\n/).map((p, k) => <p key={k}><Marked text={p} /></p>)}</div>;
}

export default function TestPrepPage() {
  const sb = supabase();
  const [ctx, setCtx] = useState<StudyContext | null>(null);
  const [current, setCurrent] = useCurrentStudent();
  const [exam, setExam] = useState<Exam>("SAT");
  const [bank, setBank] = useState<Question[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [scores, setScores] = useState<Scores[]>([]);
  const [science, setScience] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(Date.now());
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/test-prep");
      const [c, q, sc] = await Promise.all([
        loadStudy(sb, s.session.user.id),
        sb.from("practice_questions").select("id, exam, subject, topic, passage, question, options, answer_index, explanation, status").not("exam", "is", null).eq("kind", "mc").order("created_at"),
        sb.from("students").select("id, sat, act"),
      ]);
      setCtx(c);
      setCurrent(c.own ?? pickStudent(c.students, c.students[0]?.id));
      setBank(q.error ? [] : ((q.data as Question[]) ?? []));
      setScores((sc.data as Scores[]) ?? []);
    })();
  }, [sb]);

  const loadHistory = useCallback(async () => {
    if (!sb || !current || !bank) return;
    const ids = bank.map((q) => q.id);
    const [a, r] = await Promise.all([
      ids.length ? sb.from("practice_attempts").select("question_id, correct, created_at").eq("student_id", current).in("question_id", ids).order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
      sb.from("test_prep_results").select("id, exam, sections, estimate, created_at").eq("student_id", current).order("created_at", { ascending: false }).limit(50),
    ]);
    setAttempts((a.data as Attempt[]) ?? []);
    setResults((r.data as Result[]) ?? []);
  }, [sb, current, bank]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Section timer for practice tests.
  useEffect(() => {
    if (run?.kind !== "test") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run?.kind]);

  // When each question was last answered, so new drills and tests show unseen questions first.
  const lastSeen = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attempts) { const t = Date.parse(a.created_at); if (!(m.get(a.question_id)! >= t)) m.set(a.question_id, t); }
    return m;
  }, [attempts]);
  const byId = useMemo(() => new Map((bank ?? []).map((q) => [q.id, q])), [bank]);
  const plan = useMemo(() => {
    const sec: Record<string, { right: number; total: number }> = {};
    const topic: Record<string, { right: number; total: number; subject: string; topic: string }> = {};
    for (const a of attempts) {
      const q = byId.get(a.question_id);
      if (!q || q.exam !== exam) continue;
      const s = (sec[q.subject] ??= { right: 0, total: 0 });
      const t = (topic[`${q.subject}|${q.topic}`] ??= { right: 0, total: 0, subject: q.subject, topic: q.topic });
      s.total++; t.total++;
      if (a.correct) { s.right++; t.right++; }
    }
    const weak = Object.values(topic).filter((v) => v.total >= 2 && v.right / v.total < 0.7).sort((a, b) => a.right / a.total - b.right / b.total).slice(0, 5);
    return { sec, weak };
  }, [attempts, byId, exam]);

  const finishPart = useCallback((r: Extract<Run, { kind: "test" }>) => {
    if (r.part + 1 < r.parts.length) {
      const next = r.parts[r.part + 1]!;
      setRun({ ...r, part: r.part + 1, i: 0, endsAt: Date.now() + next.section.minutes * 60_000 });
      window.scrollTo(0, 0);
    } else {
      setRun({ kind: "done", exam: r.exam, parts: r.parts, answers: r.answers, minutes: Math.round((Date.now() - r.startedAt) / 60_000) });
      window.scrollTo(0, 0);
    }
  }, []);
  // Time's up: move on automatically, like the real test.
  useEffect(() => {
    if (run?.kind === "test" && now >= run.endsAt) finishPart(run);
  }, [now, run, finishPart]);

  // Save a finished practice test once.
  const [savedFor, setSavedFor] = useState<Run | null>(null);
  useEffect(() => {
    if (!sb || run?.kind !== "done" || savedFor === run) return;
    setSavedFor(run);
    const student = ctx?.students.find((s) => s.id === current);
    if (!student) return;
    const sum = summarize(run);
    void (async () => {
      const rows = run.parts.flatMap((p) => p.qs.map((q) => ({ student_id: student.id, question_id: q.id, correct: run.answers[q.id] === q.answer_index })));
      const [a, r] = await Promise.all([
        sb.from("practice_attempts").insert(rows),
        sb.from("test_prep_results").insert({ student_id: student.id, exam: run.exam, sections: sum.sections, estimate: sum.total, minutes: run.minutes }),
      ]);
      if (a.error || r.error) setError(friendly(a.error ?? r.error));
      void loadHistory();
    })();
  }, [sb, run, savedFor, ctx, current, loadHistory]);

  const title = "SAT and ACT prep";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (!ctx || !bank) return <Page title={title}><p className="hint">Loading…</p></Page>;
  const student = ctx.students.find((s) => s.id === current);
  const official = scores.find((s) => s.id === current);
  const sections = BLUEPRINT[exam];
  const pool = (s: Section) => bank.filter((q) => q.subject === s.subject);

  const startDrill = (s: Section) => {
    const qs = pickQuestions(pool(s), s.passages ? 8 : DRILL, lastSeen);
    setRun({ kind: "drill", section: s, qs, i: 0, picked: null, right: 0 }); setTutor(null); setAsk(""); setError(null);
  };
  const startTest = () => {
    const parts = sections.filter((s) => science || !s.optional).map((s) => ({ section: s, qs: pickQuestions(pool(s), s.count, lastSeen) })).filter((p) => p.qs.length);
    if (!parts.length) return;
    setRun({ kind: "test", exam, parts, part: 0, i: 0, answers: {}, flags: {}, endsAt: Date.now() + parts[0]!.section.minutes * 60_000, startedAt: Date.now() });
    setNow(Date.now()); setError(null); window.scrollTo(0, 0);
  };
  const pickDrill = async (r: Extract<Run, { kind: "drill" }>, j: number) => {
    const q = r.qs[r.i]!;
    const correct = j === q.answer_index;
    setRun({ ...r, picked: j, right: r.right + (correct ? 1 : 0) });
    if (!student) return;
    const { error: e } = await sb.from("practice_attempts").insert({ student_id: student.id, question_id: q.id, correct });
    if (!e) setAttempts((a) => [{ question_id: q.id, correct, created_at: new Date().toISOString() }, ...a]);
  };
  const explain = async (q: Question, picked: number | null) => {
    if (!student) return;
    setBusy(true); setError(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/practice/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId: student.id, questionId: q.id, mode: "help", answer: picked != null ? q.options[picked] : "", message: ask }),
      });
      const out = (await res.json().catch(() => null)) as (Tutor & { error?: string }) | null;
      if (!res.ok || !out?.feedback) throw new Error(out?.error ?? "Sorry, the tutor couldn't answer.");
      setTutor(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : friendly(e));
    } finally {
      setBusy(false);
    }
  };

  // ---------- A drill in progress ----------
  if (run?.kind === "drill") {
    const q = run.qs[run.i];
    return (
      <Page title={title}>
        {q ? (
          <section className="panel">
            <div className="score-head">
              <p className="eyebrow" style={{ margin: 0 }}>{run.section.subject} · {q.topic}{q.status !== "approved" ? " · Draft" : ""}</p>
              <span className="hint" style={{ margin: 0 }}>Question {run.i + 1} of {run.qs.length}</span>
            </div>
            {q.passage && <Passage text={q.passage} />}
            <p className="tp-stem"><b><Marked text={q.question} /></b></p>
            <Options q={q} chosen={run.picked} reveal={run.picked !== null} onPick={(j) => void pickDrill(run, j)} />
            {run.picked !== null && <p className={`note ${run.picked === q.answer_index ? "note-ok" : "note-info"}`} style={{ marginTop: 10 }}>{run.picked === q.answer_index ? "✓ Right. " : `Not quite. The answer is ${String.fromCharCode(65 + q.answer_index)}. `}{q.explanation}</p>}
            {tutor && <div className="note note-info tutor-box">{tutor.feedback}<p style={{ margin: "8px 0 0" }}><b>Try next:</b> {tutor.next_step}</p><ReportAi feature="test-prep tutor" text={`${tutor.feedback}\n\nTry next: ${tutor.next_step}`} /></div>}
            {student && run.picked !== null && !busy && !tutor && (
              <details className="rescue-more" style={{ marginTop: 10 }}>
                <summary>Still confused? Ask the tutor about this question</summary>
                <div className="field" style={{ marginTop: 8 }}><label htmlFor="tp-ask">What&apos;s confusing? (optional)</label>
                  <input id="tp-ask" className="input" maxLength={1000} value={ask} placeholder="Why isn't it choice B?" onChange={(e) => setAsk(e.target.value)} /></div>
                <button className="btn btn-ghost btn-inline btn-sm" style={{ marginTop: 8 }} onClick={() => void explain(q, run.picked)}>🤖 Explain it (1 AI use)</button>
              </details>
            )}
            {busy && <p className="hint">The tutor is thinking…</p>}
            {error && <p className="note note-err" role="alert">{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {run.picked !== null && <button className="btn btn-inline" onClick={() => { setRun({ ...run, i: run.i + 1, picked: null }); setTutor(null); setAsk(""); setError(null); }}>{run.i + 1 < run.qs.length ? "Next question →" : "See my score"}</button>}
              <button className="btn btn-ghost btn-inline" onClick={() => setRun(null)}>Stop</button>
            </div>
          </section>
        ) : (
          <section className="panel">
            <h2>Drill done: {run.right} of {run.qs.length} right</h2>
            <p className="hint">{run.right === run.qs.length ? "Great work. Try a timed practice test next to work on pacing." : "Each miss shows you exactly what to review. Your score plan below updates with every drill."}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-inline" onClick={() => startDrill(run.section)}>Drill again</button>
              <button className="btn btn-ghost btn-inline" onClick={() => setRun(null)}>Back to test prep</button>
            </div>
          </section>
        )}
      </Page>
    );
  }

  // ---------- A timed practice test in progress ----------
  if (run?.kind === "test") {
    const part = run.parts[run.part]!;
    const q = part.qs[run.i]!;
    const left = Math.max(0, Math.round((run.endsAt - now) / 1000));
    const answered = part.qs.filter((x) => run.answers[x.id] !== undefined).length;
    return (
      <Page title={`${run.exam} practice test`}>
        <div className="tp-testbar">
          <span><b>{part.section.short}</b> · section {run.part + 1} of {run.parts.length}</span>
          <span className={`tp-timer ${left < 60 ? "tp-timer-low" : ""}`} aria-live={left < 60 ? "polite" : "off"}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
        </div>
        <section className="panel">
          <div className="score-head">
            <p className="eyebrow" style={{ margin: 0 }}>Question {run.i + 1} of {part.qs.length}{q.status !== "approved" ? " · Draft" : ""}</p>
            <button className={`chip tp-flag ${run.flags[q.id] ? "chip-on" : ""}`} onClick={() => setRun({ ...run, flags: { ...run.flags, [q.id]: !run.flags[q.id] } })}>{run.flags[q.id] ? "★ Marked" : "☆ Mark for review"}</button>
          </div>
          {q.passage && <Passage text={q.passage} />}
          <p className="tp-stem"><b><Marked text={q.question} /></b></p>
          <Options q={q} chosen={run.answers[q.id] ?? null} reveal={false} onPick={(j) => setRun({ ...run, answers: { ...run.answers, [q.id]: j } })} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-inline" disabled={run.i === 0} onClick={() => setRun({ ...run, i: run.i - 1 })}>← Back</button>
            {run.i + 1 < part.qs.length
              ? <button className="btn btn-inline" onClick={() => setRun({ ...run, i: run.i + 1 })}>Next →</button>
              : <button className="btn btn-inline" onClick={() => finishPart(run)}>{run.part + 1 < run.parts.length ? "Finish section →" : "Finish test"}</button>}
          </div>
        </section>
        <div className="tp-grid" aria-label="Jump to a question">
          {part.qs.map((x, k) => (
            <button key={x.id} className={`tp-cell ${k === run.i ? "tp-cell-now" : ""} ${run.answers[x.id] !== undefined ? "tp-cell-done" : ""}`} onClick={() => setRun({ ...run, i: k })} aria-label={`Question ${k + 1}${run.flags[x.id] ? ", marked" : ""}`}>
              {k + 1}{run.flags[x.id] ? "★" : ""}
            </button>
          ))}
        </div>
        <p className="hint" style={{ fontSize: 13 }}>{answered} of {part.qs.length} answered. There&apos;s no penalty for guessing, so answer every question. When time runs out, the next section starts on its own.</p>
      </Page>
    );
  }

  // ---------- Practice test results ----------
  if (run?.kind === "done") {
    const sum = summarize(run);
    const unit = run.exam === "SAT" ? "total" : "composite";
    return (
      <Page title={`${run.exam} practice test results`}>
        <section className="panel">
          <p className="eyebrow">Estimated {unit}</p>
          <p className="tp-big">{sum.total} <span className="hint" style={{ fontSize: 15 }}>(likely range {sum.low} to {sum.high})</span></p>
          <ul className="gaps">
            {run.parts.map((p) => { const s = sum.sections[p.section.subject]!; return <li key={p.section.subject}><b>{p.section.short}</b>: {s.right} of {s.total} right, about {s.estimate}{p.section.optional ? " (Science is scored separately)" : ""}</li>; })}
          </ul>
          <p className="hint" style={{ fontSize: 13, marginTop: 10 }}>A rough estimate from a short practice test, not an official score. For a full-length check, use the free official practice tests linked on the test prep page.</p>
          {error && <p className="note note-err" role="alert">{error}</p>}
          <button className="btn btn-inline" onClick={() => setRun(null)}>Back to test prep</button>
        </section>
        <h2 className="section-title">Review every question</h2>
        {run.parts.map((p) => p.qs.map((q, k) => {
          const a = run.answers[q.id];
          const ok = a === q.answer_index;
          return (
            <details key={q.id} className="panel tp-review">
              <summary><span className={ok ? "tp-ok" : "tp-miss"}>{ok ? "✓" : a === undefined ? "–" : "✗"}</span> {p.section.short} {k + 1} · {q.topic}</summary>
              {q.passage && <Passage text={q.passage} />}
              <p className="tp-stem"><b><Marked text={q.question} /></b></p>
              <Options q={q} chosen={a ?? null} reveal onPick={() => undefined} />
              <p className="note note-info" style={{ marginTop: 10 }}>{a === undefined ? "Not answered. " : ""}{q.explanation}</p>
            </details>
          );
        }))}
      </Page>
    );
  }

  // ---------- Test prep home ----------
  const examResults = results.filter((r) => r.exam === exam);
  const best = examResults.reduce<number | null>((m, r) => (m == null || r.estimate > m ? r.estimate : m), null);
  const target = exam === "SAT" ? zell?.tests_any?.sat : zell?.tests_any?.act;
  const officialScore = exam === "SAT" ? official?.sat : official?.act;
  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        Short drills by section (free, checked instantly) and timed practice tests that estimate your score. All questions are written for ScholarTasks in the style of the real tests.
      </p>
      {ctx.role === "parent" && ctx.students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {ctx.students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {!student && <p className="note note-info">Add a student on the <a href="/family">Family</a> page to save scores and use the tutor. You can still practice.</p>}
      <div className="tabs tp-exam-tabs" role="tablist" style={{ maxWidth: 260 }}>
        {(["SAT", "ACT"] as const).map((e) => <button key={e} role="tab" aria-selected={exam === e} onClick={() => setExam(e)}>{e}</button>)}
      </div>

      <section className="panel">
        <h2>Score plan</h2>
        <div className="tp-stats">
          <div><span className="hint">Official {exam}</span><b>{officialScore ?? "Not yet"}</b></div>
          <div><span className="hint">Best practice estimate</span><b>{best ?? "No test yet"}</b></div>
          {target && <div><span className="hint">Zell Miller needs</span><b>{target}</b></div>}
        </div>
        {plan.weak.length > 0 ? (
          <>
            <p className="hint" style={{ margin: "12px 0 4px" }}>Work on these first:</p>
            <ul className="gaps">{plan.weak.map((w) => <li key={w.subject + w.topic}><b>{w.topic}</b> ({w.subject.replace(/^(SAT|ACT) /, "")}): {w.right} of {w.total} right</li>)}</ul>
          </>
        ) : (
          <p className="hint" style={{ margin: "12px 0 0" }}>Do a few drills and your weakest topics show up here.</p>
        )}
        <p className="hint" style={{ fontSize: 13, margin: "10px 0 0" }}>
          Got an official score? Save it on <a href="/grades">Grades</a> so scholarships and the counselor use it. {exam === "SAT" ? "Most students take the SAT in spring of junior year and again in the fall of senior year." : "Most students take the ACT in spring of junior year and again in the fall of senior year."} Georgia&apos;s Zell Miller test score must come from a single sitting; check details on <a href="https://www.gafutures.org" target="_blank" rel="noreferrer">GAfutures</a>.
        </p>
      </section>

      <h2 className="section-title">Section drills <span className="hint" style={{ fontSize: 14, fontWeight: 400 }}>free · untimed</span></h2>
      <div className="lesson-grid">
        {sections.map((s) => {
          const st = plan.sec[s.subject];
          const n = pool(s).length;
          return (
            <button key={s.subject} className="lesson-tile practice-tile" disabled={!n} onClick={() => startDrill(s)}>
              <b>{s.short}</b>
              <span className="hint">{s.about}</span>
              <span className="lesson-meta">{n ? (st ? `${Math.round((st.right / st.total) * 100)}% right so far (${st.total} answered)` : `${n} questions · not started`) : "Questions coming soon"}</span>
              <span className="tile-go">Drill →</span>
            </button>
          );
        })}
      </div>

      <section className="panel">
        <p className="eyebrow">Study Coach{STUDY_COACH_OPEN ? " · free during the beta" : ""}</p>
        <h2>Timed {exam} practice test</h2>
        <p className="hint">
          {sections.filter((s) => science || !s.optional).map((s) => `${s.short}: ${s.count} questions in ${s.minutes} min`).join(" · ")}.
          {" "}Same time per question as the real {exam}. You see your answers and explanations at the end, plus an estimated score.
        </p>
        {exam === "ACT" && (
          <label className="check" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="checkbox" checked={science} onChange={(e) => setScience(e.target.checked)} /> Include Science (optional on the ACT; scored separately)
          </label>
        )}
        <button className="btn btn-inline" disabled={!STUDY_COACH_OPEN || !bank.some((q) => q.exam === exam)} onClick={startTest}>Start the practice test</button>
        {examResults.length > 0 && (
          <>
            <p className="hint" style={{ margin: "14px 0 4px" }}>Past practice tests</p>
            <ul className="gaps">
              {examResults.slice(0, 6).map((r) => (
                <li key={r.id}>{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: <b>{r.estimate}</b>{" "}
                  <span className="hint">({Object.entries(r.sections).map(([k, v]) => `${k.replace(/^(SAT|ACT) /, "")} ${v.estimate}`).join(", ")})</span></li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Free official practice</h2>
        <p className="hint">Before test day, take at least one full-length official practice test to get used to the real format.</p>
        <ul className="gaps">
          {exam === "SAT"
            ? <li><a href="https://bluebook.collegeboard.org" target="_blank" rel="noreferrer">Bluebook</a> (College Board&apos;s app): full-length adaptive SAT practice tests, the same app used on test day.</li>
            : <li><a href="https://www.act.org/content/act/en/products-and-services/the-act/test-preparation.html" target="_blank" rel="noreferrer">ACT test preparation</a>: ACT&apos;s free practice test and sample questions.</li>}
          <li><a href="https://www.gafutures.org" target="_blank" rel="noreferrer">GAfutures</a>: Georgia&apos;s HOPE and Zell Miller test score rules.</li>
        </ul>
      </section>
      <p className="hint" style={{ fontSize: 12 }}>
        SAT is a trademark of the College Board and ACT is a trademark of ACT, Inc. Neither is involved with ScholarTasks. Questions marked Draft are still being checked by our teacher reviewer. Score estimates are approximate.
      </p>
    </Page>
  );
}

function Options({ q, chosen, reveal, onPick }: { q: Question; chosen: number | null; reveal: boolean; onPick: (j: number) => void }) {
  return (
    <div className="tp-options" role="group" aria-label="Answer choices">
      {q.options.map((o, j) => {
        const cls = reveal ? (j === q.answer_index ? "tp-right" : j === chosen ? "tp-wrong" : "") : j === chosen ? "tp-chosen" : "";
        return (
          <button key={j} type="button" className={`tp-option ${cls}`} disabled={reveal} aria-pressed={j === chosen} onClick={() => onPick(j)}>
            <span className="tp-letter">{String.fromCharCode(65 + j)}</span><span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

function summarize(run: Extract<Run, { kind: "done" }>) {
  const sections: Record<string, { right: number; total: number; estimate: number }> = {};
  for (const p of run.parts) {
    const right = p.qs.filter((q) => run.answers[q.id] === q.answer_index).length;
    sections[p.section.subject] = { right, total: p.qs.length, estimate: estimate(run.exam, right / p.qs.length) };
  }
  const core = run.parts.filter((p) => !p.section.optional).map((p) => sections[p.section.subject]!.estimate);
  if (run.exam === "SAT") {
    const total = core.reduce((a, b) => a + b, 0);
    return { sections, total, low: Math.max(400, total - 80), high: Math.min(1600, total + 80) };
  }
  const total = Math.round(core.reduce((a, b) => a + b, 0) / Math.max(1, core.length));
  return { sections, total, low: Math.max(1, total - 3), high: Math.min(36, total + 3) };
}

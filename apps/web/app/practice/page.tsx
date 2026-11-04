"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { loadStudy, type StudyContext } from "../study/context";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";

interface Question { id: string; subject: string; topic: string; kind: "mc" | "written"; question: string; options: string[] | null; answer_index: number | null; model_answer: string | null; explanation: string | null; status: string }
interface Attempt { question_id: string; correct: boolean }
interface Tutor { verdict: "correct" | "partly" | "not yet" | "none"; feedback: string; next_step: string }

const ROUND = 8;
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export default function PracticePage() {
  const sb = supabase();
  const [ctx, setCtx] = useState<StudyContext | null>(null);
  const [current, setCurrent] = useCurrentStudent();
  const [bank, setBank] = useState<Question[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [round, setRound] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [written, setWritten] = useState("");
  const [showModel, setShowModel] = useState(false);
  const [score, setScore] = useState({ right: 0, done: 0, missed: [] as string[] });
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/practice");
      const [c, q] = await Promise.all([
        loadStudy(sb, s.session.user.id),
        sb.from("practice_questions").select("id, subject, topic, kind, question, options, answer_index, model_answer, explanation, status").is("exam", null).order("subject"),
      ]);
      setCtx(c);
      setCurrent(c.own ?? pickStudent(c.students, c.students[0]?.id));
      setBank(q.error ? [] : ((q.data as Question[]) ?? []));
    })();
  }, [sb]);

  const loadAttempts = useCallback(async () => {
    if (!sb || !current) return;
    const { data } = await sb.from("practice_attempts").select("question_id, correct").eq("student_id", current).order("created_at", { ascending: false }).limit(1000);
    setAttempts((data as Attempt[]) ?? []);
  }, [sb, current]);
  useEffect(() => { void loadAttempts(); }, [loadAttempts]);

  const subjects = useMemo(() => [...new Set((bank ?? []).map((q) => q.subject))], [bank]);
  const stats = useMemo(() => {
    const byId = new Map((bank ?? []).map((q) => [q.id, q]));
    const topic: Record<string, { right: number; total: number; subject: string }> = {};
    const subj: Record<string, { right: number; total: number }> = {};
    for (const a of attempts) {
      const q = byId.get(a.question_id);
      if (!q) continue;
      const t = (topic[`${q.subject} · ${q.topic}`] ??= { right: 0, total: 0, subject: q.subject });
      const s = (subj[q.subject] ??= { right: 0, total: 0 });
      t.total++; s.total++;
      if (a.correct) { t.right++; s.right++; }
    }
    const weak = Object.entries(topic).filter(([, v]) => v.total >= 2 && v.right / v.total < 0.7).sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total).slice(0, 5);
    return { subj, weak };
  }, [attempts, bank]);

  if (!sb) return <Page title="Practice questions"><NotConfigured /></Page>;
  if (!ctx || !bank) return <Page title="Practice questions"><p className="hint">Loading…</p></Page>;
  const student = ctx.students.find((s) => s.id === current);
  const aiAllowed = true; // the server checks the AI permission and daily limit

  const start = (subject: string) => {
    const pool = bank.filter((q) => q.subject === subject);
    const mc = shuffle(pool.filter((q) => q.kind === "mc")).slice(0, ROUND - 1);
    const wr = shuffle(pool.filter((q) => q.kind === "written")).slice(0, 1);
    setRound([...mc, ...wr]); setI(0); setPicked(null); setWritten(""); setShowModel(false); setTutor(null); setAsk(""); setError(null);
    setScore({ right: 0, done: 0, missed: [] });
  };
  const record = async (q: Question, correct: boolean) => {
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), done: s.done + 1, missed: correct ? s.missed : [...s.missed, q.topic] }));
    if (!student) return;
    const { error: e } = await sb.from("practice_attempts").insert({ student_id: student.id, question_id: q.id, correct });
    if (!e) setAttempts((a) => [{ question_id: q.id, correct }, ...a]);
  };
  const next = () => { setI(i + 1); setPicked(null); setWritten(""); setShowModel(false); setTutor(null); setAsk(""); setError(null); };
  const callTutor = async (q: Question, mode: "check" | "help") => {
    if (!student) return;
    setBusy(true); setError(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/practice/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId: student.id, questionId: q.id, mode, answer: mode === "check" ? written : picked != null ? q.options?.[picked] : written, message: ask }),
      });
      const out = (await res.json().catch(() => null)) as (Tutor & { error?: string }) | null;
      if (!res.ok || !out?.feedback) throw new Error(out?.error ?? "Sorry, the tutor couldn't answer.");
      setTutor(out);
      if (mode === "check" && out.verdict !== "none" && tutor === null) await record(q, out.verdict === "correct");
    } catch (e) {
      setError(e instanceof Error ? e.message : friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const q = round?.[i];
  return (
    <Page title="Practice questions">
      <p className="hint" style={{ marginTop: -8 }}>
        Test yourself in core subjects. Multiple-choice questions are checked instantly and free. The tutor can check written answers or explain a question you&apos;re stuck on (1 of today&apos;s 10 AI uses). It teaches; it won&apos;t do homework.
      </p>
      {ctx.role === "parent" && ctx.students.length > 1 && !round && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {ctx.students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {!student && <p className="note note-info">Add a student on the <a href="/family">Family</a> page to save scores and use the tutor. You can still practice.</p>}
      {bank.length === 0 && <p className="note note-info">The question bank is being set up. Check back soon.</p>}

      {!round && (
        <>
          {stats.weak.length > 0 && (
            <section className="panel">
              <h2>Topics to review</h2>
              <ul className="gaps">{stats.weak.map(([t, v]) => <li key={t}><b>{t}</b>: {v.right} of {v.total} right</li>)}</ul>
              <p className="hint" style={{ margin: 0 }}>The <a href="/study/test-yourself">Test yourself</a> lesson shows how to practice these.</p>
            </section>
          )}
          <div className="lesson-grid">
            {subjects.map((s) => {
              const st = stats.subj[s];
              const n = bank.filter((q) => q.subject === s).length;
              return (
                <button key={s} className="lesson-tile practice-tile" onClick={() => start(s)}>
                  <b>{s}</b>
                  <span className="hint">{n} questions</span>
                  <span className="lesson-meta">{st ? `${Math.round((st.right / st.total) * 100)}% right so far (${st.total} answered)` : "Not started"}</span>
                  <span className="tile-go">Practice →</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {round && q && (
        <section className="panel">
          <div className="score-head">
            <p className="eyebrow" style={{ margin: 0 }}>{q.subject} · {q.topic}{q.status !== "approved" ? " · Draft" : ""}</p>
            <span className="hint" style={{ margin: 0 }}>Question {i + 1} of {round.length}</span>
          </div>
          <p style={{ fontSize: 18, margin: "12px 0" }}><b>{q.question}</b></p>

          {q.kind === "mc" && q.options && (
            <div className="checkin-q">
              <div className="chips">
                {q.options.map((o, j) => (
                  <button key={j} type="button" disabled={picked !== null}
                    className={`chip ${picked !== null && j === q.answer_index ? "chip-right" : ""} ${picked === j && j !== q.answer_index ? "chip-wrong" : ""}`}
                    onClick={() => { setPicked(j); void record(q, j === q.answer_index); }}>{o}</button>
                ))}
              </div>
              {picked !== null && <p className={`note ${picked === q.answer_index ? "note-ok" : "note-info"}`} style={{ marginTop: 10 }}>{picked === q.answer_index ? "✓ Right. " : "Not quite. "}{q.explanation}</p>}
            </div>
          )}

          {q.kind === "written" && (
            <div>
              <div className="field"><label htmlFor="pr-written">Your answer</label>
                <textarea id="pr-written" className="input" rows={4} maxLength={2000} value={written} onChange={(e) => setWritten(e.target.value)} /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {student && aiAllowed && <button className="btn btn-inline" disabled={busy || written.trim().length < 2} onClick={() => void callTutor(q, "check")}>{busy ? "Checking…" : "🤖 Check my answer"}</button>}
                <button className="btn btn-ghost btn-inline" disabled={written.trim().length < 2 && !tutor} onClick={() => setShowModel(true)}>Show a model answer</button>
              </div>
              {student && <span className="hint" style={{ fontSize: 12 }}>Checking uses 1 of today&apos;s 10 AI uses. Write your own answer first; the model answer appears after you try.</span>}
              {showModel && <p className="note note-info" style={{ marginTop: 10 }}><b>Model answer:</b> {q.model_answer}</p>}
            </div>
          )}

          {tutor && (
            <div className={`note ${tutor.verdict === "correct" ? "note-ok" : "note-info"} tutor-box`}>
              {tutor.verdict !== "none" && <b>{tutor.verdict === "correct" ? "✓ Correct. " : tutor.verdict === "partly" ? "Partly there. " : "Not yet. "}</b>}
              {tutor.feedback}
              <p style={{ margin: "8px 0 0" }}><b>Try next:</b> {tutor.next_step}</p>
            </div>
          )}

          {student && (q.kind === "written" || picked !== null) && !busy && (
            <details className="rescue-more" style={{ marginTop: 10 }}>
              <summary>Still confused? Ask the tutor about this question</summary>
              <div className="field" style={{ marginTop: 8 }}><label htmlFor="pr-ask">What&apos;s confusing? (optional)</label>
                <input id="pr-ask" className="input" maxLength={1000} value={ask} placeholder="Why isn't it the second choice?" onChange={(e) => setAsk(e.target.value)} /></div>
              <button className="btn btn-ghost btn-inline btn-sm" style={{ marginTop: 8 }} onClick={() => void callTutor(q, "help")}>🤖 Explain it (1 AI use)</button>
            </details>
          )}
          {busy && <p className="hint">The tutor is thinking…</p>}
          {error && <p className="note note-err" role="alert">{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {(picked !== null || q.kind === "written") && <button className="btn btn-inline" onClick={next}>{i + 1 < round.length ? "Next question →" : "See my score"}</button>}
            <button className="btn btn-ghost btn-inline" onClick={() => setRound(null)}>Stop</button>
          </div>
        </section>
      )}

      {round && !q && (
        <section className="panel">
          <h2>Round done: {score.right} of {score.done} right</h2>
          {score.missed.length > 0
            ? <p className="hint">Review these topics: {[...new Set(score.missed)].join(", ")}. Missing a question is how you find out what to study, so this is useful.</p>
            : <p className="hint">Great work. Try again in a few days to make it stick.</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-inline" onClick={() => start(round[0]!.subject)}>Practice again</button>
            <button className="btn btn-ghost btn-inline" onClick={() => setRound(null)}>Pick another subject</button>
          </div>
        </section>
      )}
      <p className="hint" style={{ fontSize: 12 }}>Questions marked Draft are still being checked by our teacher reviewer. AI feedback can be wrong.</p>
    </Page>
  );
}

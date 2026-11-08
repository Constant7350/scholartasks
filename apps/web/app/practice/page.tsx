"use client";

import { NO_SUGGEST, VoiceButton } from "../voice";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { PageTabs } from "../icon-tabs";
import { STUDY_PAGES } from "../page-groups";
import { loadStudy, type StudyContext } from "../study/context";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { ReportAi } from "../report-ai";
import { COURSES, GROUPS, courseOf, usualFor } from "./catalog";
import { LEVELS, badges, levelName, pickRound, subjectStates, type Attempt, type QMeta } from "./levels";

interface Question extends QMeta { question: string; options: string[] | null; answer_index: number | null; model_answer: string | null; explanation: string | null }
interface Tutor { verdict: "correct" | "partly" | "not yet" | "none"; feedback: string; next_step: string }
interface Settings { subjects: string[]; ranked: boolean }
interface Standing { subject: string; score: number; answered: number; ahead_pct: number | null; ranked_count: number | null }
interface Report { summary: string; strengths: string[]; work_on: string[]; next_level: string }
interface AiQ { topic: string; question: string; options: string[]; answer_index: number; explanation: string }

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const LOCAL = (id: string) => `st-practice-${id}`;

/** Supabase returns at most 1,000 rows per call, so read big lists a page at a time. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, max = 10000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error && from === 0) throw error;
    if (error || !Array.isArray(data)) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

function LevelMeter({ level }: { level: number }) {
  return (
    <span className="level-meter" aria-label={levelName(level)}>
      {LEVELS.map((name, i) => <span key={name} className={i < level ? "on" : ""} />)}
    </span>
  );
}

export default function PracticePage() {
  const sb = supabase();
  const [ctx, setCtx] = useState<StudyContext | null>(null);
  const [current, setCurrent] = useCurrentStudent();
  const [meta, setMeta] = useState<QMeta[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedInDb, setSavedInDb] = useState(true);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [standing, setStanding] = useState<Standing[]>([]);
  const [round, setRound] = useState<(Question & { order: number[] })[] | null>(null);
  const [startLevel, setStartLevel] = useState(2);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [written, setWritten] = useState("");
  const [showModel, setShowModel] = useState(false);
  const [score, setScore] = useState({ right: 0, done: 0, missed: [] as string[] });
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [ask, setAsk] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [aiQs, setAiQs] = useState<{ list: AiQ[]; at: number; picked: number | null; right: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/practice");
      const [c, q] = await Promise.all([
        loadStudy(sb, s.session.user.id),
        readAll<QMeta>((a, b) => sb.from("practice_questions").select("id, subject, topic, level, kind, status").is("exam", null).order("id").range(a, b))
          // Before the levels database update: everything counts as Core.
          .catch(() => readAll<QMeta>((a, b) => sb.from("practice_questions").select("id, subject, topic, kind, status").is("exam", null).order("id").range(a, b)).then((l) => l.map((x) => ({ ...x, level: 2 })))),
      ]);
      setCtx(c);
      setCurrent(c.own ?? pickStudent(c.students, c.students[0]?.id));
      setMeta(q);
    })();
  }, [sb]);

  const loadStudent = useCallback(async (client: SupabaseClient, id: string) => {
    const [at, set, rank] = await Promise.all([
      readAll<Attempt>((a, b) => client.from("practice_attempts").select("question_id, correct, created_at").eq("student_id", id).order("created_at", { ascending: false }).range(a, b), 5000).catch(() => [] as Attempt[]),
      client.from("student_practice").select("subjects, ranked").eq("student_id", id).maybeSingle(),
      client.rpc("practice_standing", { p_student: id }),
    ]);
    setAttempts(at);
    if (set.error) {
      // Database update not run yet: keep the choice on this device.
      setSavedInDb(false);
      let local: Settings | null = null;
      try { local = JSON.parse(localStorage.getItem(LOCAL(id)) ?? "null") as Settings | null; } catch { /* private window */ }
      setSettings(local);
    } else {
      setSavedInDb(true);
      setSettings((set.data as Settings | null) ?? null);
    }
    setStanding(rank.error ? [] : ((rank.data as Standing[]) ?? []));
  }, []);
  useEffect(() => { if (sb && current) void loadStudent(sb, current); }, [sb, current, loadStudent]);

  const byId = useMemo(() => new Map((meta ?? []).map((q) => [q.id, q])), [meta]);
  const states = useMemo(() => subjectStates(byId, attempts), [byId, attempts]);
  const inBank = useMemo(() => {
    const n: Record<string, number> = {};
    for (const q of meta ?? []) n[q.subject] = (n[q.subject] ?? 0) + 1;
    return n;
  }, [meta]);

  if (!sb) return <Page title="Practice questions"><NotConfigured /></Page>;
  if (!ctx || !meta) return <Page title="Practice questions"><p className="hint">Loading…</p></Page>;
  const student = ctx.students.find((s) => s.id === current);
  const allSubjects = [...new Set([...COURSES.map((c) => c.name).filter((n) => inBank[n]), ...Object.keys(inBank)])];
  const mine = allSubjects.filter((s) => (settings?.subjects ?? []).includes(s));
  const showPicker = picking !== null || (student != null && mine.length === 0);
  const rankOf = (subject: string) => standing.find((r) => r.subject === subject);
  const earned = badges(states, mine);

  const save = async (next: Settings) => {
    if (!student) return;
    setSettings(next);
    setError(null);
    if (savedInDb) {
      const { error: e } = await sb.from("student_practice").upsert({ student_id: student.id, subjects: next.subjects, ranked: next.ranked, updated_at: new Date().toISOString() });
      if (e) { setError(friendly(e)); return; }
      const rank = await sb.rpc("practice_standing", { p_student: student.id });
      setStanding(rank.error ? [] : ((rank.data as Standing[]) ?? []));
    } else {
      try { localStorage.setItem(LOCAL(student.id), JSON.stringify(next)); } catch { /* private window */ }
    }
  };
  const openPicker = () => setPicking(mine);
  const sel = picking ?? [];
  const usual = usualFor(student?.grade_level);
  const toggle = (name: string) => setPicking(sel.includes(name) ? sel.filter((x) => x !== name) : [...sel, name]);

  const start = async (subject: string) => {
    setError(null); setReport(null); setAiQs(null);
    const pool = meta.filter((q) => q.subject === subject);
    const pick = pickRound(pool, states.get(subject));
    const { data, error: e } = await sb.from("practice_questions").select("*").in("id", pick.map((q) => q.id));
    if (e || !data) { setError(friendly(e)); return; }
    const full = new Map((data as Question[]).map((q) => [q.id, { ...q, level: q.level ?? 2 }]));
    setRound(pick.map((m) => full.get(m.id)).filter((q): q is Question => !!q).map((q) => ({ ...q, order: shuffle((q.options ?? []).map((_, j) => j)) })));
    setStartLevel(states.get(subject)?.level ?? 2);
    setI(0); setPicked(null); setWritten(""); setShowModel(false); setTutor(null); setAsk("");
    setScore({ right: 0, done: 0, missed: [] });
  };
  const record = async (q: Question, correct: boolean) => {
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), done: s.done + 1, missed: correct ? s.missed : [...s.missed, q.topic] }));
    if (!student) return;
    const { error: e } = await sb.from("practice_attempts").insert({ student_id: student.id, question_id: q.id, correct });
    if (!e) setAttempts((a) => [{ question_id: q.id, correct, created_at: new Date().toISOString() }, ...a]);
  };
  const next = () => { setI(i + 1); setPicked(null); setWritten(""); setShowModel(false); setTutor(null); setAsk(""); setError(null); };
  const post = async (path: string, body: object) => {
    const { data: s } = await sb.auth.getSession();
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !out || out.error) throw new Error((out?.error as string) ?? "Sorry, the tutor couldn't answer.");
    return out;
  };
  const callTutor = async (q: Question, mode: "check" | "help") => {
    if (!student) return;
    setBusy(true); setError(null);
    try {
      const out = (await post("/api/practice/tutor", { studentId: student.id, questionId: q.id, mode, answer: mode === "check" ? written : picked != null ? q.options?.[picked] : written, message: ask })) as unknown as Tutor;
      setTutor(out);
      if (mode === "check" && out.verdict !== "none" && tutor === null) await record(q, out.verdict === "correct");
    } catch (e) {
      setError(e instanceof Error ? e.message : friendly(e));
    } finally {
      setBusy(false);
    }
  };
  const coach = async (subject: string, mode: "report" | "challenge") => {
    if (!student) return;
    setBusy(true); setError(null);
    try {
      const out = await post("/api/practice/coach", { studentId: student.id, subject, mode });
      if (mode === "report") setReport(out as unknown as Report);
      else setAiQs({ list: out.questions as AiQ[], at: 0, picked: null, right: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const rankLine = (subject: string) => {
    if (!settings?.ranked) return null;
    const r = rankOf(subject);
    if (!r) return <span className="hint rank-line">Answer 20 questions to get a USA ranking</span>;
    if (r.ahead_pct == null) return <span className="hint rank-line">Your USA ranking shows once 10 other students are ranked here</span>;
    if (r.ahead_pct >= 99) return <span className="rank-line rank-top">🏅 Top 1% in the USA</span>;
    return <span className="rank-line">{`Ahead of ${r.ahead_pct}% of ranked students in the USA`}</span>;
  };

  const q = round?.[i];
  const subjectNow = round?.[0]?.subject ?? "";
  const levelNow = states.get(subjectNow)?.level ?? 2;
  const bestNow = states.get(subjectNow)?.best ?? 2;
  const overall = rankOf("");
  const weak = mine.flatMap((s) => Object.entries(states.get(s)?.topics ?? {}).filter(([, v]) => v.total >= 2 && v.right / v.total < 0.7).map(([t, v]) => ({ s, t, v })))
    .sort((a, b) => a.v.right / a.v.total - b.v.right / b.v.total).slice(0, 5);

  return (
    <Page title="Practice questions">
      <PageTabs label="Study pages" here="/practice" tabs={STUDY_PAGES} />
      <p className="hint" style={{ marginTop: -8 }}>Test yourself in the classes you take. Questions get harder as you get better, from Foundation up to Expert. Multiple choice is checked instantly and free; the tutor explains, it never does homework.</p>
      {ctx.role === "parent" && ctx.students.length > 1 && !round && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {ctx.students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => { setCurrent(s.id); setPicking(null); }}>{s.first_name}</button>)}
        </div>
      )}
      {!student && <p className="note note-info">Add a student on the <a href="/family">Family</a> page to save scores and levels. You can still practice.</p>}
      {meta.length === 0 && <p className="note note-info">The question bank is being set up. Check back soon.</p>}
      {error && !round && <p className="note note-err" role="alert">{error}</p>}

      {!round && showPicker && (
        <section className="panel">
          <h2>My classes</h2>
          <p className="hint">Pick every class you take this year. You can change this any time.</p>
          {GROUPS.map((g) => {
            // Classes usual for the student's grade come first in each group.
            const list = allSubjects.filter((n) => courseOf(n).group === g.id).sort((a, b) => Number(usual.includes(b)) - Number(usual.includes(a)));
            if (!list.length) return null;
            return (
              <div key={g.id} className="class-group">
                <h3>{g.icon} {g.label}</h3>
                <div className="chips">
                  {list.map((n) => <button key={n} type="button" aria-pressed={sel.includes(n)} className={`chip ${sel.includes(n) ? "chip-on" : ""}`} onClick={() => toggle(n)}>{sel.includes(n) ? "✓ " : ""}{n}</button>)}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button className="btn btn-inline" disabled={sel.length === 0} onClick={() => { void save({ subjects: sel, ranked: settings?.ranked ?? false }); setPicking(null); }}>Save my classes</button>
            {mine.length > 0 && <button className="btn btn-ghost btn-inline" onClick={() => setPicking(null)}>Cancel</button>}
          </div>
          {!savedInDb && <p className="hint" style={{ fontSize: 12 }}>Saved on this device for now.</p>}
        </section>
      )}

      {!round && !showPicker && (
        <>
          {earned.length > 0 && (
            <section className="panel">
              <h2>My badges</h2>
              <div className="badge-row">{earned.map((b) => <span key={b.label} className="practice-badge">{b.icon} {b.label}</span>)}</div>
            </section>
          )}
          {weak.length > 0 && (
            <section className="panel">
              <h2>Topics to review</h2>
              <ul className="gaps">{weak.map(({ s, t, v }) => <li key={s + t}><b>{s} · {t}</b>: {v.right} of {v.total} right</li>)}</ul>
              <p className="hint" style={{ margin: 0 }}>The <a href="/study/test-yourself">Test yourself</a> lesson shows how to practice these.</p>
            </section>
          )}
          <div className="lesson-grid">
            {mine.map((s) => {
              const st = states.get(s);
              const lv = st?.level ?? 2;
              return (
                <button key={s} className="lesson-tile practice-tile" onClick={() => void start(s)}>
                  <b>{s}</b>
                  <span className="level-line"><LevelMeter level={lv} /> {levelName(lv)}</span>
                  <span className="lesson-meta">{st ? `${st.answered} answered, ${Math.round((st.right / st.answered) * 100)}% right` : "Not started"}</span>
                  {rankLine(s)}
                  <span className="tile-go">Practice →</span>
                </button>
              );
            })}
          </div>
          {student && (
            <section className="panel">
              <h2>USA ranking</h2>
              <label className="check-row">
                <input type="checkbox" checked={settings?.ranked ?? false} disabled={!savedInDb} onChange={(e) => void save({ subjects: mine, ranked: e.target.checked })} />
                <span>Join the USA ranking and see where I stand compared with other students</span>
              </label>
              <p className="hint" style={{ margin: "6px 0 0" }}>Only you see your place. No names are ever shown, not even the top student&apos;s. Your score counts harder questions more, so the way to the top is reaching higher levels.</p>
              {settings?.ranked && overall?.ahead_pct != null && <p className="rank-line" style={{ marginTop: 8 }}>{overall.ahead_pct >= 99 ? "🏅 All my classes: top 1% in the USA" : `All my classes: ahead of ${overall.ahead_pct}% of ranked students`}</p>}
            </section>
          )}
          {student && <button className="btn btn-ghost btn-inline" onClick={openPicker}>Change my classes</button>}
        </>
      )}

      {round && q && (
        <section className="panel">
          <div className="score-head">
            <p className="eyebrow" style={{ margin: 0 }}>{q.subject} · {q.topic} · {levelName(q.level)}{q.status !== "approved" ? " · Draft" : ""}</p>
            <span className="hint" style={{ margin: 0 }}>Question {i + 1} of {round.length}</span>
          </div>
          <p style={{ fontSize: 18, margin: "12px 0" }}><b>{q.question}</b></p>

          {q.kind === "mc" && q.options && (
            <div className="checkin-q">
              <div className="chips">
                {q.order.map((j) => (
                  <button key={j} type="button" disabled={picked !== null}
                    className={`chip ${picked !== null && j === q.answer_index ? "chip-right" : ""} ${picked === j && j !== q.answer_index ? "chip-wrong" : ""}`}
                    onClick={() => { setPicked(j); void record(q, j === q.answer_index); }}>{q.options![j]}</button>
                ))}
              </div>
              {picked !== null && <p className={`note ${picked === q.answer_index ? "note-ok" : "note-info"}`} style={{ marginTop: 10 }}>{picked === q.answer_index ? "✓ Right. " : "Not quite. "}{q.explanation}</p>}
            </div>
          )}

          {q.kind === "written" && (
            <div>
              <div className="field"><label htmlFor="pr-written">Your answer</label>
                <textarea {...NO_SUGGEST} id="pr-written" className="input" rows={4} maxLength={2000} value={written} onChange={(e) => setWritten(e.target.value)} /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <VoiceButton value={written} onText={setWritten} max={2000} disabled={busy} />
                {student && <button className="btn btn-inline" disabled={busy || written.trim().length < 2} onClick={() => void callTutor(q, "check")}>{busy ? "Checking…" : "🤖 Check my answer"}</button>}
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
              <ReportAi feature="tutor" text={`${tutor.feedback}\n\nTry next: ${tutor.next_step}`} />
            </div>
          )}

          {student && (q.kind === "written" || picked !== null) && !busy && (
            <details className="rescue-more" style={{ marginTop: 10 }}>
              <summary>Still confused? Ask the tutor about this question</summary>
              <div className="field" style={{ marginTop: 8 }}><label htmlFor="pr-ask">What&apos;s confusing? (optional)</label>
                <input {...NO_SUGGEST} id="pr-ask" className="input" maxLength={1000} value={ask} placeholder="Why isn't it the second choice?" onChange={(e) => setAsk(e.target.value)} /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <VoiceButton value={ask} onText={setAsk} max={1000} small />
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void callTutor(q, "help")}>🤖 Explain it (1 AI use)</button>
              </div>
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
          {student && levelNow > startLevel && <p className="note note-ok">⬆️ Level up! You&apos;re now <b>{levelName(levelNow)}</b> in {subjectNow}.</p>}
          {student && levelNow < startLevel && <p className="note note-info">You&apos;re at <b>{levelName(levelNow)}</b> in {subjectNow} for now. A few right answers in a row moves you back up.</p>}
          {student && levelNow === startLevel && <p className="hint"><LevelMeter level={levelNow} /> <span>{`You're at ${levelName(levelNow)} in ${subjectNow}.`}</span> <span>Three right in a row at your level moves you up.</span></p>}
          {score.missed.length > 0
            ? <p className="hint">Review these topics: {[...new Set(score.missed)].join(", ")}. Missing a question is how you find out what to study, so this is useful.</p>
            : <p className="hint">Great work. Try again in a few days to make it stick.</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-inline" onClick={() => void start(subjectNow)}>Practice again</button>
            {student && <button className="btn btn-ghost btn-inline" disabled={busy} onClick={() => void coach(subjectNow, "report")}>🤖 Where I stand (1 AI use)</button>}
            {student && bestNow >= 5 && <button className="btn btn-ghost btn-inline" disabled={busy} onClick={() => void coach(subjectNow, "challenge")}>🤖 3 new Expert questions (1 AI use)</button>}
            <button className="btn btn-ghost btn-inline" onClick={() => { setRound(null); setReport(null); setAiQs(null); }}>Pick another class</button>
          </div>
          {busy && <p className="hint">The coach is thinking…</p>}
          {error && <p className="note note-err" role="alert">{error}</p>}
          {report && (
            <div className="note note-info tutor-box">
              <p style={{ marginTop: 0 }}>{report.summary}</p>
              {report.strengths.length > 0 && <><b>You understand</b><ul>{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul></>}
              {report.work_on.length > 0 && <><b>Work on next</b><ul>{report.work_on.map((s) => <li key={s}>{s}</li>)}</ul></>}
              <p style={{ marginBottom: 0 }}><b>To reach the next level:</b> {report.next_level}</p>
              <ReportAi feature="practice-report" text={`${report.summary}\n${report.strengths.join("\n")}\n${report.work_on.join("\n")}\n${report.next_level}`} />
            </div>
          )}
          {aiQs && aiQs.list[aiQs.at] && (() => {
            const a = aiQs.list[aiQs.at]!;
            return (
              <div className="ai-challenge">
                <p className="eyebrow">AI challenge {aiQs.at + 1} of {aiQs.list.length} · {a.topic}</p>
                <p style={{ fontSize: 17 }}><b>{a.question}</b></p>
                <div className="chips" style={{ justifyContent: "flex-start" }}>
                  {a.options.map((o, j) => (
                    <button key={j} type="button" disabled={aiQs.picked !== null}
                      className={`chip ${aiQs.picked !== null && j === a.answer_index ? "chip-right" : ""} ${aiQs.picked === j && j !== a.answer_index ? "chip-wrong" : ""}`}
                      onClick={() => setAiQs({ ...aiQs, picked: j, right: aiQs.right + (j === a.answer_index ? 1 : 0) })}>{o}</button>
                  ))}
                </div>
                {aiQs.picked !== null && <p className={`note ${aiQs.picked === a.answer_index ? "note-ok" : "note-info"}`}>{aiQs.picked === a.answer_index ? "✓ Right. " : "Not quite. "}{a.explanation}</p>}
                {aiQs.picked !== null && <button className="btn btn-inline" onClick={() => setAiQs({ ...aiQs, at: aiQs.at + 1, picked: null })}>{aiQs.at + 1 < aiQs.list.length ? "Next question →" : "Finish"}</button>}
              </div>
            );
          })()}
          {aiQs && !aiQs.list[aiQs.at] && <p className="note note-ok">AI challenge: {aiQs.right} of {aiQs.list.length} right. These are new each time, so come back for more.</p>}
        </section>
      )}
      <p className="hint" style={{ fontSize: 12 }}>Levels show how well you know a class right now, and they move as you practice. Questions marked Draft are still being checked by our review team. AI feedback can be wrong.</p>
    </Page>
  );
}

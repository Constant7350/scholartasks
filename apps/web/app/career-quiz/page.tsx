"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  IMPORTANCE_SCALE, INTEREST_TYPES, LIKE_SCALE, QUIZ_DISCLAIMER, QUIZ_LENGTH, QUIZ_TAGS, RIASEC, WORK_VALUES,
  careerYears, closeTypes, drawNarrowing, drawQuiz, fitLabel, militaryFit, payLine, quizCareers, quizItem, quizTrades, rankedValues, scoreQuiz, summarizeQuiz, topTags,
  type Answer, type InterestItem, type ValueItem,
} from "@scholartasks/core";
import { Page } from "../ui";
import { TRADES } from "../../lib/trades";
import { friendly, supabase } from "../../lib/supabase";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import "./career-quiz.css";

const KEY = "st-career-quiz-v1";
const SEEN_KEY = "st-career-quiz-seen";
const INTEREST_PARTS = 4;
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/** One sitting, kept on this device so a student can stop and come back. */
interface Sitting { seed: number; ids: string[]; answers: Record<string, Answer>; seconds: number; deeper: boolean; done: boolean; narrowed?: number; extras?: { name: string; start: number }[] }
interface Student { id: string; first_name: string; state: string; match_profile: Record<string, unknown> | null }
type Item = InterestItem | ValueItem;
/** A named part of the quiz: questions from `start` up to (not including) `end`. */
interface Part { name: string; hint: string; start: number; end: number }

const load = (): Sitting | null => { try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Sitting) : null; } catch { return null; } };
const store = (s: Sitting | null) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode */ } };
const seenLast = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; } };

function newSitting(): Sitting {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const d = drawQuiz(seed, { avoid: seenLast() });
  return { seed, ids: [...d.interests, ...d.values].map((x) => x.id), answers: {}, seconds: 0, deeper: false, done: false };
}

const ACTIVITY_HINT = "Picture yourself doing it. Don't think about pay, how much school it takes, or whether you're good at it yet.";

/** Splits the questions into parts: four parts of activities, work values, then any extra rounds. */
function partsOf(items: Item[], extras: { name: string; start: number }[] = []): Part[] {
  const firstExtra = extras[0]?.start ?? items.length;
  const base = items.slice(0, firstExtra);
  const firstValue = base.findIndex((x) => "value" in x);
  const nInterest = firstValue < 0 ? base.length : firstValue;
  const size = Math.ceil(nInterest / INTEREST_PARTS);
  const parts: Part[] = [];
  for (let i = 0; i < INTEREST_PARTS && i * size < nInterest; i++) {
    parts.push({ name: `Activities, set ${i + 1}`, hint: ACTIVITY_HINT, start: i * size, end: Math.min(nInterest, (i + 1) * size) });
  }
  if (firstValue >= 0) parts.push({ name: "What matters to you in a job", hint: "Think about the job you would want one day.", start: firstValue, end: firstExtra });
  extras.forEach((x, i) => parts.push({ name: x.name, hint: ACTIVITY_HINT, start: x.start, end: extras[i + 1]?.start ?? items.length }));
  return parts;
}

const firstOpen = (items: Item[], answers: Record<string, Answer>) => {
  const i = items.findIndex((x) => answers[x.id] === undefined);
  return i < 0 ? items.length : i;
};

/**
 * Career interest quiz: a long, research-based quiz about what a student likes to do and what
 * matters to them in a job. Each sitting draws a new mix of questions from a large bank.
 * One question shows at a time, in named parts, and the quiz picks up at the next unanswered
 * question after a break. Open to everyone; signed-in families can save the result.
 */
export default function CareerQuiz() {
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState(0);
  const [lastTick, setLastTick] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [breakAt, setBreakAt] = useState<number | null>(null);
  const [asking, setAsking] = useState<null | "cancel" | "new">(null);

  const items = useMemo(() => (sitting?.ids ?? []).map((id) => quizItem(id)).filter((x): x is Item => !!x), [sitting?.ids]);
  const parts = useMemo(() => partsOf(items, sitting?.extras), [items, sitting?.extras]);

  useEffect(() => {
    const s = load();
    setSitting(s);
    // Come back to the next question that still needs an answer.
    if (s) setPos(firstOpen(s.ids.map((id) => quizItem(id)).filter((x): x is Item => !!x), s.answers));
    setReady(true);
  }, []);
  const save = useCallback((s: Sitting | null) => { setSitting(s); store(s); }, []);
  const top = () => window.scrollTo(0, 0);

  const start = () => {
    if (sitting) try { localStorage.setItem(SEEN_KEY, JSON.stringify(sitting.ids)); } catch { /* ignore */ }
    save(newSitting()); setPos(0); setBreakAt(null); setReviewing(false); setAsking(null); setLastTick(Date.now()); top();
  };
  const cancel = () => {
    if (sitting) try { localStorage.setItem(SEEN_KEY, JSON.stringify(sitting.ids)); } catch { /* ignore */ }
    save(null); setPos(0); setBreakAt(null); setReviewing(false); setAsking(null); top();
  };

  const answeredCount = sitting ? items.filter((x) => sitting.answers[x.id] !== undefined).length : 0;
  const partOf = (i: number) => parts.findIndex((p) => i >= p.start && i < p.end);

  const answer = (id: string, a: Answer, advance = true) => {
    if (!sitting) return;
    const now = Date.now();
    // Count thinking time between answers, but not a break.
    const add = lastTick ? Math.min(60, (now - lastTick) / 1000) : 0;
    setLastTick(now);
    const answers = { ...sitting.answers, [id]: a };
    save({ ...sitting, answers, seconds: sitting.seconds + add });
    if (!advance) return;
    // A short pause so the tap shows, then the answered question slides away.
    window.setTimeout(() => {
      const here = items.findIndex((x) => x.id === id);
      const after = items.findIndex((x, i) => i > here && answers[x.id] === undefined);
      const next = after >= 0 ? after : firstOpen(items, answers);
      if (next < items.length && partOf(next) !== partOf(here)) setBreakAt(next);
      setPos(next);
    }, 220);
  };

  /** Adds an extra round at the end and jumps to it. */
  const addRound = (name: string, ids: string[], patch: Partial<Sitting>) => {
    if (!sitting || !ids.length) return;
    const extras = [...(sitting.extras ?? []), { name, start: sitting.ids.length }];
    save({ ...sitting, ...patch, ids: [...sitting.ids, ...ids], extras, done: false });
    setPos(sitting.ids.length); setBreakAt(sitting.ids.length); setReviewing(false); setLastTick(Date.now()); top();
  };
  const goDeeper = () => {
    if (!sitting) return;
    const extra = drawQuiz(sitting.seed + 1, { perType: QUIZ_LENGTH.deeperPerType, perValue: 0, exclude: sitting.ids });
    addRound("Going deeper", extra.interests.map((x) => x.id), { deeper: true });
  };
  const narrow = () => {
    if (!sitting) return;
    const round = (sitting.narrowed ?? 0) + 1;
    const more = drawNarrowing(scoreQuiz(sitting.answers), sitting.seed + 100 + round, sitting.ids);
    addRound("Narrowing it down", more.map((x) => x.id), { narrowed: round });
  };

  if (!ready) return <Page title="Career interest quiz"><p className="hint">Loading…</p></Page>;

  if (!sitting) {
    return (
      <Page title="Career interest quiz">
        <section className="panel cq-intro">
          <p className="lead">Find careers that fit what you like to do and what matters to you. Then see the college majors, trades and military paths that lead there, in your state first and across the country.</p>
          <ul className="cq-facts">
            <li><b>{QUIZ_LENGTH.perType * 6 + QUIZ_LENGTH.perValue * 6} questions in 5 short parts</b>, about 15 minutes. One question at a time. Leave whenever you like and you&apos;ll pick up where you stopped on this device.</li>
            <li><b>No right or wrong answers.</b> It asks what you would like doing, not what you are good at. Don&apos;t worry about money or school for now.</li>
            <li><b>A new mix every time.</b> Questions come from a bank of over 600, so your quiz is different from your friend&apos;s.</li>
            <li><b>Fair to everyone.</b> It never asks about race, ethnicity, sex or gender, and those never change a result.</li>
          </ul>
          <button className="btn btn-inline" onClick={start}>Start the quiz</button>
          <p className="hint small cq-disclaimer">{QUIZ_DISCLAIMER}</p>
        </section>
        <p className="hint small">Want a quick look first? <a href="/trades/quiz">Pick a few interests to see trades</a> · <a href="/majors">Search colleges by major</a></p>
      </Page>
    );
  }

  const confirmBox = asking && (
    <section className="panel cq-confirm" role="alertdialog" aria-label={asking === "cancel" ? "Cancel the quiz" : "Start a new quiz"}>
      <p><b>{asking === "cancel" ? "Cancel this quiz?" : "Start a new quiz with new questions?"}</b> {answeredCount > 0 ? "Your answers so far will be erased from this device." : ""}{sitting.done && asking === "new" ? " Saved results on a profile stay saved." : ""}</p>
      <div className="cq-nav">
        <button className="btn btn-inline" onClick={asking === "cancel" ? cancel : start}>{asking === "cancel" ? "Yes, cancel it" : "Yes, start a new quiz"}</button>
        <button className="btn btn-ghost btn-inline" onClick={() => setAsking(null)}>No, keep going</button>
      </div>
    </section>
  );
  const quizMenu = (
    <div className="cq-menu">
      <button className="linklike" onClick={() => { setReviewing(true); top(); }} disabled={answeredCount === 0}>Review my answers</button>
      <button className="linklike" onClick={() => setAsking("new")}>Start a new quiz</button>
      <button className="linklike" onClick={() => setAsking("cancel")}>Cancel quiz</button>
    </div>
  );

  if (reviewing) {
    return (
      <Page title="Review my answers">
        {confirmBox}
        <p className="hint">Change any answer, then go back. Questions you haven&apos;t reached yet aren&apos;t shown.</p>
        {parts.map((p) => {
          const rows = items.slice(p.start, p.end).filter((x) => sitting.answers[x.id] !== undefined);
          if (!rows.length) return null;
          return (
            <section key={p.name} className="panel">
              <h2>{p.name}</h2>
              <ol className="cq-review">
                {rows.map((x) => {
                  const scale = "value" in x ? IMPORTANCE_SCALE : LIKE_SCALE;
                  return (
                    <li key={x.id}>
                      <span>{x.text}</span>
                      <select aria-label={`Answer for: ${x.text}`} value={sitting.answers[x.id]} onChange={(e) => answer(x.id, Number(e.target.value) as Answer, false)}>
                        {scale.map((label, i) => <option key={label} value={i}>{label}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        <div className="cq-nav">
          <button className="btn btn-inline" onClick={() => { setReviewing(false); top(); }}>{sitting.done && answeredCount === items.length ? "Back to my results" : "Back to the quiz"}</button>
        </div>
      </Page>
    );
  }

  const allDone = answeredCount === items.length;
  if (sitting.done && allDone) {
    return (
      <Results sitting={sitting} banner={confirmBox} onNew={() => { setAsking("new"); top(); }} onCancel={() => { setAsking("cancel"); top(); }} onReview={() => { setReviewing(true); top(); }} onDeeper={goDeeper} onNarrow={narrow} />
    );
  }

  const progress = (
    <div className="cq-progress" aria-label={`${answeredCount} of ${items.length} answered`}>
      <div className="cq-bar"><span style={{ width: `${Math.round((answeredCount / items.length) * 100)}%` }} /></div>
      <span className="hint small">{answeredCount} of {items.length}</span>
    </div>
  );

  // Every question answered: one tap to see the results.
  if (pos >= items.length || allDone) {
    return (
      <Page title="Career interest quiz">
        {progress}
        {confirmBox}
        <section className="panel cq-break">
          <h2>All done! 🎉</h2>
          <p className="hint">You answered every question. You can look over your answers first, or go straight to your results.</p>
          <div className="cq-nav">
            <button className="btn btn-inline" onClick={() => { save({ ...sitting, done: true }); top(); }}>See my results</button>
            <button className="btn btn-ghost btn-inline" onClick={() => { setReviewing(true); top(); }}>Review my answers</button>
          </div>
        </section>
        {quizMenu}
      </Page>
    );
  }

  const partIdx = partOf(pos);
  const part = parts[partIdx]!;

  // A short break between parts.
  if (breakAt === pos) {
    return (
      <Page title="Career interest quiz">
        {progress}
        {confirmBox}
        <section className="panel cq-break">
          <p className="eyebrow">Part {partIdx} of {parts.length} done</p>
          <h2>Next: {part.name}</h2>
          <p className="hint">{part.hint}</p>
          <div className="cq-nav"><button className="btn btn-inline" onClick={() => { setBreakAt(null); setLastTick(Date.now()); top(); }}>Keep going</button></div>
          <p className="hint small">Need a break? Close the page any time. Your answers are saved on this device.</p>
        </section>
        {quizMenu}
      </Page>
    );
  }

  const x = items[pos]!;
  const scale = "value" in x ? IMPORTANCE_SCALE : LIKE_SCALE;
  const inPart = pos - part.start + 1;
  return (
    <Page title="Career interest quiz">
      {progress}
      {confirmBox}
      <section className="panel cq-one" key={x.id}>
        <p className="eyebrow">Part {partIdx + 1} of {parts.length} · {part.name} · question {inPart} of {part.end - part.start}</p>
        <h2>{"value" in x ? "In a future job, how important is it to…" : "How would you like to…"}</h2>
        <p className="cq-text cq-big">{x.text}</p>
        <div className="cq-scale cq-stack" role="radiogroup" aria-label={x.text}>
          {scale.map((label, i) => (
            <button key={label} role="radio" aria-checked={sitting.answers[x.id] === i} className={`cq-opt cq-opt-${i}${sitting.answers[x.id] === i ? " cq-on" : ""}`} onClick={() => answer(x.id, i as Answer)}>{label}</button>
          ))}
        </div>
        {inPart === 1 && <p className="hint small">{part.hint}</p>}
        <div className="cq-nav">
          {pos > 0 && <button className="btn btn-ghost btn-inline" onClick={() => setPos(pos - 1)}>‹ Back</button>}
          {sitting.answers[x.id] !== undefined && <button className="btn btn-ghost btn-inline" onClick={() => { const n = items.findIndex((y, i) => i > pos && sitting.answers[y.id] === undefined); setPos(n < 0 ? firstOpen(items, sitting.answers) : n); }}>Next ›</button>}
        </div>
      </section>
      {quizMenu}
    </Page>
  );
}

function Results({ sitting, banner, onNew, onCancel, onReview, onDeeper, onNarrow }: { sitting: Sitting; banner: ReactNode; onNew: () => void; onCancel: () => void; onReview: () => void; onDeeper: () => void; onNarrow: () => void }) {
  const result = useMemo(() => scoreQuiz(sitting.answers, { seconds: sitting.seconds }), [sitting]);
  const careers = useMemo(() => quizCareers(result, 10), [result]);
  const trades = useMemo(() => quizTrades(result, TRADES, 8), [result]);
  const themes = topTags(result, 6);
  const values = rankedValues(result);
  const military = militaryFit(result);
  const ordered = [...RIASEC].sort((a, b) => result.scores[b] - result.scores[a]);
  const close = closeTypes(result);

  return (
    <Page title="Your career interest results">
      {banner}
      <p className="hint cq-disclaimer-top"><b>Suggestions to explore, not a decision.</b> Read the note at the bottom of this page.</p>

      <section className="panel">
        <h2>Your strongest interests</h2>
        <div className="cq-top">
          {ordered.slice(0, 3).map((t, i) => (
            <div key={t} className="cq-type">
              <span className="cq-type-icon" aria-hidden>{INTEREST_TYPES[t].icon}</span>
              <b>{i + 1}. {INTEREST_TYPES[t].name}</b>
              <span className="hint small">{INTEREST_TYPES[t].about}</span>
            </div>
          ))}
        </div>
        <ul className="cq-bars">
          {ordered.map((t) => (
            <li key={t}>
              <span>{INTEREST_TYPES[t].name}</span>
              <span className="cq-bar"><span style={{ width: `${result.scores[t]}%` }} /></span>
              <span className="small">{result.scores[t]}</span>
            </li>
          ))}
        </ul>
        <p className="hint small">Your interest code is <b>{result.code}</b> ({[...result.code].map((t) => INTEREST_TYPES[t as keyof typeof INTEREST_TYPES].formal).join(", ")}), from the Holland model that school counselors and the U.S. Labor Department use.</p>
        {themes.length > 0 && <p className="hint">You lit up for: {themes.map((t) => QUIZ_TAGS[t.tag]).join(" · ")}</p>}
        {result.notes.map((n) => <p key={n} className="hint cq-note">{n}</p>)}
      </section>

      {close && (sitting.narrowed ?? 0) < 2 && (
        <section className="panel cq-narrow">
          <h2>Too close to call? Narrow it down</h2>
          <p className="hint">{close.map((t) => INTEREST_TYPES[t].name).join(close.length > 2 ? ", " : " and ")} are only a few points apart. Answer {close.length * QUIZ_LENGTH.narrowPerType} new questions about just {close.length > 2 ? "these" : "these two"}, focused on the themes you liked most, to see which one really stands out. Your answers so far are kept.</p>
          <button className="btn btn-inline" onClick={onNarrow}>Narrow it down</button>
        </section>
      )}

      <section className="panel">
        <h2>Careers through college</h2>
        <p className="hint small">Ranked only by how well they fit your answers. Pay is shown so you can compare, but it never changes the order. Each link shows the best programs in your state first, then nationwide.</p>
        <ol className="items">
          {careers.map(({ key, career, fit, fieldId }) => (
            <li key={key}>
              <div className="item-main">
                <b>{career.name}</b> <span className="pill">{fitLabel(result, fit)}</span>
                <span className="hint">{usd(career.pay)} typical U.S. pay · {career.education} · {careerYears(career)} after high school</span>
                <span className="hint small"><a href={career.url} target="_blank" rel="noopener noreferrer">U.S. Labor Department details</a></span>
              </div>
              <div className="item-actions">
                <a className="btn btn-inline btn-sm link-btn" href={fieldId ? `/majors?field=${fieldId}` : `/majors?q=${encodeURIComponent(career.name)}`}>Colleges for this</a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>Skilled trades</h2>
        <p className="hint small">Trades are an equal path, often with paid training. Each page shows where to train in your state and in every other state.</p>
        <ol className="items">
          {trades.map(({ trade, fit }) => (
            <li key={trade.slug}>
              <div className="item-main">
                <b>{trade.name}</b> <span className="pill">{fitLabel(result, fit)}</span>
                <span className="hint">{trade.summary}</span>
                <span className="hint small">{payLine(trade)}</span>
              </div>
              <div className="item-actions"><a className="btn btn-inline btn-sm link-btn" href={`/trades/${trade.slug}`}>How to start</a></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>Military paths</h2>
        <p className="hint">{military >= 55
          ? "Your answers about teamwork, action and serving fit military paths well."
          : "Worth knowing about even if it isn't your top match."} Serve as an officer after a service academy or ROTC (college paid for), study at a military college, or enlist and get paid training in hundreds of jobs. The GI Bill can pay for college or trade school later.</p>
        <a className="btn btn-inline btn-sm link-btn" href="/military">Compare military paths</a>
      </section>

      <section className="panel">
        <h2>What matters most to you in a job</h2>
        <ol className="cq-values">
          {values.slice(0, 3).map(([v, s]) => (
            <li key={v}><b>{WORK_VALUES[v].name}</b> ({s}): {WORK_VALUES[v].about}. <span className="hint">{WORK_VALUES[v].tip}</span></li>
          ))}
        </ol>
        <p className="hint small">Least important to you right now: {values.slice(-2).map(([v]) => WORK_VALUES[v].name).join(" and ")}.</p>
      </section>

      <SaveCard sitting={sitting} />

      <section className="panel">
        <h2>Next steps</h2>
        <ul className="cq-facts">
          <li>Pick two or three careers above and read about a typical day.</li>
          <li>Try one: a class, a club, a summer program, a part-time job, volunteering or a job shadow.</li>
          <li>Ask the <a href="/counselor">AI counselor</a> what classes and activities lead toward a career you like.</li>
          <li>Take the quiz again in 6 to 12 months. Interests often change in the teen years, and you&apos;ll get new questions.</li>
        </ul>
        <div className="cq-nav">
          {!sitting.deeper && <button className="btn btn-inline" onClick={onDeeper}>Go deeper: {QUIZ_LENGTH.deeperPerType * 6} more questions</button>}
          <button className="btn btn-ghost btn-inline" onClick={onNew}>Take another quiz</button>
          <button className="btn btn-ghost btn-inline" onClick={onReview}>Review my answers</button>
          <button className="btn btn-ghost btn-inline" onClick={() => window.print()}>Print</button>
          <button className="btn btn-ghost btn-inline" onClick={onCancel}>Clear these results</button>
        </div>
        {!sitting.deeper && <p className="hint small">More answers make results steadier. Going deeper keeps your answers and adds new questions.</p>}
      </section>

      <section className="panel cq-disclaimer">
        <h2>Please read</h2>
        <p className="small">{QUIZ_DISCLAIMER}</p>
      </section>
    </Page>
  );
}

/** Signed-in families can keep the result on a student's profile, where the AI counselor uses it. */
function SaveCard({ sitting }: { sitting: Sitting }) {
  const sb = supabase();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [current, setCurrent] = useCurrentStudent();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return setStudents([]);
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return setStudents([]);
      const [mem, st] = await Promise.all([
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name, state, match_profile").order("first_name"),
      ]);
      const own = ((mem.data as { role: string; student_id: string | null }[]) ?? []).find((r) => r.role === "student")?.student_id;
      const list = (st.data as Student[]) ?? [];
      setStudents(own ? list.filter((x) => x.id === own) : list);
      setCurrent((c) => c ?? (own ?? pickStudent(list, list[0]?.id)));
    })();
  }, [sb, setCurrent]);

  if (!students || !sb) return null;
  if (students.length === 0) {
    return (
      <section className="panel">
        <h2>Keep your results</h2>
        <p className="hint">Results stay on this device only. <a href="/signin">Sign in</a> to save them to a student&apos;s profile, so the AI counselor can suggest classes, colleges and scholarships that fit.</p>
      </section>
    );
  }
  const student = students.find((s) => s.id === current) ?? students[0]!;
  const save = async () => {
    setErr(null); setState("saving");
    const summary = summarizeQuiz(scoreQuiz(sitting.answers), TRADES, new Date().toLocaleDateString("en-CA"));
    const profile = { ...(student.match_profile ?? {}), career_quiz: summary };
    const { error } = await sb.rpc("set_match_profile", { p_student: student.id, p_profile: profile });
    if (error) { setErr(friendly(error)); setState("idle"); return; }
    student.match_profile = profile;
    setState("saved");
  };
  return (
    <section className="panel">
      <h2>Save to a profile</h2>
      {students.length > 1 && (
        <p className="hint">Whose results are these?{" "}
          <select value={student.id} onChange={(e) => { setCurrent(e.target.value); setState("idle"); }}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name}</option>)}
          </select>
        </p>
      )}
      <p className="hint">Saving lets the AI counselor use {student.first_name}&apos;s interests when suggesting classes, colleges, trades and scholarships. Only your family can see it.</p>
      <button className="btn btn-inline" disabled={state !== "idle"} onClick={save}>{state === "saved" ? "Saved ✓" : state === "saving" ? "Saving…" : `Save to ${student.first_name}'s profile`}</button>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </section>
  );
}

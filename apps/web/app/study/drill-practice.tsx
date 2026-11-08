"use client";

import { useEffect, useMemo, useState } from "react";
import type { Check } from "./lessons";
import { drillsFor, SUBJECTS, type Drill, type Subject } from "./drills";
import { QuickCheck } from "./quick-check";

const SUBJECT_KEY = "st-drill-subject";
const DONE_KEY = "st-drills-done";

/** Mixes up the options the same way every time, so the right one isn't always first. */
function mixed(c: Check, seed: number): Check {
  const n = c.options.length;
  const shift = (seed * 7 + c.q.length) % n;
  const options = c.options.map((_, i) => c.options[(i + shift) % n]!);
  return { ...c, options, answer: (c.answer - shift + n) % n };
}

const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };

/** Practice the lesson's method in math, science, history and English. Free, no AI. */
export function DrillPractice({ lessonId }: { lessonId: string }) {
  const drills = drillsFor(lessonId);
  const [subject, setSubject] = useState<Subject>("math");
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    const s = read<Subject>(SUBJECT_KEY, "math");
    if (drills.some((d) => d.subject === s)) setSubject(s);
    setDone(read<string[]>(DONE_KEY, []));
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!drills.length) return null;
  const drill = drills.find((d) => d.subject === subject) ?? drills[0]!;
  const pick = (s: Subject) => { setSubject(s); write(SUBJECT_KEY, s); };
  const finished = (s: Subject) => {
    const k = `${lessonId}:${s}`;
    if (done.includes(k)) return;
    const next = [...done, k];
    setDone(next); write(DONE_KEY, next);
  };

  return (
    <>
      <div className="drill-tabs" role="tablist" aria-label="Subjects">
        {SUBJECTS.filter((s) => drills.some((d) => d.subject === s.id)).map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === drill.subject} onClick={() => pick(s.id)}>
            <span aria-hidden="true">{s.icon}</span> {s.label}{done.includes(`${lessonId}:${s.id}`) ? " ✓" : ""}
          </button>
        ))}
      </div>
      <DrillCard key={`${lessonId}:${drill.subject}`} drill={drill} onDone={() => finished(drill.subject)} />
    </>
  );
}

function DrillCard({ drill, onDone }: { drill: Drill; onDone: () => void }) {
  const [hidden, setHidden] = useState(false);
  const [mine, setMine] = useState("");
  const [shown, setShown] = useState(false);
  const checks = useMemo(() => drill.checks.map((c, i) => mixed(c, i + drill.title.length)), [drill]);
  const english = drill.subject === "english";
  const waiting = !!drill.study?.hide && !hidden;

  return (
    <div className="drill" translate={english ? "no" : undefined} lang={english ? "en" : undefined}>
      <p className="drill-title"><b>{drill.title}</b> <span className={`pill ${drill.kind === "memory" ? "pill-memory" : "pill-understand"}`}>{drill.kind === "memory" ? "Memory" : "Understanding"}</span></p>
      <p className="hint drill-how">{drill.how}</p>

      {drill.study && !hidden && (
        <div className="drill-card">
          <span className="eyebrow">{drill.study.title}</span>
          <ul>{drill.study.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          {drill.study.hide && <button type="button" className="btn btn-inline" onClick={() => setHidden(true)}>Hide it and test me</button>}
        </div>
      )}
      {drill.study?.hide && hidden && (
        <p className="hint" style={{ fontSize: 13 }}>Answer from memory first. <button type="button" className="linklike" onClick={() => setHidden(false)}>Peek at the card</button></p>
      )}
      {waiting && <p className="hint" style={{ fontSize: 13 }}>Read the card, then hide it. The questions appear once it&apos;s hidden.</p>}

      {drill.worked && (
        <div className="drill-card">
          <span className="eyebrow">{drill.worked.title}</span>
          <p style={{ margin: "4px 0 6px" }}><b>{drill.worked.problem}</b></p>
          <ol className="lesson-steps">{drill.worked.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      )}

      {!waiting && <QuickCheck checks={checks} onDone={onDone} />}

      {!waiting && drill.explain && (
        <div className="drill-explain">
          <label htmlFor="drill-mine"><b>Explain it in your own words</b></label>
          <p className="hint" style={{ margin: "2px 0 6px" }}>{drill.explain.question}</p>
          <textarea id="drill-mine" className="input" rows={3} value={mine} onChange={(e) => setMine(e.target.value)} />
          {!shown && <button type="button" className="btn btn-ghost btn-inline" style={{ marginTop: 8 }} disabled={mine.trim().length < 10} onClick={() => setShown(true)}>Compare with a model answer</button>}
          {shown && <p className="note note-info" style={{ marginTop: 8 }}><b>One good answer:</b> {drill.explain.answer}</p>}
          <p className="hint" style={{ fontSize: 12, margin: "4px 0 0" }}>Not saved. It&apos;s just for you.</p>
        </div>
      )}

      <p className="drill-turn"><b>Your turn:</b> {drill.yourTurn}</p>
      <a className="hint" href="/practice">More practice questions by subject →</a>
    </div>
  );
}

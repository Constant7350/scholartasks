"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CoursePicker } from "./course-picker";
import { levelFromName } from "./courses";
import { ReportAi } from "../report-ai";

type Level = "standard" | "honors" | "AP" | "IB" | "DE";
interface Planned { course: string; level: Level }
interface Advice {
  summary: string;
  courses: { course: string; planned_level: Level; suggested_level: Level; fit: "good fit" | "stretch" | "reconsider"; reason: string }[];
  rigor_note: string;
  workload_note: string;
  questions_for_counselor: string[];
}

const LEVELS: Record<Level, string> = { standard: "Standard", honors: "Honors", AP: "AP", IB: "IB", DE: "Dual enrollment" };
const FIT = { "good fit": "pill-ok", stretch: "pill-soon", reconsider: "pill-late" } as const;
const key = (id: string) => `st-next-year-${id}`;

/**
 * "Plan next year's classes": the family lists the courses they're
 * considering and gets AI advice on the level of each. Advice only.
 */
export function NextYearCard({ sb, studentId, name, gradeLevel, aiAllowed }: {
  sb: SupabaseClient; studentId: string; name: string; gradeLevel: number; aiAllowed: boolean;
}) {
  const [list, setList] = useState<Planned[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = Math.min(12, gradeLevel + 1);

  // The list stays in this browser for now.
  useEffect(() => {
    try { setList(JSON.parse(localStorage.getItem(key(studentId)) ?? "[]") as Planned[]); } catch { setList([]); }
    setAdvice(null);
  }, [studentId]);
  const save = (l: Planned[]) => { setList(l); try { localStorage.setItem(key(studentId), JSON.stringify(l)); } catch { /* private mode */ } };
  const add = (course: string) => {
    const c = course.trim();
    if (!c || list.some((p) => p.course.toLowerCase() === c.toLowerCase()) || list.length >= 12) return;
    save([...list, { course: c, level: levelFromName(c) }]);
    setDraft("");
  };

  const ask = async () => {
    setBusy(true); setError(null); setAdvice(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/grades/course-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId, nextGrade: next, courses: list }),
      });
      const out = (await res.json().catch(() => null)) as (Advice & { error?: string }) | null;
      if (!res.ok || !out?.courses) throw new Error(out?.error ?? "Sorry, the advice couldn't be loaded. Please try again.");
      setAdvice(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sorry, the advice couldn't be loaded.");
    } finally {
      setBusy(false);
    }
  };

  if (gradeLevel >= 12) return null;
  return (
    <section className="panel">
      <h2>Plan {next}th grade classes</h2>
      <p className="hint">List the classes {name} is thinking about and the level of each. The AI weighs the goal, the grades so far and HOPE's rigor rule, then suggests where to stretch and where to play it safe. This is advice only, so check with the school counselor before signing up.</p>

      <div className="row" style={{ alignItems: "end" }}>
        <div className="field"><label htmlFor="ny-course">Add a class</label>
          <CoursePicker id="ny-course" value={draft} onChange={setDraft} onPick={(c) => add(c)} /></div>
        <button type="button" className="btn btn-ghost btn-inline" disabled={!draft.trim()} onClick={() => add(draft)}>Add</button>
      </div>

      {list.length > 0 && (
        <ul className="items" style={{ marginTop: 12 }}>
          {list.map((p, i) => (
            <li key={p.course}>
              <div className="item-main"><b>{p.course}</b></div>
              <div className="item-actions">
                <select className="input" aria-label={`Level for ${p.course}`} style={{ width: 160 }} value={p.level}
                  onChange={(e) => save(list.map((q, j) => (j === i ? { ...q, level: e.target.value as Level } : q)))}>
                  {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${p.course}`} onClick={() => save(list.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        aiAllowed ? (
          <button className="btn btn-inline" style={{ marginTop: 12 }} disabled={busy} onClick={() => void ask()}>
            {busy ? "Thinking…" : "🤖 Get advice on this plan"}
          </button>
        ) : (
          <p className="note note-info">AI advice is turned off for this account. A parent can turn on AI chat in Family and permissions.</p>
        )
      )}
      {list.length > 0 && aiAllowed && <span className="hint" style={{ marginLeft: 10, fontSize: 12 }}>Uses 1 of today's 10 AI uses.</span>}
      {error && <p className="note note-err" role="alert">{error}</p>}

      {advice && (
        <div className="advice">
          <p style={{ margin: "16px 0 10px" }}>{advice.summary}</p>
          <ReportAi feature="course advice" text={[advice.summary, ...advice.courses.map((c) => JSON.stringify(c))].join("\n")} />
          <ul className="items">
            {advice.courses.map((c) => (
              <li key={c.course} className="advice-row">
                <div className="item-main">
                  <div className="advice-title">
                    <b>{c.course}</b>
                    <span className={`pill ${FIT[c.fit]}`}>{c.fit}</span>
                    {c.suggested_level !== c.planned_level && <span className="pill">Try {LEVELS[c.suggested_level]}</span>}
                  </div>
                  <span className="hint">{c.reason}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint"><b>Rigor:</b> {advice.rigor_note}</p>
          <p className="hint"><b>Workload:</b> {advice.workload_note}</p>
          {advice.questions_for_counselor.length > 0 && (
            <>
              <p className="hint" style={{ marginBottom: 4 }}><b>Questions for the school counselor:</b></p>
              <ul className="gaps">{advice.questions_for_counselor.map((q) => <li key={q}>{q}</li>)}</ul>
            </>
          )}
          <p className="hint" style={{ fontSize: 12, marginTop: 12 }}>AI advice can be wrong. The final choice is yours and the school's.</p>
        </div>
      )}
    </section>
  );
}

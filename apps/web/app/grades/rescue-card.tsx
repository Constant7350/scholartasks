"use client";

import { VoiceButton } from "../voice";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "../../lib/supabase";
import { CHECKIN, EMPTY_ANSWERS, type Answers, type SavedPlan } from "./rescue-questions";
import { ReportAi } from "../report-ai";

export interface RescueTarget { course: string; grade: string }

/**
 * Grade rescue: a short check-in about one class, then an AI plan the student
 * and parent can tick off. Saved plans stay here until marked done.
 */
export function RescueCard({ sb, studentId, name, isParent, aiAllowed, courses, target, onTargetUsed }: {
  sb: SupabaseClient; studentId: string; name: string; isParent: boolean; aiAllowed: boolean;
  /** Classes to choose from (this year's, lowest grade first). */
  courses: RescueTarget[];
  /** Set when "Make a plan" is pressed on the scorecard. */
  target: RescueTarget | null; onTargetUsed: () => void;
}) {
  const box = useRef<HTMLElement>(null);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [pick, setPick] = useState<RescueTarget | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await sb.from("rescue_plans").select("id, course, grade, plan, done_steps, status, check_back, created_at")
      .eq("student_id", studentId).order("created_at", { ascending: false });
    if (!e) setPlans((data as SavedPlan[]) ?? []);
  }, [sb, studentId]);
  useEffect(() => { setPlans([]); void load(); }, [load]);

  useEffect(() => {
    if (!target) return;
    setPick(target); setAnswers(EMPTY_ANSWERS); setError(null); onTargetUsed();
    setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [target, onTargetUsed]);

  const toggle = (id: keyof Answers, v: string, multi?: boolean) => setAnswers((a) => {
    if (!multi) return { ...a, [id]: v };
    const list = a[id] as string[];
    return { ...a, [id]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
  });
  const ready = !!pick && answers.struggles.length > 0 && !!answers.missing && !!answers.hours && !!answers.next_due && !!answers.talked_teacher;

  const submit = async () => {
    if (!pick) return;
    setBusy(true); setError(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/grades/rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId, course: pick.course, grade: pick.grade, answers }),
      });
      const out = (await res.json().catch(() => null)) as (SavedPlan & { error?: string }) | null;
      if (!res.ok || !out?.plan) throw new Error(out?.error ?? "Sorry, the plan couldn't be made. Please try again.");
      setPlans((p) => [out, ...p]);
      setPick(null); setAnswers(EMPTY_ANSWERS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sorry, the plan couldn't be made.");
    } finally {
      setBusy(false);
    }
  };

  const progress = async (p: SavedPlan, done: number[], status: SavedPlan["status"]) => {
    setPlans((list) => list.map((x) => (x === p ? { ...x, done_steps: done, status } : x)));
    if (!p.id) return;
    const { error: e } = await sb.rpc("set_rescue_progress", { p_plan: p.id, p_done_steps: done, p_status: status });
    if (e) { setError(friendly(e)); void load(); }
  };
  const remove = async (p: SavedPlan) => {
    if (!p.id || !window.confirm(`Delete the ${p.course} plan?`)) return;
    const { error: e } = await sb.from("rescue_plans").delete().eq("id", p.id);
    if (e) setError(friendly(e)); else setPlans((list) => list.filter((x) => x !== p));
  };

  const shown = plans.filter((p) => showDone || p.status === "active");
  const doneCount = plans.filter((p) => p.status === "done").length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="panel" ref={box} aria-label="Grade rescue plans">
      <h2>Bring a grade back up</h2>
      <p className="hint">Pick a class that&apos;s below where {isParent ? `${name} wants` : "you want"} it. A few quick questions find out what&apos;s getting in the way, then the AI makes a step-by-step plan. It coaches how to study; it never does the homework.</p>

      {error && <p className="note note-err" role="alert">{error}</p>}

      {!pick ? (
        aiAllowed ? (
          courses.length > 0 ? (
            <div className="row" style={{ alignItems: "end" }}>
              <div className="field" style={{ flex: "0 1 320px" }}><label htmlFor="rescue-course">Class</label>
                <select id="rescue-course" className="input" defaultValue="" onChange={(e) => { const c = courses[Number(e.target.value)]; if (c) { setPick(c); setAnswers(EMPTY_ANSWERS); } }}>
                  <option value="" disabled>Choose a class…</option>
                  {courses.map((c, i) => <option key={c.course + i} value={i}>{c.course} ({c.grade})</option>)}
                </select></div>
            </div>
          ) : <p className="hint">Add this year&apos;s grades below first.</p>
        ) : <p className="note note-info">AI plans are turned off for this account. A parent can turn on AI chat in Family and permissions.</p>
      ) : (
        <div className="checkin">
          <p style={{ margin: "4px 0 12px" }}><b>{pick.course}</b> <span className="grade-chip">{pick.grade}</span></p>
          {CHECKIN.map((q) => (
            <fieldset key={q.id} className="checkin-q">
              <legend>{q.text}</legend>
              <div className="chips">
                {q.options.map((o) => {
                  const val = answers[q.id as keyof Answers];
                  const on = Array.isArray(val) ? val.includes(o.v) : val === o.v;
                  return (
                    <button key={o.v} type="button" className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on}
                      onClick={() => toggle(q.id as keyof Answers, o.v, q.multi)}>{o.label}</button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="field"><label htmlFor="rescue-note">Anything else? (optional)</label>
            <textarea id="rescue-note" className="input" rows={2} maxLength={500} value={answers.note}
              placeholder="For example: I understand it in class but blank on tests."
              onChange={(e) => setAnswers({ ...answers, note: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <VoiceButton value={answers.note} onText={(t) => setAnswers({ ...answers, note: t })} max={500} disabled={busy} />
            <button className="btn btn-inline" disabled={!ready || busy} onClick={() => void submit()}>{busy ? "Making the plan…" : "🤖 Make my plan"}</button>
            <button className="btn btn-ghost btn-inline" disabled={busy} onClick={() => setPick(null)}>Cancel</button>
            <span className="hint" style={{ fontSize: 12, margin: 0 }}>{ready ? "Uses 1 of today's 10 AI uses." : "Answer the questions above to continue."}</span>
          </div>
        </div>
      )}

      {shown.map((p) => {
        const plan = p.plan;
        const done = new Set(p.done_steps);
        return (
          <article key={p.id ?? p.created_at} className={`rescue-plan ${p.status === "done" ? "rescue-done" : ""}`}>
            <div className="rescue-head">
              <b>{p.course}</b> <span className="grade-chip">{p.grade}</span>
              <span className="hint" style={{ margin: 0 }}>
                {p.status === "done" ? "Done" : `${done.size} of ${plan.steps.length} steps`}
                {p.status === "active" && p.check_back && ` · check back ${p.check_back <= today ? "now" : new Date(p.check_back + "T12:00:00").toLocaleDateString()}`}
              </span>
            </div>
            {p.unsaved && <p className="note note-info">This plan isn&apos;t saved yet because a database update is pending.</p>}
            <p style={{ margin: "8px 0" }}>{plan.summary}</p>
            <ReportAi feature="grade rescue" text={[plan.summary, ...plan.steps.map((s) => (typeof s === "string" ? s : JSON.stringify(s)))].join("\n")} />
            {plan.likely_causes.length > 0 && <p className="hint" style={{ margin: "0 0 8px" }}><b>What seems to be going on:</b> {plan.likely_causes.join(" · ")}</p>}
            <ol className="rescue-steps">
              {plan.steps.map((s, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={done.has(i)} disabled={p.status === "done"}
                      onChange={() => void progress(p, done.has(i) ? p.done_steps.filter((x) => x !== i) : [...p.done_steps, i], p.status)} />
                    <span><span className="pill">{s.when}</span> <b>{s.action}</b> <span className="hint">{s.why}</span></span>
                  </label>
                </li>
              ))}
            </ol>
            <details className="rescue-more">
              <summary>What to say to the teacher, study tips and how a parent can help</summary>
              <p><b>Talking with the teacher:</b> “{plan.talk_to_teacher}”</p>
              <ul className="gaps">{plan.study_tips.map((t) => <li key={t}>{t}</li>)}</ul>
              <p><b>For the parent:</b> {plan.parent_tip}</p>
            </details>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {p.status === "active"
                ? <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void progress(p, p.done_steps, "done")}>✓ Grade is back up, mark done</button>
                : <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void progress(p, p.done_steps, "active")}>Reopen</button>}
              {aiAllowed && p.status === "active" && p.check_back && p.check_back <= today && (
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => { setPick({ course: p.course, grade: p.grade }); setAnswers(EMPTY_ANSWERS); }}>Check in again</button>
              )}
              {isParent && p.id && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void remove(p)}>Delete</button>}
            </div>
          </article>
        );
      })}
      {doneCount > 0 && <button className="linklike" style={{ marginTop: 8 }} onClick={() => setShowDone(!showDone)}>{showDone ? "Hide finished plans" : `Show ${doneCount} finished ${doneCount === 1 ? "plan" : "plans"}`}</button>}
      <p className="hint" style={{ marginTop: 12 }}>📚 The <a href="/study">study skills library</a> has free lessons on testing yourself, spacing out review and getting test-ready, and <a href="/practice">practice questions</a> help you check what you know.</p>
      <p className="hint" style={{ fontSize: 12, marginTop: 12 }}>AI advice can be wrong. The teacher and your family know best.</p>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { checkPlan, primaryGpa, type CourseLevel, type PlanCourse } from "@scholartasks/core";
import { packFor } from "../../../lib/state-packs";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { IconTabs } from "../../icon-tabs";
import { rememberedStudent } from "../../../lib/current-student";
import { CoursePicker } from "../course-picker";
import { levelFromName, subjectOf } from "../courses";
import { ReportAi } from "../../report-ai";

interface Student { id: string; first_name: string; grade_level: number; state: string; permissions: Record<string, boolean> }
interface PlanRow { id: string; grade_level: number; course: string; subject: string | null; level: CourseLevel; credits: number }
interface Taken { course: string; grade: string; level: CourseLevel; grade_level: number }
interface Review { summary: string; years: { grade: number; note: string }[]; suggestions: string[]; questions_for_counselor: string[] }

const LEVELS: Record<CourseLevel, string> = { standard: "Standard", honors: "Honors", AP: "AP", IB: "IB", DE: "Dual enrollment" };
const GRADES = [9, 10, 11, 12] as const;

/**
 * Four-year course planner: lay out grades 9 to 12 course by course, see the
 * graduation credits and the state scholarship's rigor courses add up, and
 * ask the AI to check the plan. Classes already graded show as taken.
 */
export default function CoursePlanner() {
  const sb = supabase();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [isParent, setIsParent] = useState(false);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [taken, setTaken] = useState<Taken[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/grades/plan");
    const wanted = rememberedStudent();
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, grade_level, state, permissions").order("first_name"),
    ]);
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const list = (st.data as Student[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    setIsParent(m.some((r) => r.role === "parent"));
    const pick = list.find((x) => x.id === wanted) ?? list.find((x) => x.id === own) ?? list[0] ?? null;
    setStudent(pick);
    if (!pick) return;
    const [p, g] = await Promise.all([
      sb.from("course_plan").select("id, grade_level, course, subject, level, credits").eq("student_id", pick.id).order("grade_level").order("sort_order").order("created_at"),
      sb.from("course_grades").select("course, grade, level, grade_level").eq("student_id", pick.id).gte("grade_level", 9),
    ]);
    setPlan(((p.data as PlanRow[]) ?? []).map((r) => ({ ...r, credits: Number(r.credits) })));
    setTaken((g.data as Taken[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const pack = student ? packFor(student.state) : null;
  const main = primaryGpa(pack);
  const all: PlanCourse[] = useMemo(() => {
    const seen = new Set<string>();
    const done = taken.filter((t) => { const k = `${t.grade_level}:${t.course.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((t) => ({ grade: t.grade_level, course: t.course, subject: subjectOf(t.course)?.name ?? null, level: t.level, done: true }));
    return [...done, ...plan.map((r) => ({ grade: r.grade_level, course: r.course, subject: r.subject, level: r.level, credits: r.credits }))];
  }, [plan, taken]);
  const check = useMemo(() => checkPlan(all, { state: student?.state, rigorNeeded: main?.rigorNeeded, rigorLevels: main?.program.rules.rigor_levels }), [all, student?.state, main]);

  if (!sb) return <Page title="Four-year course plan"><NotConfigured /></Page>;
  if (student === undefined) return <Page title="Four-year course plan"><p className="hint">Loading…</p></Page>;
  if (!student) return <Page title="Four-year course plan"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const aiAllowed = isParent || !!student.permissions?.ai_chat;

  const add = async (grade: number, name: string) => {
    const course = name.trim().slice(0, 120);
    if (!course) return;
    if (all.some((c) => c.grade === grade && c.course.toLowerCase() === course.toLowerCase())) return setError(`${course} is already in grade ${grade}.`);
    setError(null);
    const { error: e } = await sb.from("course_plan").insert({
      student_id: student.id, grade_level: grade, course, subject: subjectOf(course)?.name ?? null, level: levelFromName(course), sort_order: plan.length,
    });
    if (e) return setError(friendly(e.message));
    setDrafts((d) => ({ ...d, [grade]: "" }));
    setReview(null);
    await load();
  };
  const update = async (id: string, patch: Partial<PlanRow>) => {
    setPlan((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error: e } = await sb.from("course_plan").update(patch).eq("id", id);
    if (e) { setError(friendly(e.message)); await load(); }
    setReview(null);
  };
  const remove = async (id: string) => {
    setPlan((p) => p.filter((r) => r.id !== id));
    const { error: e } = await sb.from("course_plan").delete().eq("id", id);
    if (e) { setError(friendly(e.message)); await load(); }
    setReview(null);
  };

  const ask = async () => {
    setBusy(true); setError(null); setReview(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/grades/plan-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId: student.id }),
      });
      const out = (await res.json().catch(() => null)) as (Review & { error?: string }) | null;
      if (!res.ok || !out?.summary) throw new Error(out?.error ?? "Sorry, the check couldn't be loaded. Please try again.");
      setReview(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sorry, the check couldn't be loaded.");
    } finally {
      setBusy(false);
    }
  };

  const planStart = "grade-" + String(Math.min(12, Math.max(9, student.grade_level)));
  return (
    <Page title="Four-year course plan">
      <p className="hint"><a href="/grades">← Grades</a></p>
      <p className="hint">Add the classes {student.first_name} plans to take each year. It&apos;s a plan, not a sign-up: check it with the school counselor.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      <IconTabs label="Parts of the course plan" start={planStart} tabs={[
        { key: "checklist", icon: check.ready ? "✅" : "📋", label: "Checklist", body: <>
      <section className="panel">
        <h2>{check.ready ? "✓ On track" : "Checklist"}</h2>
        <ul className="items">
          {check.lines.map((l) => (
            <li key={l.label}>
              <div className="item-main"><b>{l.ok ? "✓" : "○"} {l.label}</b></div>
              <div className="item-actions"><span className={`pill ${l.ok ? "pill-ok" : "pill-soon"}`}>{l.planned} of {l.needed}</span></div>
            </li>
          ))}
          {check.rigorNeeded > 0 && (
            <li>
              <div className="item-main">
                <b>{check.rigorPlanned >= check.rigorNeeded ? "✓" : "○"} Rigor courses for {main?.program.name}</b>
                <span className="hint small">AP, IB and dual enrollment classes count. Your school may count more (like level 3 world languages); check the official list on <a href="https://www.gafutures.org" target="_blank" rel="noopener noreferrer">GAfutures</a>.</span>
              </div>
              <div className="item-actions"><span className={`pill ${check.rigorPlanned >= check.rigorNeeded ? "pill-ok" : "pill-soon"}`}>{check.rigorPlanned} of {check.rigorNeeded}</span></div>
            </li>
          )}
          {check.rules.sameLanguage ? (
            <li>
              <div className="item-main"><b>{check.sameLanguageYears >= check.rules.sameLanguage ? "✓" : "○"} Same world language for {check.rules.sameLanguage} years</b><span className="hint small">Most four-year colleges ask for this.</span></div>
              <div className="item-actions"><span className={`pill ${check.sameLanguageYears >= check.rules.sameLanguage ? "pill-ok" : "pill-soon"}`}>{check.sameLanguageYears} of {check.rules.sameLanguage}</span></div>
            </li>
          ) : null}
        </ul>
        {check.warnings.length > 0 && <ul className="gaps">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        <p className="hint small">{check.rules.note}</p>
        {aiAllowed ? (
          <>
            <button className="btn btn-inline" disabled={busy || all.length === 0} onClick={() => void ask()}>{busy ? "Checking…" : "🤖 Check my plan with AI"}</button>
            <span className="hint" style={{ marginLeft: 10, fontSize: 12 }}>Uses 1 of today&apos;s AI uses.</span>
          </>
        ) : <p className="note note-info">AI checks are turned off for this account. A parent can turn on AI chat in Family and permissions.</p>}
        {review && (
          <div className="advice">
            <p style={{ margin: "16px 0 10px" }}>{review.summary}</p>
            <ReportAi feature="course plan check" text={[review.summary, ...review.years.map((y) => y.note), ...review.suggestions].join("\n")} />
            {review.years.length > 0 && <ul className="items">{review.years.map((y) => <li key={y.grade}><div className="item-main"><b>Grade {y.grade}</b><span className="hint">{y.note}</span></div></li>)}</ul>}
            {review.suggestions.length > 0 && <><p className="hint" style={{ marginBottom: 4 }}><b>Ideas to consider:</b></p><ul className="gaps">{review.suggestions.map((q) => <li key={q}>{q}</li>)}</ul></>}
            {review.questions_for_counselor.length > 0 && <><p className="hint" style={{ marginBottom: 4 }}><b>Questions for the school counselor:</b></p><ul className="gaps">{review.questions_for_counselor.map((q) => <li key={q}>{q}</li>)}</ul></>}
            <p className="hint" style={{ fontSize: 12, marginTop: 12 }}>AI advice can be wrong. The final choice is yours and the school&apos;s.</p>
          </div>
        )}
      </section>

        </> },
      ...GRADES.map((g) => {
        const done = all.filter((c) => c.grade === g && c.done);
        const rows = plan.filter((r) => r.grade_level === g);
        return { key: `grade-${g}`, icon: "📚", label: `Grade ${g}`, count: rows.length + taken.filter((t) => t.grade_level === g).length, body: (
          <section key={g} className="panel">
            <h2>Grade {g} <span className="pill">{check.creditsByGrade[g] ?? 0} credits</span>{(check.rigorByGrade[g] ?? 0) > 0 && <span className="pill">{check.rigorByGrade[g]} rigor</span>}</h2>
            <ul className="items">
              {taken.filter((t) => t.grade_level === g).filter((t, i, a) => a.findIndex((x) => x.course === t.course) === i).map((t) => (
                <li key={`t-${t.course}`}>
                  <div className="item-main"><b>{t.course}</b><span className="hint small">Taken · {LEVELS[t.level]} · grade {t.grade}</span></div>
                </li>
              ))}
              {rows.map((r) => (
                <li key={r.id}>
                  <div className="item-main"><b>{r.course}</b><span className="hint small">{r.subject ?? "Elective"}</span></div>
                  <div className="item-actions">
                    <select className="input" aria-label={`Level for ${r.course}`} style={{ width: 150 }} value={r.level} onChange={(e) => void update(r.id, { level: e.target.value as CourseLevel })}>
                      {(Object.keys(LEVELS) as CourseLevel[]).map((k) => <option key={k} value={k}>{LEVELS[k]}</option>)}
                    </select>
                    <select className="input" aria-label={`Credits for ${r.course}`} style={{ width: 90 }} value={String(r.credits)} onChange={(e) => void update(r.id, { credits: Number(e.target.value) })}>
                      {["0.5", "1", "2"].map((c) => <option key={c} value={c}>{c} cr</option>)}
                    </select>
                    <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${r.course}`} onClick={() => void remove(r.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            {done.length === 0 && rows.length === 0 && <p className="hint small">No classes yet.</p>}
            <div className="row" style={{ alignItems: "end" }}>
              <div className="field"><label htmlFor={`plan-${g}`}>Add a class</label>
                <CoursePicker id={`plan-${g}`} value={drafts[g] ?? ""} onChange={(v) => setDrafts((d) => ({ ...d, [g]: v }))} onPick={(c) => void add(g, c)} /></div>
              <button type="button" className="btn btn-ghost btn-inline" disabled={!(drafts[g] ?? "").trim()} onClick={() => void add(g, drafts[g] ?? "")}>Add</button>
            </div>
          </section>
        ) };
      }),
      ]} />
    </Page>
  );
}

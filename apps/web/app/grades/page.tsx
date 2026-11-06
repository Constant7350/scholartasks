"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { displayGpa, primaryGpa, type CourseGrade } from "@scholartasks/core";
import { checkStatePrograms, packFor } from "../../lib/state-packs";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { CoursePicker } from "./course-picker";
import { levelFromName } from "./courses";
import { ImportCard } from "./import-card";
import { GpaScorecard } from "./scorecard";
import { GoalsCard } from "./goals-card";
import { NextYearCard } from "./next-year-card";
import { TranscriptsCard } from "./transcripts-card";
import { RescueCard, type RescueTarget } from "./rescue-card";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";

const LETTERS = ["A", "B", "C", "D", "F"] as const;
const LEVELS: Record<string, string> = { standard: "Standard", honors: "Honors", AP: "AP", IB: "IB", DE: "Dual enrollment" };
const TERMS = ["Fall", "Spring", "Full year", "Summer"];

interface Student { id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null; permissions: Record<string, boolean>; weight_rigor?: number; weight_honors?: number; goal_gpa?: number | null; min_grade?: string }
interface Row { id: string; student_id: string; term: string; course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number }

export default function GradesPage() {
  const sb = supabase();
  const [role, setRole] = useState<"parent" | "student" | null | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [rescue, setRescue] = useState<RescueTarget | null>(null);
  const clearRescue = useCallback(() => setRescue(null), []);
  const [scores, setScores] = useState({ sat: "", act: "" });
  const [form, setForm] = useState({ course: "", grade: "A" as CourseGrade["grade"], level: "standard" as CourseGrade["level"], core: true, grade_level: "", term: "Fall" });

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/grades");
    const [mem, st, gr] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("*").order("first_name"),
      sb.from("course_grades").select("id, student_id, term, course, grade, level, core, grade_level").order("grade_level").order("created_at"),
    ]);
    const m = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = m.find((r) => r.role === "student");
    setRole(m.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null);
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setRows((gr.data as Row[]) ?? []);
    setCurrent((c) => c ?? (asStudent?.student_id ?? pickStudent(list, list[0]?.id)));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  useEffect(() => {
    if (student) {
      setScores({ sat: student.sat?.toString() ?? "", act: student.act?.toString() ?? "" });
      setForm((f) => ({ ...f, grade_level: f.grade_level || String(Math.max(9, Math.min(12, student.grade_level))) }));
    }
  }, [student]);

  const mine = rows.filter((r) => r.student_id === current);
  const results = useMemo(() => {
    if (!student) return [];
    const grades: CourseGrade[] = mine.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
    return checkStatePrograms(student, grades);
  }, [student, mine]);

  if (!sb) return <Page title="Grades and scholarships"><NotConfigured /></Page>;
  if (role === undefined) return <Page title="Grades and scholarships"><p className="hint">Loading…</p></Page>;
  if (!role || !student)
    return (
      <Page title="Grades and scholarships">
        <div className="panel family-card">
          <div>
            <h2>Add your student first</h2>
            <p className="hint" style={{ margin: 0 }}>Grades belong to a student. Add yours, then come back. Or try the <a href="/tools/hope">quick state scholarship checker</a> without saving anything.</p>
          </div>
          <a className="btn btn-inline link-btn" href="/family">Add a student</a>
        </div>
      </Page>
    );

  const pack = packFor(student.state);
  const label = primaryGpa(pack)?.label ?? "GPA";
  const canEdit = role === "parent" || !!student.permissions?.enter_grades;
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) setError(friendly(e));
    await load();
    return !e;
  };
  const aiAllowed = role === "parent" || !!student.permissions?.ai_chat;
  const latestYear = Math.max(-1, ...mine.filter((r) => r.grade_level <= student.grade_level).map((r) => r.grade_level));
  const rescueCourses = mine.filter((r) => r.grade_level === latestYear)
    .sort((a, b) => LETTERS.indexOf(b.grade) - LETTERS.indexOf(a.grade) || a.course.localeCompare(b.course))
    .map((r) => ({ course: r.course, grade: r.grade }));
  const byYear = [9, 10, 11, 12, 8, 7, 6].map((y) => ({ y, list: mine.filter((r) => r.grade_level === y) })).filter((g) => g.list.length);

  return (
    <Page title={role === "parent" ? `${student.first_name}'s grades` : "My grades"}>
      {role === "parent" && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {error && <p className="note note-err" role="alert">{error}</p>}
      {!canEdit && <p className="note note-info">Your parent has turned off grade entry for your account, so this page is view-only.</p>}

      {(
        <GpaScorecard
          rows={mine}
          currentGrade={student.grade_level}
          pack={pack}
          goal={student.goal_gpa == null ? null : Number(student.goal_gpa)}
          minGrade={student.min_grade}
          weights={{ rigor: Number(student.weight_rigor ?? 1), honors: Number(student.weight_honors ?? 0.5) }}
          onSaveWeights={canEdit ? (w) => run(() => sb.rpc("set_school_weights", { p_student: student.id, p_rigor: w.rigor, p_honors: w.honors })) : undefined}
          onRescue={aiAllowed ? (course, grade) => setRescue({ course, grade }) : undefined}
        />
      )}
      {(
        <GoalsCard
          pack={pack}
          name={student.first_name}
          goal={student.goal_gpa == null ? null : Number(student.goal_gpa)}
          minGrade={student.min_grade ?? "B"}
          canEdit={canEdit}
          onSave={(g, m) => run(() => sb.rpc("set_student_goal", { p_student: student.id, p_goal_gpa: g, p_min_grade: m }))}
        />
      )}

      <section className="tiles" style={{ marginTop: 8 }}>
        {results.map((r) => (
          <div key={r.programId} className={`tile ${r.status === "eligible" ? "tile-ok" : ""}`}>
            <b>{r.programName}</b>
            <span className="big-num">{r.gpa === null ? "—" : displayGpa(r.gpa)}</span>
            <span>{r.gpa === null ? `Add courses to see the ${label}.` : `${label} from the courses below`}</span>
            {r.status === "eligible" ? (
              <span className="pill pill-ok">On track to qualify</span>
            ) : (
              <ul className="gaps">{r.gaps.map((g, i) => <li key={i}>{g.message}</li>)}</ul>
            )}
            {r.checks.length > 0 && <span className="hint" style={{ fontSize: 12 }}>Also needed: {r.checks.join("; ")}.</span>}
          </div>
        ))}
      </section>
      {pack ? (
        <p className="hint" style={{ fontSize: 12 }}>Estimate only. {pack.aid_site ? `${pack.aid_site.name} shows` : `The ${pack.agency.name} decides`} the official {label}. {pack.name} rules come from a draft pack being checked with the {pack.agency.name}.{results.length === 0 ? ` ${pack.name} has no grade-based state scholarship; its state grants are on the financial aid page.` : ""}</p>
      ) : (
        <p className="hint" style={{ fontSize: 12 }}>ScholarTasks doesn&apos;t have {student.state} state scholarship rules yet. Grades, the scorecard and national scholarships all still work; see the <a href="/aid">financial aid page</a> for your state&apos;s aid office.</p>
      )}

      <section className="panel">
        <h2>Test scores</h2>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() => sb.rpc("set_test_scores", { p_student: student.id, p_sat: scores.sat ? Number(scores.sat) : null, p_act: scores.act ? Number(scores.act) : null }));
            if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
          }}
        >
          <div className="field" style={{ flex: "0 1 160px" }}><label htmlFor="sat">Best SAT (400–1600)</label><input id="sat" className="input" inputMode="numeric" disabled={!canEdit} value={scores.sat} onChange={(e) => setScores({ ...scores, sat: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
          <div className="field" style={{ flex: "0 1 160px" }}><label htmlFor="act">Best ACT (1–36)</label><input id="act" className="input" inputMode="numeric" disabled={!canEdit} value={scores.act} onChange={(e) => setScores({ ...scores, act: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></div>
          {canEdit && <button className="btn btn-inline">{saved ? "✓ Saved" : "Save scores"}</button>}
        </form>
      </section>

      <RescueCard sb={sb} studentId={student.id} name={student.first_name} isParent={role === "parent"} aiAllowed={aiAllowed}
        courses={rescueCourses} target={rescue} onTargetUsed={clearRescue} />

      {(
        <NextYearCard sb={sb} studentId={student.id} name={student.first_name} gradeLevel={student.grade_level} aiAllowed={aiAllowed} />
      )}
      <p className="hint"><a className="btn btn-ghost btn-inline btn-sm link-btn" href="/grades/plan">🗓️ Plan all four years of classes</a> Lay out grade 9 to 12 and check graduation credits and rigor courses.</p>

      {canEdit && <ImportCard sb={sb} studentId={student.id} file={importFile} onSaved={() => void load()} />}

      <TranscriptsCard sb={sb} studentId={student.id} name={student.first_name} canEdit={canEdit} onRead={(f) => setImportFile(f)} />
      <section className="panel family-card">
        <div>
          <h2>Self-reported academic record</h2>
          <p className="hint" style={{ margin: 0 }}>A printable summary of {student.first_name}&apos;s courses, grades, GPAs and test scores, for colleges that let you report grades yourself. It&apos;s marked unofficial.</p>
        </div>
        <a className="btn btn-inline link-btn" href={`/grades/record?student=${student.id}`}>Open the record</a>
      </section>

      <section className="panel">
        <h2>Courses and grades</h2>
        <p className="hint">Add final grades for each course. Core courses (English, math, science, social studies and world languages) count toward {label === "GPA" ? "most state scholarships" : `the ${label}`}.</p>
        {canEdit && (
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() => sb.from("course_grades").insert({
                student_id: student.id, course: form.course.trim(), grade: form.grade, level: form.level, core: form.core, grade_level: Number(form.grade_level), term: form.term,
              }));
              if (ok) setForm({ ...form, course: "" });
            }}
          >
            <div className="field"><label htmlFor="g-course">Course</label>
              <CoursePicker value={form.course} onChange={(course) => setForm({ ...form, course })} onPick={(course, core) => setForm({ ...form, course, core, level: levelFromName(course) })} /></div>
            <div className="field" style={{ flex: "0 1 90px" }}><label htmlFor="g-grade">Grade</label>
              <select id="g-grade" className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as CourseGrade["grade"] })}>{LETTERS.map((l) => <option key={l}>{l}</option>)}</select></div>
            <div className="field" style={{ flex: "0 1 170px" }}><label htmlFor="g-level">Level</label>
              <select id="g-level" className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as CourseGrade["level"] })}>{Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field" style={{ flex: "0 1 120px" }}><label htmlFor="g-year">Year</label>
              <select id="g-year" className="input" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })}>{[8, 9, 10, 11, 12].map((y) => <option key={y} value={y}>Grade {y}</option>)}</select></div>
            <div className="field" style={{ flex: "0 1 140px" }}><label htmlFor="g-term">Term</label>
              <select id="g-term" className="input" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <label className="toggle" style={{ border: 0, margin: 0, padding: "0 0 12px" }}><input type="checkbox" checked={form.core} onChange={(e) => setForm({ ...form, core: e.target.checked })} /> Core course</label>
            <button className="btn btn-inline" disabled={!form.course.trim()}>Add course</button>
          </form>
        )}

        {byYear.length === 0 ? (
          <p className="hint" style={{ marginTop: 14 }}>No courses yet.</p>
        ) : (
          byYear.map(({ y, list }) => (
            <div key={y} style={{ marginTop: 18 }}>
              <p className="eyebrow">Grade {y}</p>
              <ul className="items">
                {list.map((r) => (
                  <li key={r.id}>
                    <div className="item-main">
                      <b>{r.course}</b>
                      <span className="hint">{LEVELS[r.level]} · {r.term}{r.core ? " · core" : ""}</span>
                    </div>
                    <div className="item-actions">
                      <span className="grade-chip">{r.grade}</span>
                      {canEdit && <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${r.course}`} onClick={() => run(() => sb.from("course_grades").delete().eq("id", r.id))}>Remove</button>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </Page>
  );
}

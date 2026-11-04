"use client";

import { useCallback, useEffect, useState } from "react";
import { buildScorecard, displayGpa, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../../../packs/states/GA.json";
import { supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { rememberedStudent } from "../../../lib/current-student";
import { printPage } from "../../../lib/print";
import { CATEGORIES, RECOGNITION, gradeText, hoursPerYear, type Activity } from "../shared";

const GA = gaPack as unknown as StatePack;

interface Student {
  id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null;
  weight_rigor?: number; weight_honors?: number; high_school?: string | null; grad_year?: number | null;
}
interface Row { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }

/** Name and contact line live only on this device: no need to store a teen's phone number. */
const contactKey = (id: string) => `st-resume-${id}`;

/** A one-page resume built from Activities and Grades. Print or save as PDF. */
export default function ResumePage() {
  const sb = supabase();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [items, setItems] = useState<Activity[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [head, setHead] = useState({ name: "", contact: "", showGpa: true });

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/activities/resume");
    const wanted = rememberedStudent();
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("*").order("first_name"),
    ]);
    const list = (st.data as Student[]) ?? [];
    const own = ((mem.data as { role: string; student_id: string | null }[]) ?? []).find((r) => r.role === "student")?.student_id;
    const pick = list.find((x) => x.id === wanted) ?? list.find((x) => x.id === own) ?? list[0] ?? null;
    setStudent(pick);
    if (!pick) return;
    try {
      const saved = JSON.parse(localStorage.getItem(contactKey(pick.id)) ?? "null");
      setHead(saved ?? { name: pick.first_name, contact: "", showGpa: true });
    } catch { setHead({ name: pick.first_name, contact: "", showGpa: true }); }
    const [a, g] = await Promise.all([
      sb.from("student_activities").select("*").eq("student_id", pick.id).order("sort_order").order("created_at"),
      sb.from("course_grades").select("course, grade, level, core, grade_level, term").eq("student_id", pick.id),
    ]);
    setItems((a.data as Activity[]) ?? []);
    setGrades((g.data as Row[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!student) return;
    try { localStorage.setItem(contactKey(student.id), JSON.stringify(head)); } catch { /* private mode */ }
  }, [head, student]);

  if (!sb) return <Page title="Resume"><NotConfigured /></Page>;
  if (student === undefined) return <Page title="Resume"><p className="hint">Loading…</p></Page>;
  if (!student) return <Page title="Resume"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const cg: CourseGrade[] = grades.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
  const hope = GA.programs.find((p) => p.rules.gpa_formula);
  const formula = hope?.rules.gpa_formula ? GA.gpa_formulas[hope.rules.gpa_formula] : undefined;
  const w = { rigor: Number(student.weight_rigor ?? 1), honors: Number(student.weight_honors ?? 0.5) };
  const card = formula && cg.length ? buildScorecard(cg, { currentGrade: student.grade_level, formula, target: 3, schoolWeights: w }) : null;
  const activities = items.filter((i) => i.kind === "activity");
  const honors = items.filter((i) => i.kind === "honor");
  const work = activities.filter((a) => a.category === "work");
  const other = activities.filter((a) => a.category !== "work");
  const total = activities.reduce((n, a) => n + hoursPerYear(a), 0);
  const ap = cg.filter((c) => ["AP", "IB", "DE"].includes(c.level)).length;

  const print = async () => {
    await sb.rpc("log_access", { p_student: student.id, p_action: "export", p_details: { what: "resume" } }).then(() => null, () => null);
    printPage();
  };

  const entry = (a: Activity) => (
    <li key={a.id} className="resume-entry">
      <div className="resume-line">
        <b>{a.position}{a.organization ? `, ${a.organization}` : ""}</b>
        <span>{gradeText(a.grades)}{a.ongoing && a.grades.length ? " (current)" : ""}</span>
      </div>
      {a.description && <p>{a.description}</p>}
      {a.hours_per_week ? <p className="resume-meta">{a.hours_per_week} hours a week, {a.weeks_per_year ?? 0} weeks a year{a.category !== "work" && a.category !== "other" ? ` · ${CATEGORIES[a.category]}` : ""}</p> : null}
    </li>
  );

  return (
    <Page>
      <div className="no-print">
        <a href="/activities" className="hint">← Back to activities</a>
        <h1 style={{ marginBottom: 6 }}>Resume</h1>
        <p className="hint">Built from your activities and grades. Type the name and contact line you want at the top (they stay on this device only), then print or save it as a PDF for scholarship, job and college forms that ask for a resume.</p>
        <div className="row panel" style={{ alignItems: "end" }}>
          <div className="field"><label htmlFor="r-name">Full name</label>
            <input id="r-name" className="input" maxLength={80} value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="r-contact">Email, phone or city (optional)</label>
            <input id="r-contact" className="input" maxLength={140} value={head.contact} placeholder="name@email.com · Athens, GA" onChange={(e) => setHead({ ...head, contact: e.target.value })} /></div>
          <label className="item-check" style={{ paddingBottom: 10 }}>
            <input type="checkbox" checked={head.showGpa} onChange={(e) => setHead({ ...head, showGpa: e.target.checked })} /><span>Show GPA</span>
          </label>
        </div>
        <button className="btn btn-inline" style={{ margin: "4px 0 18px" }} onClick={() => void print()}>🖨 Print or save as PDF</button>
        {items.length === 0 && <p className="note">No activities yet. <a href="/activities">Add a few</a> and they show up here.</p>}
      </div>

      <article className="record-sheet resume-sheet">
        <header className="resume-head">
          <h2>{head.name || student.first_name}</h2>
          {head.contact && <p>{head.contact}</p>}
        </header>

        <section className="resume-section">
          <h3>Education</h3>
          <div className="resume-line">
            <b>{student.high_school || "High school"}</b>
            <span>{student.grad_year ? `Class of ${student.grad_year}` : `Grade ${student.grade_level}`}</span>
          </div>
          <p>
            {[
              head.showGpa && card?.overallGpa != null ? `GPA ${displayGpa(card.overallGpa)} unweighted` : null,
              head.showGpa && card?.schoolGpa != null ? `${displayGpa(card.schoolGpa)} weighted` : null,
              student.sat ? `SAT ${student.sat}` : null,
              student.act ? `ACT ${student.act}` : null,
              ap ? `${ap} AP, IB or dual enrollment course${ap === 1 ? "" : "s"}` : null,
            ].filter(Boolean).join(" · ") || " "}
          </p>
        </section>

        {honors.length > 0 && (
          <section className="resume-section">
            <h3>Honors and awards</h3>
            <ul className="resume-list">
              {honors.map((h) => (
                <li key={h.id} className="resume-line"><b>{h.position}</b><span>{RECOGNITION[h.recognition ?? "school"]}{h.grades.length ? ` · ${gradeText(h.grades)}` : ""}</span></li>
              ))}
            </ul>
          </section>
        )}
        {work.length > 0 && <section className="resume-section"><h3>Work experience</h3><ul className="resume-list">{work.map(entry)}</ul></section>}
        {other.length > 0 && <section className="resume-section"><h3>Activities and service</h3><ul className="resume-list">{other.map(entry)}</ul></section>}
        {total > 0 && <p className="resume-meta" style={{ marginTop: 12 }}>About {total.toLocaleString()} hours a year across all activities.</p>}
      </article>
    </Page>
  );
}

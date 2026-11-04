"use client";

import { useCallback, useEffect, useState } from "react";
import { buildScorecard, displayGpa, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../../../packs/states/GA.json";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { rememberedStudent } from "../../../lib/current-student";

const GA = gaPack as unknown as StatePack;
const LEVELS: Record<string, string> = { standard: "Standard", honors: "Honors", AP: "AP", IB: "IB", DE: "Dual enrollment" };
const TERM_ORDER = ["Fall", "Spring", "Full year", "Summer"];

interface Student {
  id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null;
  permissions: Record<string, boolean>; weight_rigor?: number; weight_honors?: number; high_school?: string | null; grad_year?: number | null;
}
interface Row { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }

/**
 * A printable self-reported academic record: what the family has entered,
 * laid out the way college forms ask for it. Clearly unofficial; the school
 * sends the official transcript.
 */
export default function RecordPage() {
  const sb = supabase();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [canEdit, setCanEdit] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [school, setSchool] = useState({ name: "", year: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/grades");
    const wanted = rememberedStudent();
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("*").order("first_name"),
    ]);
    const list = (st.data as Student[]) ?? [];
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    const pick = list.find((x) => x.id === wanted) ?? list.find((x) => x.id === own) ?? list[0] ?? null;
    setStudent(pick);
    if (!pick) return;
    setCanEdit(m.some((r) => r.role === "parent") || !!pick.permissions?.enter_grades);
    setSchool({ name: pick.high_school ?? "", year: pick.grad_year?.toString() ?? "" });
    const { data: gr } = await sb.from("course_grades").select("course, grade, level, core, grade_level, term").eq("student_id", pick.id).order("grade_level").order("created_at");
    setRows((gr as Row[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Academic record"><NotConfigured /></Page>;
  if (student === undefined) return <Page title="Academic record"><p className="hint">Loading…</p></Page>;
  if (!student) return <Page title="Academic record"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const grades: CourseGrade[] = rows.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
  const hope = GA.programs.find((p) => p.rules.gpa_formula);
  const formula = hope?.rules.gpa_formula ? GA.gpa_formulas[hope.rules.gpa_formula] : undefined;
  const w = { rigor: Number(student.weight_rigor ?? 1), honors: Number(student.weight_honors ?? 0.5) };
  const card = formula ? buildScorecard(grades, { currentGrade: student.grade_level, formula, target: 3, rigorNeeded: hope?.rules.rigor_courses, rigorLevels: hope?.rules.rigor_levels, schoolWeights: w }) : null;
  const years = [6, 7, 8, 9, 10, 11, 12].map((y) => ({
    y,
    list: rows.filter((r) => r.grade_level === y).sort((a, b) => TERM_ORDER.indexOf(a.term) - TERM_ORDER.indexOf(b.term)),
  })).filter((g) => g.list.length);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const gpa = (n: number | null | undefined) => (n == null ? "—" : displayGpa(n));

  const saveSchool = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    const year = school.year ? Number(school.year) : null;
    const { error } = await sb.rpc("set_student_school", { p_student: student.id, p_high_school: school.name, p_grad_year: year });
    if (error) return setMsg({ ok: false, text: /function|schema cache/i.test(error.message) ? "Saving the school needs the latest database update." : friendly(error) });
    setMsg({ ok: true, text: "✓ Saved" });
    await load();
  };
  const print = async () => {
    // Printing or saving a PDF is an export of the student's record: log it.
    await sb.rpc("log_access", { p_student: student.id, p_action: "export", p_details: { what: "self_reported_record" } }).then(() => null, () => null);
    window.print();
  };

  return (
    <Page>
      <div className="no-print">
        <a href="/grades" className="hint">← Back to grades</a>
        <h1 style={{ marginBottom: 6 }}>Self-reported academic record</h1>
        <p className="hint">Some colleges let students report their own grades when they apply (for example through SRAR or the college&apos;s own portal), and ask for the official transcript only after admission. Use this sheet to copy from, or print it or save it as a PDF where a college accepts an unofficial copy. Double-check every grade against the school&apos;s transcript first, because colleges compare them later.</p>
        {canEdit && (
          <form className="row panel" style={{ alignItems: "end" }} onSubmit={saveSchool}>
            <div className="field"><label htmlFor="rec-school">High school</label>
              <input id="rec-school" className="input" maxLength={120} value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} /></div>
            <div className="field" style={{ flex: "0 1 150px" }}><label htmlFor="rec-year">Graduation year</label>
              <input id="rec-year" className="input" inputMode="numeric" value={school.year} onChange={(e) => setSchool({ ...school, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
            <button className="btn btn-inline">Save</button>
            {msg && <span className={msg.ok ? "hint" : "note note-err"} style={{ margin: 0 }}>{msg.text}</span>}
          </form>
        )}
        <button className="btn btn-inline" style={{ margin: "4px 0 18px" }} onClick={() => void print()}>🖨 Print or save as PDF</button>
      </div>

      <article className="record-sheet">
        <header className="record-head">
          <div>
            <p className="record-kicker">Unofficial · Self-reported by the family</p>
            <h2>Academic record</h2>
          </div>
          <span className="record-date">Prepared {today}</span>
        </header>
        <dl className="record-facts">
          <div><dt>Student</dt><dd>{student.first_name}</dd></div>
          <div><dt>High school</dt><dd>{student.high_school || "—"}</dd></div>
          <div><dt>Graduation year</dt><dd>{student.grad_year ?? "—"}</dd></div>
          <div><dt>Current grade</dt><dd>{student.grade_level}</dd></div>
        </dl>

        <table className="record-table record-summary">
          <tbody>
            <tr><th>Unweighted GPA (all courses, A = 4)</th><td>{gpa(card?.overallGpa)}</td></tr>
            <tr><th>Weighted GPA (AP/IB/DE +{w.rigor}, honors +{w.honors})</th><td>{gpa(card?.schoolGpa)}</td></tr>
            {student.state === GA.state && <tr><th>Estimated HOPE GPA (core courses, grades 9–12)</th><td>{gpa(card?.stateGpa)}</td></tr>}
            <tr><th>AP, IB and dual enrollment courses</th><td>{card?.rigorDone ?? 0}</td></tr>
            <tr><th>Best SAT / ACT</th><td>{student.sat ?? "—"} / {student.act ?? "—"}</td></tr>
          </tbody>
        </table>

        {years.length === 0 ? (
          <p className="hint">No courses entered yet. Add them on the <a href="/grades">Grades</a> page.</p>
        ) : years.map(({ y, list }) => (
          <section key={y} className="record-year">
            <h3>Grade {y}</h3>
            <table className="record-table">
              <thead><tr><th>Course</th><th>Level</th><th>Term</th><th>Core</th><th>Grade</th></tr></thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={i}><td>{r.course}</td><td>{LEVELS[r.level]}</td><td>{r.term}</td><td>{r.core ? "Yes" : ""}</td><td><b>{r.grade}</b></td></tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <footer className="record-foot">
          This is not an official transcript. It lists grades as entered by the family in ScholarTasks and has not been checked by the school.
          GPAs are estimates; the school&apos;s transcript and GAfutures have the official numbers. The official transcript is sent by the school.
        </footer>
      </article>
    </Page>
  );
}

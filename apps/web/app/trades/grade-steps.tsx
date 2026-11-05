"use client";

import { useEffect, useState } from "react";
import { gradeStepsFor, tradeGradeTaskId } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { milestoneDue } from "../../lib/milestones";
import { TRADES_PACK } from "../../lib/trades";

interface Student { id: string; first_name: string; grade_level: number }
const GRADES = [8, 9, 10, 11, 12];
const clamp = (g: number) => Math.max(8, Math.min(12, g));

/**
 * A trade path for grades 8 to 12: career classes, clubs, Dual Enrollment,
 * youth apprenticeships and visits. Anyone can read it; a signed-in family can
 * add this year's steps to the student's To-do list (once each).
 */
export function TradeGradeSteps() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [grade, setGrade] = useState(11);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return setSignedIn(false);
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return setSignedIn(false);
      setSignedIn(true);
      const [mem, st] = await Promise.all([
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name, grade_level").order("first_name"),
      ]);
      const own = ((mem.data as { role: string; student_id: string | null }[]) ?? []).find((r) => r.role === "student")?.student_id;
      const list = (st.data as Student[]) ?? [];
      setStudents(list);
      setCurrent((x) => (x && list.some((s2) => s2.id === x) ? x : own ?? pickStudent(list, list[0]?.id)));
    })();
  }, [sb, setCurrent]);

  const student = students.find((s) => s.id === current);
  useEffect(() => { if (student) setGrade(clamp(student.grade_level)); }, [student]);

  useEffect(() => {
    if (!sb || !student) return;
    void sb.from("tasks").select("deadline_id").eq("student_id", student.id).like("deadline_id", "tg:%")
      .then(({ data }) => setHave(new Set(((data as { deadline_id: string }[]) ?? []).map((r) => r.deadline_id))));
  }, [sb, student]);

  const steps = gradeStepsFor(TRADES_PACK, grade);
  const isTheirGrade = !!student && clamp(student.grade_level) === grade;
  const missing = steps.filter((s) => !have.has(tradeGradeTaskId(grade, s.key)));

  const add = async () => {
    if (!sb || !student) return;
    setBusy(true); setError(null); setMsg(null);
    const today = new Date().toLocaleDateString("en-CA");
    const rows = missing.map((s) => ({
      student_id: student.id, kind: "milestone", status: "todo", deadline_id: tradeGradeTaskId(grade, s.key),
      title: s.title, due_on: milestoneDue(s.due, today), url: s.link ?? "/trades",
    }));
    const { error: e } = await sb.from("tasks").insert(rows);
    setBusy(false);
    if (e) return setError(friendly(e));
    setHave(new Set([...have, ...rows.map((r) => r.deadline_id)]));
    setMsg(`Added ${rows.length} steps to ${student.first_name}'s To-do list.`);
  };

  return (
    <section className="panel" id="grades">
      <h2>Planning a trade in grades 8 to 12</h2>
      <p className="hint">Career classes, clubs and free college classes in high school give a big head start. Pick a grade to see what to do this year.</p>
      <div className="chips trade-chips" role="group" aria-label="Grade">
        {GRADES.map((g) => (
          <button key={g} className={`chip ${g === grade ? "chip-on" : ""}`} aria-pressed={g === grade} onClick={() => setGrade(g)}>{g}th grade</button>
        ))}
      </div>
      <ol className="trade-grade-steps">
        {steps.map((s) => <li key={s.key}>{s.link ? <a href={s.link}>{s.title}</a> : s.title}</li>)}
      </ol>
      {signedIn === false && <a className="btn btn-inline btn-sm" href="/signin?next=/trades%23grades">Sign in to add these to a To-do list</a>}
      {signedIn && student && isTheirGrade && (missing.length === 0
        ? <p className="hint">✓ On {student.first_name}&apos;s <a href="/todo">To-do list</a>.</p>
        : <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void add()}>
            {busy ? "Adding…" : `Add ${missing.length} steps to ${student.first_name}'s To-do list`}
          </button>)}
      {signedIn && student && !isTheirGrade && <p className="hint">{student.first_name} is in {student.grade_level}th grade. Pick that grade to add its steps.</p>}
      {msg && <p className="hint" role="status">{msg} <a href="/todo">Open To-do list</a></p>}
      {error && <p className="note note-err" role="alert">{error}</p>}
    </section>
  );
}

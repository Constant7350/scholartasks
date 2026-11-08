"use client";

import { useEffect, useState } from "react";
import { packFor } from "../../lib/state-packs";
import { supabase } from "../../lib/supabase";
import { rememberStudent } from "../../lib/current-student";
import { useSpace } from "../../lib/parent-space";
import { NotConfigured, Page } from "../ui";
import { Avatar } from "../avatar";
import { GpaScorecard } from "../grades/scorecard";
import { ProgressCard } from "../home/progress-card";
import { exploreView } from "../nav";

interface Student { id: string; first_name: string; grade_level: number; state: string; match_profile?: { career_quiz?: { at: string }; show_all_pages?: boolean } | null; weight_rigor?: number; weight_honors?: number; goal_gpa?: number | null; min_grade?: string }
interface Grade { student_id: string; course: string; grade: "A" | "B" | "C" | "D" | "F"; level: "standard" | "honors" | "AP" | "IB" | "DE"; core: boolean; grade_level: number; term: string }
interface Due { student_id: string; due: string | null; open: boolean }

const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(new Date().toLocaleDateString("en-CA") + "T12:00:00")) / 86_400_000);

/**
 * My students: where a parent looks at each child's own work (grades, streak, deadlines,
 * college list), kept apart from the parent's own Home and My parent space.
 */
export default function StudentsPage() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [grades, setGrades] = useState<Grade[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [colleges, setColleges] = useState<{ student_id: string }[]>([]);
  const [, setSpace] = useSpace();

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/students");
      const [mem, st, inv, gr, tk, col] = await Promise.all([
        sb.from("family_members").select("role").eq("user_id", s.session.user.id),
        sb.from("students").select("*").order("first_name"),
        sb.from("family_invites").select("student_id, accepted_at"),
        sb.from("course_grades").select("student_id, course, grade, level, core, grade_level, term"),
        sb.from("tasks").select("student_id, due_on, status"),
        sb.from("student_colleges").select("student_id, deadline, status"),
      ]);
      setIsParent(((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent"));
      setStudents((st.data as Student[]) ?? []);
      setConnected(new Set(((inv.data as { student_id: string; accepted_at: string | null }[]) ?? []).filter((i) => i.accepted_at).map((i) => i.student_id)));
      setGrades((gr.data as Grade[]) ?? []);
      const c = (col.data as { student_id: string; deadline: string | null; status: string }[]) ?? [];
      setColleges(c.filter((x) => x.status !== "withdrawn"));
      setDues([
        ...((tk.data as { student_id: string; due_on: string | null; status: string }[]) ?? []).map((t) => ({ student_id: t.student_id, due: t.due_on, open: t.status === "todo" })),
        ...c.map((x) => ({ student_id: x.student_id, due: x.deadline, open: ["considering", "applying"].includes(x.status) })),
      ]);
      setReady(true);
    })();
  }, [sb]);

  const title = "My students";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (!ready) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!isParent) return <Page title={title}><p className="hint">This page is for parents. Your own plan is on your <a href="/home">home page</a>.</p></Page>;
  if (!students.length) return <Page title={title}><p className="hint">Add your student on the <a href="/family">Family</a> page. Their grades, deadlines and progress will show here.</p></Page>;

  // Open one of the student's pages, switched to that student and to their plan.
  const open = (id: string, href: string) => () => { rememberStudent(id); setSpace("student"); window.location.assign(href); };

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>Each student&apos;s own work and progress. Your own lists are in <a href="/parent">My parent space</a>.</p>
      {students.map((s) => {
        const mine = dues.filter((d) => d.student_id === s.id && d.open);
        const late = mine.filter((d) => d.due && daysUntil(d.due) < 0).length;
        const week = mine.filter((d) => d.due && daysUntil(d.due) >= 0 && daysUntil(d.due) <= 7).length;
        const nColleges = colleges.filter((c) => c.student_id === s.id).length;
        // Grades 6 to 10: no college list or application pages yet, just ways to explore (unless Show every page is on).
        const early = exploreView(s) && nColleges === 0;
        return (
          <section key={s.id} className="kid-block">
            <div className="panel family-card">
              <div>
                <h2 className="kid-head"><Avatar name={s.first_name} size={36} />{s.first_name} <span className="hint" style={{ fontSize: 15, fontWeight: 600 }}>· Grade {s.grade_level}</span></h2>
                <p className="kid-pills">
                  {connected.has(s.id) ? <span className="pill pill-ok">Connected</span> : <span className="pill">Not connected yet</span>}
                  {late > 0 && <span className="pill pill-late">{late} late</span>}
                  {week > 0 && <span className="pill pill-soon">{week} due this week</span>}
                  {mine.length > 0 && late + week === 0 && <span className="pill">{mine.length} to do</span>}
                  {early ? <span className="pill">{s.grade_level <= 8 ? "Explore stage (grades 6-8)" : "Build stage (grades 9-10)"}</span> : <span className="pill">{nColleges} colleges on the list</span>}
                  <span className="pill">{s.match_profile?.career_quiz ? "Career quiz saved" : "No career quiz yet"}</span>
                </p>
              </div>
            </div>
            <div className="kid-links">
              <button className="btn btn-ghost btn-inline btn-sm" onClick={open(s.id, "/todo")}>✅ To-do list</button>
              {early
                ? <button className="btn btn-ghost btn-inline btn-sm" onClick={open(s.id, "/colleges")}>🔎 Explore colleges</button>
                : <button className="btn btn-ghost btn-inline btn-sm" onClick={open(s.id, "/plan")}>🗂️ College list</button>}
              <button className="btn btn-ghost btn-inline btn-sm" onClick={open(s.id, "/grades")}>🎓 Grades</button>
              <button className="btn btn-ghost btn-inline btn-sm" onClick={open(s.id, "/scholarships")}>💰 Scholarships</button>
              {(!early || s.grade_level >= 9) && <button className="btn btn-ghost btn-inline btn-sm" onClick={open(s.id, "/activities")}>🏅 Activities</button>}
              <button className="btn btn-ghost btn-inline btn-sm" onClick={() => { rememberStudent(s.id); window.location.assign("/parent#quiz"); }}>🧩 Career quiz answers</button>
            </div>
            <GpaScorecard rows={grades.filter((g) => g.student_id === s.id)} currentGrade={s.grade_level} pack={packFor(s.state)} name={s.first_name} compact href="/grades" goal={s.goal_gpa == null ? null : Number(s.goal_gpa)} minGrade={s.min_grade} weights={{ rigor: Number(s.weight_rigor ?? 1), honors: Number(s.weight_honors ?? 0.5) }} />
            <ProgressCard sb={sb} studentId={s.id} name={students.length > 1 ? s.first_name : null} />
          </section>
        );
      })}
      <a className="btn btn-ghost btn-inline link-btn" href="/family">Manage family and permissions</a>
    </Page>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { loadStudy, type StudyContext } from "../context";
import { bandFor, lessonById, LESSONS } from "../lessons";
import { QuickCheck } from "../quick-check";
import { FocusTimer, SpacingPlanner, WeekPlanner } from "../tools";

export default function LessonPage() {
  const sb = supabase();
  const { id } = useParams<{ id: string }>();
  const lesson = lessonById(id);
  const [ctx, setCtx] = useState<StudyContext | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace(`/signin?next=/study/${id}`);
      const c = await loadStudy(sb, s.session.user.id);
      const wanted = new URLSearchParams(window.location.search).get("student");
      setCtx(c);
      setStudentId(c.own ?? c.students.find((x) => x.id === wanted)?.id ?? c.students[0]?.id ?? null);
    })();
  }, [sb, id]);

  if (!sb) return <Page title="Study skills"><NotConfigured /></Page>;
  if (!lesson) return <Page title="Study skills"><p className="hint">That lesson wasn&apos;t found. <a href="/study">See all lessons</a>.</p></Page>;
  if (!ctx) return <Page title={lesson.title}><p className="hint">Loading…</p></Page>;

  const student = ctx.students.find((s) => s.id === studentId);
  const isDone = !!student && (ctx.done[student.id] ?? []).includes(lesson.id);
  const band = student ? bandFor(student.grade_level) : "10-12";
  const projects = [...lesson.projects].sort((a, b) => (a.band === band ? -1 : b.band === band ? 1 : 0));
  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const next = LESSONS[idx + 1];

  const toggleDone = async () => {
    if (!student) return;
    setError(null);
    const q = isDone
      ? sb.from("lesson_progress").delete().eq("student_id", student.id).eq("lesson_id", lesson.id)
      : sb.from("lesson_progress").insert({ student_id: student.id, lesson_id: lesson.id });
    const { error: e } = await q;
    if (e) return setError(/relation|schema cache/i.test(e.message) ? "Saving progress needs the latest database update." : friendly(e));
    const list = ctx.done[student.id] ?? [];
    setCtx({ ...ctx, done: { ...ctx.done, [student.id]: isDone ? list.filter((x) => x !== lesson.id) : [...list, lesson.id] } });
  };

  return (
    <Page>
      <a href="/study" className="hint">← All lessons</a>
      <h1 style={{ marginBottom: 4 }}><span aria-hidden="true">{lesson.emoji}</span> {lesson.title}</h1>
      <p className="hint">{lesson.minutes} min read{ctx.reviews[lesson.id] !== "approved" ? " · Draft, being checked by our teacher reviewer" : " · Reviewed by a teacher"}</p>

      <section className="panel">
        <p style={{ marginTop: 0, fontSize: 17 }}><b>{lesson.summary}</b></p>
        <p className="hint" style={{ marginBottom: 0 }}>{lesson.why}</p>
      </section>

      <section className="panel">
        <h2>How to do it</h2>
        <ol className="lesson-steps">
          {lesson.steps.map((s) => <li key={s.title}><b>{s.title}.</b> {s.body}</li>)}
        </ol>
        {lesson.tool === "spacing-planner" && <SpacingPlanner />}
        {lesson.tool === "focus-timer" && <FocusTimer />}
        {lesson.tool === "week-planner" && <WeekPlanner />}
      </section>

      <section className="panel">
        <h2>Quick check</h2>
        <QuickCheck checks={lesson.checks} />
      </section>

      <section className="panel">
        <h2>Try it this week</h2>
        {projects.map((p) => (
          <div key={p.band} className={`lesson-project ${p.band === band ? "" : "lesson-project-other"}`}>
            <p style={{ margin: "0 0 6px" }}><b>{p.title}</b> <span className="pill">Grades {p.band}</span></p>
            <ol className="lesson-steps">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </div>
        ))}
      </section>

      {error && <p className="note note-err" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {student && (
          <button className={`btn btn-inline ${isDone ? "btn-ghost" : ""}`} onClick={() => void toggleDone()}>
            {isDone ? "✓ Finished (undo)" : ctx.role === "parent" ? `Mark finished for ${student.first_name}` : "I finished this lesson"}
          </button>
        )}
        {next && <a className="btn btn-ghost btn-inline link-btn" href={`/study/${next.id}${ctx.role === "parent" && student ? `?student=${student.id}` : ""}`}>Next: {next.title} →</a>}
      </div>
    </Page>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { badges, weeklyStreak, type Badge, type ProgressFacts } from "@scholartasks/core";

const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count: n, error } = await q;
  return error ? 0 : n ?? 0;
};

/** Streak and badges for one student, from what they've already done. */
export function ProgressCard({ sb, studentId, name }: { sb: SupabaseClient; studentId: string; name: string | null }) {
  const [facts, setFacts] = useState<ProgressFacts | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const h = { count: "exact" as const, head: true };
      const days = await sb.from("student_progress_days").select("day").eq("student_id", studentId).order("day", { ascending: false }).limit(400);
      if (days.error) return; // database update not run yet: show nothing
      const [colleges, submitted, saved, acts, essays, courses, practice, aid, lessons] = await Promise.all([
        count(sb.from("student_colleges").select("id", h).eq("student_id", studentId).neq("status", "withdrawn")),
        count(sb.from("student_colleges").select("id", h).eq("student_id", studentId).in("status", ["submitted", "accepted", "waitlisted", "deferred", "denied", "enrolled"])),
        count(sb.from("scholarship_choices").select("id", h).eq("student_id", studentId).eq("choice", "added")),
        count(sb.from("student_activities").select("id", h).eq("student_id", studentId)),
        count(sb.from("student_essays").select("id", h).eq("student_id", studentId).eq("status", "done")),
        count(sb.from("course_grades").select("id", h).eq("student_id", studentId)),
        count(sb.from("practice_attempts").select("id", h).eq("student_id", studentId)),
        count(sb.from("aid_progress").select("id", h).eq("student_id", studentId).eq("status", "done")),
        count(sb.from("lesson_progress").select("lesson_id", h).eq("student_id", studentId)),
      ]);
      if (!live) return;
      setFacts({
        days: ((days.data as { day: string }[]) ?? []).map((d) => d.day),
        collegesOnList: colleges, collegesSubmitted: submitted, scholarshipsSaved: saved, activities: acts,
        essaysFinished: essays, coursesEntered: courses, practiceAnswered: practice, aidStepsDone: aid, lessonsDone: lessons,
      });
    })();
    return () => { live = false; };
  }, [sb, studentId]);

  if (!facts) return null;
  const today = new Date().toLocaleDateString("en-CA");
  const streak = weeklyStreak(facts.days, today);
  const list = badges(facts, today);
  const earned = list.filter((b) => b.earned);
  const next = list.find((b) => !b.earned && b.progress) ?? list.find((b) => !b.earned);
  const shown: Badge[] = all ? list : earned.slice(-6);

  return (
    <section className="panel progress-card">
      <div className="progress-top">
        <div className="streak">
          <span className="streak-flame" aria-hidden="true">{streak.current ? "🔥" : "🌱"}</span>
          <div>
            <b>{streak.current ? `${streak.current}-week streak` : "Start a streak"}</b>
            <span className="hint">
              {streak.current
                ? streak.thisWeek ? `${name ? `${name} got` : "You got"} something done this week. Keep it going next week!` : "Do one thing this week to keep the streak."
                : "Get one thing done this week: check off a to-do, add a grade or an activity."}
            </span>
          </div>
        </div>
        <span className="hint">{earned.length} of {list.length} badges{streak.best > streak.current ? ` · best streak ${streak.best} weeks` : ""}</span>
      </div>
      {shown.length > 0 && (
        <ul className="badge-row">
          {shown.map((b) => (
            <li key={b.id} className={b.earned ? "badge-on" : "badge-off"} title={b.how}>
              <span aria-hidden="true">{b.icon}</span><b>{b.name}</b>{!b.earned && <span className="hint">{b.progress ?? b.how}</span>}
            </li>
          ))}
        </ul>
      )}
      {next && !all && <p className="hint" style={{ margin: "8px 0 0" }}>Next badge: <b>{next.icon} {next.name}</b>. {next.how}{next.progress ? ` (${next.progress})` : ""}</p>}
      <button className="btn-link hint" style={{ marginTop: 6 }} onClick={() => setAll(!all)}>{all ? "Show fewer" : "See all badges"}</button>
    </section>
  );
}

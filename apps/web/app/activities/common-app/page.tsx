"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMMON_APP, COMMON_APP_PROMPTS, chars, checkActivity, checkHonor, commonAppReadiness, essayStatus,
  type CourseGrade,
} from "@scholartasks/core";
import { supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { IconTabs } from "../../icon-tabs";
import { rememberedStudent } from "../../../lib/current-student";
import { CopyButton } from "../../copy-button";
import { CATEGORIES, RECOGNITION, gradeText, type Activity } from "../shared";

interface Student { id: string; first_name: string; grade_level: number; sat: number | null; act: number | null; high_school?: string | null; grad_year?: number | null }
interface Row { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; grade_level: number; term: string }
interface Essay { id: string; kind: string; title: string; prompt: string | null; draft: string; status: string; college_id: string | null }

const FIELD_NAMES = { position: "Position or role", organization: "Organization name", description: "Description", title: "Honor title" } as const;

/** A count like "142 / 150", red when over. */
function Count({ value, limit }: { value: string | null | undefined; limit: number }) {
  const n = chars(value);
  return <span className={n > limit ? "note-err small" : "hint small"} style={{ padding: 0, background: "none" }}>{n} / {limit}</span>;
}

/**
 * Common App ready: every Common App section, filled from what the family already
 * entered, checked against Common App's own limits, with Copy buttons.
 * Counting and checking only: the student's words are never rewritten.
 */
export default function CommonAppReady() {
  const sb = supabase();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [items, setItems] = useState<Activity[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/activities/common-app");
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
    const [a, g, e] = await Promise.all([
      sb.from("student_activities").select("*").eq("student_id", pick.id).order("sort_order").order("created_at"),
      sb.from("course_grades").select("course, grade, level, grade_level, term").eq("student_id", pick.id).order("grade_level"),
      sb.from("student_essays").select("id, kind, title, prompt, draft, status, college_id").eq("student_id", pick.id).order("created_at"),
    ]);
    setItems((a.data as Activity[]) ?? []);
    setGrades((g.data as Row[]) ?? []);
    setEssays((e.data as Essay[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const title = "Common App ready";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (student === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!student) return <Page title={title}><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const activities = items.filter((i) => i.kind === "activity");
  const honors = items.filter((i) => i.kind === "honor");
  const personal = essays.find((e) => e.kind === "personal") ?? null;
  const supplements = essays.filter((e) => e.kind === "supplement");
  const essay = essayStatus(personal);
  const { sections, percent } = commonAppReadiness({
    profile: { highSchool: !!student.high_school, gradYear: !!student.grad_year },
    hasGrades: grades.length > 0,
    hasTests: !!(student.sat || student.act),
    activities, honors, essay: personal,
    supplements: { done: supplements.filter((e) => e.status === "done").length, total: supplements.length },
  });
  const byYear = [9, 10, 11, 12].map((y) => ({ y, rows: grades.filter((r) => r.grade_level === y) })).filter((x) => x.rows.length);
  const promptNo = personal?.prompt ? COMMON_APP_PROMPTS.indexOf(personal.prompt) + 1 : 0;

  return (
    <Page title={title}>
      <p className="hint"><a href="/activities">← Activities</a> · <a href="/activities/profile">Application profile</a></p>
      <p className="hint">Everything the <a href="https://www.commonapp.org" target="_blank" rel="noopener">Common App</a> asks for, checked against its limits. Copy each part in and submit there.</p>

      <section className="panel">
        <h2>{student.first_name} is {percent}% ready</h2>
        <div style={{ background: "var(--line, #e5e1d6)", borderRadius: 8, height: 12, margin: "8px 0 12px" }} aria-hidden="true">
          <div style={{ width: `${percent}%`, background: "var(--green, #2f7d5b)", height: "100%", borderRadius: 8 }} />
        </div>
        {sections.some((s) => !s.ready) && <p className="hint" style={{ margin: 0 }}>Still to do: {sections.filter((s) => !s.ready).map((s) => s.label).join(", ")}.</p>}
        <details>
        <summary className="hint">See every part</summary>
        <ul className="items">
          {sections.map((s) => (
            <li key={s.key}>
              <div className="item-main">
                <b>{s.ready ? "✓" : "○"} {s.label}</b>
                {s.notes.map((n) => <span key={n} className="hint small">{n}</span>)}
              </div>
              <div className="item-actions"><span className="hint small">{s.key === "testing" || (s.key === "honors" && !honors.length) || (s.key === "supplements" && !supplements.length) ? "" : `${s.done} of ${s.total}`}</span></div>
            </li>
          ))}
        </ul>
        </details>
      </section>

      <IconTabs label="Parts of the application" tabs={[
        { key: "school", icon: "🏫", label: "School and tests", body: <>
      <section className="panel">
        <h2>Education</h2>
        <ul className="items">
          <li><div className="item-main"><span className="hint">High school</span><span>{student.high_school || "Not added yet"}</span></div>{student.high_school && <div className="item-actions"><CopyButton text={student.high_school} /></div>}</li>
          <li><div className="item-main"><span className="hint">Graduation year</span><span>{student.grad_year ?? "Not added yet"}</span></div></li>
        </ul>
        {(!student.high_school || !student.grad_year) && <p className="hint small">Add them on the <a href="/grades/record">Academic record</a> page.</p>}
      </section>

      <section className="panel">
        <h2>Courses and grades</h2>
        <p className="hint">Many colleges ask you to type your courses and grades into Common App (or a separate self-reported record, SRAR). Copy one year at a time, and check every grade against your transcript.</p>
        {byYear.length === 0 ? <p className="hint">No grades yet. <a href="/grades">Add grades</a>.</p> : (
          <ul className="items">
            {byYear.map(({ y, rows }) => {
              const text = rows.map((r) => `${r.course}${r.level !== "standard" ? ` (${r.level})` : ""}, ${r.term}: ${r.grade}`).join("\n");
              return (
                <li key={y}>
                  <div className="item-main"><b>Grade {y}</b><span className="hint small" style={{ whiteSpace: "pre-wrap" }}>{text}</span></div>
                  <div className="item-actions"><CopyButton text={text} label={`Copy grade ${y}`} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Testing</h2>
        <ul className="items">
          <li><div className="item-main"><span className="hint">SAT</span><span>{student.sat ?? "None saved"}</span></div></li>
          <li><div className="item-main"><span className="hint">ACT</span><span>{student.act ?? "None saved"}</span></div></li>
        </ul>
        <p className="hint small">Many colleges are test-optional. Check each college&apos;s rule before you add scores.</p>
      </section>
        </> },
        { key: "activities", icon: "⚽", label: "Activities", body: <>
      <section className="panel">
        <h2>Activities ({Math.min(activities.length, COMMON_APP.activities)} of {COMMON_APP.activities})</h2>
        <p className="hint">Common App takes your top {COMMON_APP.activities}, in order, so put the most important first on the <a href="/activities">Activities</a> page. Limits: role {COMMON_APP.position}, organization {COMMON_APP.organization}, description {COMMON_APP.description} characters, spaces included.</p>
        {activities.length === 0 ? <p className="hint">No activities yet. <a href="/activities">Add them</a>.</p> : (
          <ol className="items" style={{ paddingLeft: 0 }}>
            {activities.slice(0, COMMON_APP.activities).map((a, i) => {
              const c = checkActivity(a, i);
              return (
                <li key={a.id} style={{ display: "block" }}>
                  <p style={{ margin: "0 0 4px" }}><b>{c.ready ? "✓" : "○"} {i + 1}. {a.position}</b> <span className="hint small">{CATEGORIES[a.category] ?? a.category} · {gradeText(a.grades) || "grades not set"}{a.hours_per_week ? ` · ${a.hours_per_week} hrs/week, ${a.weeks_per_year ?? 0} weeks/year` : ""}</span></p>
                  <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <CopyButton text={a.position} label="Copy role" /> <Count value={a.position} limit={COMMON_APP.position} />
                    {a.organization && <><CopyButton text={a.organization} label="Copy organization" /> <Count value={a.organization} limit={COMMON_APP.organization} /></>}
                    {a.description && <><CopyButton text={a.description} label="Copy description" /> <Count value={a.description} limit={COMMON_APP.description} /></>}
                  </div>
                  {c.issues.map((x) => <p key={x.field} className="note note-err small" style={{ margin: "6px 0 0" }}>{FIELD_NAMES[x.field]} is {x.length - x.limit} characters too long. Cut filler words and use numbers (&quot;Led 20 volunteers&quot;).</p>)}
                  {c.missing.length > 0 && <p className="hint small" style={{ margin: "6px 0 0" }}>Still needed: {c.missing.join(", ")}. <a href="/activities">Edit</a></p>}
                </li>
              );
            })}
          </ol>
        )}
        {activities.length > COMMON_APP.activities && <p className="hint small">Not sent to Common App: {activities.slice(COMMON_APP.activities).map((a) => a.position).join(", ")}. You can mention them in Additional information.</p>}
      </section>
        </> },
        { key: "honors", icon: "🏅", label: "Honors", body: <>
      <section className="panel">
        <h2>Honors ({Math.min(honors.length, COMMON_APP.honors)} of {COMMON_APP.honors}, optional)</h2>
        {honors.length === 0 ? <p className="hint">No honors yet. Add awards on the <a href="/activities">Activities</a> page; it&apos;s fine to leave this blank.</p> : (
          <ol className="items" style={{ paddingLeft: 0 }}>
            {honors.slice(0, COMMON_APP.honors).map((h, i) => {
              const c = checkHonor(h, i);
              return (
                <li key={h.id} style={{ display: "block" }}>
                  <p style={{ margin: "0 0 4px" }}><b>{c.ready ? "✓" : "○"} {i + 1}. {h.position}</b> <span className="hint small">{RECOGNITION[h.recognition ?? "school"]} · {gradeText(h.grades) || "grade not set"}</span></p>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}><CopyButton text={h.position} label="Copy title" /> <Count value={h.position} limit={COMMON_APP.honorTitle} /></div>
                  {c.issues.map((x) => <p key={x.field} className="note note-err small" style={{ margin: "6px 0 0" }}>{FIELD_NAMES[x.field]} is {x.length - x.limit} characters too long.</p>)}
                  {c.missing.length > 0 && <p className="hint small" style={{ margin: "6px 0 0" }}>Still needed: {c.missing.join(", ")}. <a href="/activities">Edit</a></p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
        </> },
        { key: "essays", icon: "✍️", label: "Essays", body: <>
      <section className="panel">
        <h2>Personal essay</h2>
        {!personal ? <p className="hint">Not started. <a href="/essays">Start it in Essays</a>, where the coach gives feedback without writing it for you.</p> : (
          <>
            <p className="hint">{promptNo ? `Prompt ${promptNo} of 7` : "No prompt picked yet"} · {essay.note}</p>
            {personal.draft.trim() && <div className="row"><CopyButton text={personal.draft} label="Copy essay" /> <a className="btn btn-inline btn-sm link-btn" href="/essays">Open in Essays</a></div>}
          </>
        )}
      </section>

      <section className="panel">
        <h2>College essays (supplements)</h2>
        {supplements.length === 0 ? <p className="hint">None yet. Many colleges ask one or two extra questions. Add them for each college in <a href="/essays">Essays</a>.</p> : (
          <ul className="items">
            {supplements.map((e) => (
              <li key={e.id}>
                <div className="item-main"><b>{e.status === "done" ? "✓" : "○"} {e.title}</b><span className="hint small">{e.status === "done" ? "Marked done" : "Still drafting"}</span></div>
                <div className="item-actions">{e.draft.trim() && <CopyButton text={e.draft} label="Copy" />}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
        </> },
        { key: "optional", icon: "➕", label: "Optional", body: <>
      <section className="panel">
        <h2>Optional boxes</h2>
        <p className="hint"><b>Additional information</b> (up to {COMMON_APP.additionalInfo} words): only for something important that doesn&apos;t fit elsewhere, like a school change or a big family duty. <b>Challenges and circumstances</b> (up to {COMMON_APP.challenges} words): for things outside your control that affected school. Both can stay blank.</p>
      </section>

      <p className="hint small">Limits checked for the 2026-27 Common App. Always check the counter on the real form before you submit. Common App is a trademark of its owner; ScholarTasks is not connected with it.</p>
        </> },
      ]} />

    </Page>
  );
}

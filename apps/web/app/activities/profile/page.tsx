"use client";

import { useCallback, useEffect, useState } from "react";
import { buildScorecard, countWords, displayGpa, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../../../packs/states/GA.json";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { rememberedStudent } from "../../../lib/current-student";
import { CopyButton } from "../../copy-button";
import { CATEGORIES, RECOGNITION, gradeText, hoursPerYear, type Activity } from "../shared";

const GA = gaPack as unknown as StatePack;

interface Student {
  id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null;
  weight_rigor?: number; weight_honors?: number; high_school?: string | null; grad_year?: number | null;
  match_profile?: { interests?: string[]; majors?: string } | null;
}
interface Row { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }
interface Answer { id: string; title: string; prompt: string | null; word_limit: number | null; draft: string; kind: string }

/** Short answers almost every scholarship form asks for. Each becomes an essay the student writes once. */
const STARTERS = [
  { title: "Short bio", prompt: "Tell us about yourself in a few sentences.", word_limit: 100 },
  { title: "Career goals", prompt: "What are your career goals, and how will college help you reach them?", word_limit: 250 },
  { title: "A challenge I overcame", prompt: "Describe a challenge or obstacle you have overcome and what you learned.", word_limit: 300 },
  { title: "Community service", prompt: "Describe your community service or volunteer work and why it matters to you.", word_limit: 250 },
  { title: "Leadership", prompt: "Describe a time you showed leadership.", word_limit: 250 },
  { title: "Financial need", prompt: "Explain your financial need and how this scholarship would help you pay for college.", word_limit: 200 },
];

/** One labeled value with its own Copy button. */
function Line({ id, label, value, hint }: { id: string; label: string; value: string; hint?: string }) {
  if (!value) return null;
  return (
    <li>
      <div className="item-main">
        <span className="hint">{label}</span>
        <span id={id} style={{ whiteSpace: "pre-wrap" }}>{value}</span>
        {hint && <span className="hint small">{hint}</span>}
      </div>
      <div className="item-actions"><CopyButton text={value} targetId={id} /></div>
    </li>
  );
}

/**
 * Everything a scholarship or college form asks for, in one place, each with a Copy button.
 * Built from Grades, Activities and Essays; nothing new to type except the short answers.
 */
export default function ApplicationProfile() {
  const sb = supabase();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [items, setItems] = useState<Activity[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/activities/profile");
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
      sb.from("course_grades").select("course, grade, level, core, grade_level, term").eq("student_id", pick.id),
      sb.from("student_essays").select("id, title, prompt, word_limit, draft, kind").eq("student_id", pick.id).order("created_at"),
    ]);
    setItems((a.data as Activity[]) ?? []);
    setGrades((g.data as Row[]) ?? []);
    setAnswers((e.data as Answer[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Application profile"><NotConfigured /></Page>;
  if (student === undefined) return <Page title="Application profile"><p className="hint">Loading…</p></Page>;
  if (!student) return <Page title="Application profile"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const cg: CourseGrade[] = grades.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
  const hope = GA.programs.find((p) => p.rules.gpa_formula);
  const formula = hope?.rules.gpa_formula ? GA.gpa_formulas[hope.rules.gpa_formula] : undefined;
  const w = { rigor: Number(student.weight_rigor ?? 1), honors: Number(student.weight_honors ?? 0.5) };
  const card = formula && cg.length ? buildScorecard(cg, { currentGrade: student.grade_level, formula, target: 3, schoolWeights: w }) : null;
  const activities = items.filter((i) => i.kind === "activity");
  const honors = items.filter((i) => i.kind === "honor");
  const hard = cg.filter((c) => ["AP", "IB", "DE"].includes(c.level));
  const totalHours = activities.reduce((n, a) => n + hoursPerYear(a), 0);
  const service = activities.filter((a) => a.category === "community").reduce((n, a) => n + hoursPerYear(a), 0);
  const interests = student.match_profile?.interests ?? [];
  const shortAnswers = answers.filter((a) => a.kind === "other");
  const personal = answers.find((a) => a.kind === "personal");

  const activityText = (a: Activity) => [
    `${a.position}${a.organization ? `, ${a.organization}` : ""}`,
    a.description ?? "",
    [gradeText(a.grades), a.hours_per_week ? `${a.hours_per_week} hrs/week, ${a.weeks_per_year ?? 0} weeks/year` : ""].filter(Boolean).join(" · "),
  ].filter(Boolean).join("\n");
  const allActivities = activities.map(activityText).join("\n\n");
  const allHonors = honors.map((h) => `${h.position} (${RECOGNITION[h.recognition ?? "school"]}${h.grades.length ? `, ${gradeText(h.grades)}` : ""})`).join("\n");

  const addStarter = async (s: (typeof STARTERS)[number]) => {
    setError(null);
    const { data, error: e } = await sb.from("student_essays").insert({ student_id: student.id, kind: "other", title: s.title, prompt: s.prompt, word_limit: s.word_limit }).select("id, title, prompt, word_limit, draft, kind").single();
    if (e) return setError(friendly(e));
    setAnswers([...answers, data as Answer]);
  };
  const missing = STARTERS.filter((s) => !shortAnswers.some((a) => a.title.toLowerCase() === s.title.toLowerCase()));

  return (
    <Page title="Application profile">
      <p className="hint"><a href="/activities">← Activities</a> · <a href={`/activities/resume?student=${student.id}`}>Resume</a> · <a href="/essays">Essays</a></p>
      <p className="hint">Everything scholarship and college forms ask for, ready to paste. Tap Copy, then paste it into the form. It all comes from your grades, activities and essays, so keep those up to date and this page stays current.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      <section className="panel">
        <h2>About me</h2>
        <ul className="items">
          <Line id="p-name" label="First name" value={student.first_name} />
          <Line id="p-school" label="High school" value={student.high_school ?? ""} />
          <Line id="p-class" label="Graduation year" value={student.grad_year ? String(student.grad_year) : ""} />
          <Line id="p-grade" label="Current grade" value={String(student.grade_level)} />
          <Line id="p-state" label="State" value={student.state} />
          <Line id="p-int" label="Interests and possible majors" value={interests.join(", ")} hint={interests.length ? undefined : "Set these on the Scholarships page profile."} />
        </ul>
        {!student.high_school && <p className="hint small">Add the high school name and graduation year on the <a href="/grades/record">Academic record</a> page.</p>}
      </section>

      <section className="panel">
        <h2>Grades and test scores</h2>
        <ul className="items">
          <Line id="p-gpa" label="GPA, unweighted (4.0 scale)" value={card?.overallGpa != null ? displayGpa(card.overallGpa) : ""} />
          <Line id="p-wgpa" label="GPA, weighted (your school's extra points)" value={card?.schoolGpa != null ? displayGpa(card.schoolGpa) : ""} />
          <Line id="p-hope" label="HOPE GPA estimate" value={card?.stateGpa != null ? displayGpa(card.stateGpa) : ""} hint="Your official HOPE GPA is on GAfutures. Use that one on Georgia forms." />
          <Line id="p-sat" label="SAT" value={student.sat ? String(student.sat) : ""} />
          <Line id="p-act" label="ACT" value={student.act ? String(student.act) : ""} />
          <Line id="p-ap" label="AP, IB and dual enrollment courses" value={hard.map((c) => c.course).join(", ")} />
        </ul>
        {!cg.length && <p className="hint">No grades yet. <a href="/grades">Add grades</a> and your GPA shows here.</p>}
      </section>

      <section className="panel">
        <h2>Activities ({activities.length})</h2>
        {activities.length === 0 ? <p className="hint">No activities yet. <a href="/activities">Add them once</a> and they show up here, in the Common App format.</p> : (
          <>
            <div className="row"><CopyButton text={allActivities} label="Copy all activities" /></div>
            <ul className="items">
              {activities.map((a) => (
                <li key={a.id}>
                  <div className="item-main">
                    <b>{a.position}{a.organization ? `, ${a.organization}` : ""}</b>
                    <span className="hint">{CATEGORIES[a.category] ?? a.category} · {gradeText(a.grades)}{a.hours_per_week ? ` · ${a.hours_per_week} hrs/week, ${a.weeks_per_year ?? 0} weeks/year` : ""}</span>
                    {a.description && <span id={`p-a-${a.id}`}>{a.description}</span>}
                  </div>
                  <div className="item-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <CopyButton text={a.position} label="Copy role" />
                    {a.organization && <CopyButton text={a.organization} label="Copy organization" />}
                    {a.description && <CopyButton text={a.description} label="Copy description" targetId={`p-a-${a.id}`} />}
                  </div>
                </li>
              ))}
            </ul>
            <ul className="items">
              <Line id="p-hours" label="Hours a year, all activities" value={totalHours ? totalHours.toLocaleString() : ""} />
              <Line id="p-service" label="Volunteer hours a year" value={service ? service.toLocaleString() : ""} />
            </ul>
          </>
        )}
      </section>

      {honors.length > 0 && (
        <section className="panel">
          <h2>Honors and awards ({honors.length})</h2>
          <div className="row"><CopyButton text={allHonors} label="Copy all honors" /></div>
          <ul className="items">
            {honors.map((h) => <Line key={h.id} id={`p-h-${h.id}`} label={`${RECOGNITION[h.recognition ?? "school"]}${h.grades.length ? ` · ${gradeText(h.grades)}` : ""}`} value={h.position} />)}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Short answers I reuse</h2>
        <p className="hint">Write these once in <a href="/essays">Essays</a> and paste them into any form that asks. Change a few words for each award so it fits.</p>
        <ul className="items">
          {personal?.draft && <Line id="p-personal" label={`Common App personal essay · ${countWords(personal.draft)} words`} value={personal.draft} />}
          {shortAnswers.map((a) => {
            const words = countWords(a.draft);
            return a.draft.trim() ? (
              <Line key={a.id} id={`p-s-${a.id}`} label={`${a.title} · ${words} words${a.word_limit ? ` of ${a.word_limit}` : ""}`} value={a.draft} />
            ) : (
              <li key={a.id}><div className="item-main"><b>{a.title}</b><span className="hint">Not written yet.</span></div><div className="item-actions"><a className="btn btn-inline btn-sm link-btn" href="/essays">Write it</a></div></li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <>
            <p className="hint" style={{ marginBottom: 6 }}>Add the ones most forms ask for:</p>
            <div className="chips">
              {missing.map((s) => <button key={s.title} type="button" className="chip" onClick={() => void addStarter(s)}>+ {s.title} ({s.word_limit} words)</button>)}
            </div>
          </>
        )}
      </section>
      <p className="hint small">We never fill in or send forms for you. You paste, check and submit each one yourself, so every answer stays in your own words.</p>
    </Page>
  );
}

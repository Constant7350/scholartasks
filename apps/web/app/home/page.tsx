"use client";

import { useEffect, useState } from "react";
import type { StatePack } from "@scholartasks/core";
import gaPack from "../../../../packs/states/GA.json";
import { supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { GpaScorecard } from "../grades/scorecard";
import { ProgressCard } from "./progress-card";
import { PasskeyOffer } from "../passkey-offer";
import { AdultConsent } from "../adult-consent";

const GA = gaPack as unknown as StatePack;

interface Student { id: string; first_name: string; grade_level: number; state: string; weight_rigor?: number; weight_honors?: number; goal_gpa?: number | null; min_grade?: string }
interface Grade { student_id: string; course: string; grade: "A" | "B" | "C" | "D" | "F"; level: "standard" | "honors" | "AP" | "IB" | "DE"; core: boolean; grade_level: number; term: string }
interface Invite { student_id: string; accepted_at: string | null }
interface Due { due: string | null; open: boolean }

const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(new Date().toLocaleDateString("en-CA") + "T12:00:00")) / 86_400_000);

const SOON: { icon: string; title: string; text: string }[] = [];

export default function Home() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [dues, setDues] = useState<Due[]>([]);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data } = await sb.auth.getSession();
      setSignedIn(!!data.session);
      if (!data.session) return;
      setEmail(data.session.user.email ?? "");
      const [st, inv, gr, tk, col] = await Promise.all([
        sb.from("students").select("*").order("first_name"),
        sb.from("family_invites").select("student_id, accepted_at"),
        sb.from("course_grades").select("student_id, course, grade, level, core, grade_level, term"),
        sb.from("tasks").select("due_on, status"),
        sb.from("student_colleges").select("deadline, status"),
      ]);
      setDues([
        ...((tk.data as { due_on: string | null; status: string }[]) ?? []).map((t) => ({ due: t.due_on, open: t.status === "todo" })),
        ...((col.data as { deadline: string | null; status: string }[]) ?? []).map((c) => ({ due: c.deadline, open: ["considering", "applying"].includes(c.status) })),
      ]);
      setGrades((gr.data as Grade[]) ?? []);
      setStudents((st.data as Student[]) ?? []);
      setInvites((inv.data as Invite[]) ?? []);
    })();
  }, [sb]);

  if (!sb) return <Page title="Home"><NotConfigured /></Page>;
  if (signedIn === null) return <Page><p className="hint">Loading…</p></Page>;
  if (signedIn === false) {
    // Keep any error from the sign-in provider so the sign-in page can show it.
    if (typeof window !== "undefined") window.location.replace("/signin" + window.location.search + window.location.hash);
    return <Page><p className="hint">Taking you to sign in…</p></Page>;
  }

  const connected = (id: string) => invites.some((i) => i.student_id === id && i.accepted_at);
  const open = dues.filter((d) => d.open);
  const late = open.filter((d) => d.due && daysUntil(d.due) < 0).length;
  const week = open.filter((d) => d.due && daysUntil(d.due) >= 0 && daysUntil(d.due) <= 7).length;
  const today = new Date().toLocaleDateString("en-CA");
  const dates = GA.deadlines.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  return (
    <Page>
      <section className="hero">
        <p className="eyebrow">Welcome{email ? `, ${email}` : ""}</p>
        <h1>Your college plan starts here</h1>
        <p className="hint">Look around and try the tools first. Add your student whenever you're ready.</p>
      </section>

      <AdultConsent sb={sb} mode="ask" />
      <PasskeyOffer sb={sb} />

      <div className="panel family-card">
        {students.length === 0 ? (
          <>
            <div>
              <h2>Add your student when you're ready</h2>
              <p className="hint" style={{ margin: 0 }}>Their plan, reminders and scholarship matches are built from their grade and goals. You choose what they can see and do.</p>
            </div>
            <a className="btn btn-ghost btn-inline link-btn" href="/family">Add a student</a>
          </>
        ) : (
          <>
            <div>
              <h2>Your students</h2>
              <ul className="kids">
                {students.map((s) => (
                  <li key={s.id}>
                    <strong>{s.first_name}</strong> · Grade {s.grade_level}{" "}
                    {connected(s.id) ? <span className="pill pill-ok">Connected</span> : <span className="pill">Not connected yet</span>}
                  </li>
                ))}
              </ul>
            </div>
            <a className="btn btn-ghost btn-inline link-btn" href="/family">Manage family</a>
          </>
        )}
      </div>

      {students.filter((s) => s.state === GA.state).map((s) => (
        <GpaScorecard key={s.id} rows={grades.filter((g) => g.student_id === s.id)} currentGrade={s.grade_level} pack={GA} name={s.first_name} compact href="/grades" goal={s.goal_gpa == null ? null : Number(s.goal_gpa)} minGrade={s.min_grade} weights={{ rigor: Number(s.weight_rigor ?? 1), honors: Number(s.weight_honors ?? 0.5) }} />
      ))}

      {sb && students.map((s) => (
        <ProgressCard key={`p-${s.id}`} sb={sb} studentId={s.id} name={students.length > 1 ? s.first_name : null} />
      ))}

      <h2 className="section-title">Try it now</h2>
      <div className="tiles">
        <a className={`tile${late ? " tile-late" : week ? " tile-week" : ""}`} href="/todo">
          <span className="tile-icon">✅</span>
          <b>To-do list</b>
          <span>What still needs doing and what's done, sorted by due date with warning colors.</span>
          <span className="tile-alert">
            {late > 0 && <span className="pill pill-late">{late} late</span>}
            {week > 0 && <span className="pill pill-soon">{week} due this week</span>}
            {open.length > 0 && late + week === 0 && <span className="pill">{open.length} to do</span>}
            {open.length === 0 && <span className="pill pill-ok">All caught up</span>}
          </span>
          <span className="tile-go">Open to-do list →</span>
        </a>
        <a className="tile" href="/plan">
          <span className="tile-icon">🗂️</span>
          <b>College list and deadlines</b>
          <span>Track every college, scholarship and form, with email reminders before each deadline.</span>
          <span className="tile-go">Open the plan →</span>
        </a>
        <a className="tile" href="/grades">
          <span className="tile-icon">🎓</span>
          <b>Grades and HOPE tracker</b>
          <span>Save grades and test scores and see if your student is on track for HOPE and Zell Miller.</span>
          <span className="tile-go">Open grades →</span>
        </a>
        <a className="tile" href="/activities">
          <span className="tile-icon">🏅</span>
          <b>Activities and resume</b>
          <span>Clubs, sports, jobs and awards in Common App format, ready to copy in. Prints as a one-page resume.</span>
          <span className="tile-go">Add activities →</span>
        </a>
        <a className="tile" href="/counselor">
          <span className="tile-icon">🤖</span>
          <b>AI counselor</b>
          <span>Ask anything about colleges, aid and deadlines. Answers are built around your student's grades and plan.</span>
          <span className="tile-go">Ask a question →</span>
        </a>
        <a className="tile" href="/scholarships">
          <span className="tile-icon">💰</span>
          <b>Scholarships and grants</b>
          <span>Georgia and national awards your student qualifies for, with what to check and what to work on. Checked for changes every week.</span>
          <span className="tile-go">See matches →</span>
        </a>
        <a className="tile" href="/aid">
          <span className="tile-icon">🧾</span>
          <b>FAFSA and Georgia aid forms</b>
          <span>A step-by-step FAFSA, GAfutures and HOPE checklist with your own document list and reminders. You file on the official sites; we never ask for passwords or SSNs.</span>
          <span className="tile-go">Open the checklist →</span>
        </a>
        <a className="tile" href="/homework">
          <span className="tile-icon">🦉</span>
          <b>Homework Helper</b>
          <span>Stuck on homework in any subject? Get one hint at a time and have your work checked. It never gives the answer, so you still learn it.</span>
          <span className="tile-go">Get unstuck →</span>
        </a>
        <a className="tile" href="/study">
          <span className="tile-icon">📚</span>
          <b>Study skills library</b>
          <span>Short lessons on how to study, with quick checks and a project to try each week. Free, no AI needed.</span>
          <span className="tile-go">Start a lesson →</span>
        </a>
        <a className="tile" href="/practice">
          <span className="tile-icon">✏️</span>
          <b>Practice questions</b>
          <span>Test yourself in Algebra, Biology, U.S. History and more. Multiple choice is free; the AI tutor checks written answers and gives hints, never homework answers.</span>
          <span className="tile-go">Practice now →</span>
        </a>
        <a className="tile" href="/test-prep">
          <span className="tile-icon">📝</span>
          <b>SAT and ACT prep</b>
          <span>Free section drills, timed practice tests with a score estimate, and a score plan that shows what to work on.</span>
          <span className="tile-go">Start prepping →</span>
        </a>
        <div className="tile">
          <span className="tile-icon">📅</span>
          <b>Key Georgia dates</b>
          <ul className="dates">
            {dates.map((d) => (
              <li key={d.id}>
                <span className="date">{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span>{d.title}</span>
              </li>
            ))}
          </ul>
          <span className="hint" style={{ fontSize: 12 }}>Draft dates, being checked with the Georgia Student Finance Commission.</span>
        </div>
      </div>

      {SOON.length > 0 && <h2 className="section-title">Coming soon</h2>}
      <div className="tiles">
        {SOON.map((s) => (
          <div key={s.title} className="tile tile-soon">
            <span className="tile-icon">{s.icon}</span>
            <b>{s.title}</b>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </Page>
  );
}

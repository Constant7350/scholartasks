"use client";

import { useCallback, useEffect, useState } from "react";
import { packFor } from "../../lib/state-packs";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { GpaScorecard } from "../grades/scorecard";
import { ProgressCard } from "./progress-card";
import { PasskeyOffer } from "../passkey-offer";
import { AdultConsent } from "../adult-consent";
import { ParentIdeasCard } from "./parent-space-cards";
import { approveWaiting, loadWaiting, type Waiting } from "../parent/waiting";
import { useAiConsent } from "../ai-consent";
import { Icon } from "../icons";
import { stageOf } from "../nav";
import { DreamBoardCard } from "./dream-board";
import { PlanLevelNotice } from "./plan-level-notice";
import { useCurrentStudent } from "../../lib/current-student";

interface Student {
  id: string; first_name: string; grade_level: number; state: string; permissions?: Record<string, boolean> | null;
  match_profile?: { career_quiz?: { code: string; at: string }; show_all_pages?: boolean } | null; weight_rigor?: number; weight_honors?: number; goal_gpa?: number | null; min_grade?: string;
}
interface Grade { student_id: string; course: string; grade: "A" | "B" | "C" | "D" | "F"; level: "standard" | "honors" | "AP" | "IB" | "DE"; core: boolean; grade_level: number; term: string }
interface Invite { student_id: string; accepted_at: string | null }
/** One open item for "Due next": a to-do (can be checked off here) or a college application (opens the to-do list). */
interface Due { key: string; studentId: string; title: string; due: string | null; taskId?: string }

const todayIso = () => new Date().toLocaleDateString("en-CA");
const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(todayIso() + "T12:00:00")) / 86_400_000);
const nice = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const OPEN_COLLEGE = ["considering", "applying"];

/**
 * Home is "what to do next": things waiting for a parent (with the button right there), the next
 * few due items (check them off here), a box to ask the AI counselor and one set-up card that shrinks
 * as each step is done, under a small row of shortcut icons to the main pages. Everything else is one tap away in the menu.
 */
export default function Home() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [role, setRole] = useState<"parent" | "student" | "none">("none");
  const [error, setError] = useState<string | null>(null);
  const ai = useAiConsent(sb);
  const [current] = useCurrentStudent();

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    setSignedIn(!!data.session);
    if (!data.session) return;
    const [st, inv, gr, tk, col, mem] = await Promise.all([
      sb.from("students").select("*").order("first_name"),
      sb.from("family_invites").select("student_id, accepted_at"),
      sb.from("course_grades").select("student_id, course, grade, level, core, grade_level, term"),
      sb.from("tasks").select("id, student_id, title, due_on, status"),
      sb.from("student_colleges").select("id, student_id, name, deadline, status"),
      sb.from("family_members").select("role").eq("user_id", data.session.user.id),
    ]);
    const roles = ((mem.data as { role: string }[]) ?? []).map((r) => r.role);
    const r = roles.includes("parent") ? "parent" : roles.includes("student") ? "student" : "none";
    setRole(r);
    const kids = (st.data as Student[]) ?? [];
    setStudents(kids);
    setDues([
      ...((tk.data as { id: string; student_id: string; title: string; due_on: string | null; status: string }[]) ?? [])
        .filter((t) => t.status === "todo").map((t) => ({ key: "t" + t.id, studentId: t.student_id, title: t.title, due: t.due_on, taskId: t.id })),
      ...((col.data as { id: string; student_id: string; name: string; deadline: string | null; status: string }[]) ?? [])
        .filter((c) => OPEN_COLLEGE.includes(c.status)).map((c) => ({ key: "c" + c.id, studentId: c.student_id, title: `Apply to ${c.name}`, due: c.deadline })),
    ].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")));
    setGrades((gr.data as Grade[]) ?? []);
    setInvites((inv.data as Invite[]) ?? []);
    if (r === "parent") setWaiting(await loadWaiting(sb, (id) => kids.find((k) => k.id === id)?.first_name ?? "Your student").catch(() => []));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Home"><NotConfigured /></Page>;
  if (signedIn === null) return <Page><p className="hint">Loading…</p></Page>;
  if (signedIn === false) {
    // Keep any error from the sign-in provider so the sign-in page can show it.
    if (typeof window !== "undefined") window.location.replace("/signin" + window.location.search + window.location.hash);
    return <Page><p className="hint">Taking you to sign in…</p></Page>;
  }

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) setError(friendly(e));
    await load();
  };
  const isParent = role === "parent";
  const many = students.length > 1;
  const nameOf = (id: string) => students.find((s) => s.id === id)?.first_name ?? "";
  // Students without "mark done without asking" send a checked item to their parent to approve.
  const checkOff = (d: Due) => {
    const kid = students.find((s) => s.id === d.studentId);
    const ok = isParent || !!kid?.permissions?.mark_done_without_approval;
    return run(() => sb.from("tasks").update({ status: ok ? "done" : "needs_parent_approval" }).eq("id", d.taskId!));
  };

  const late = dues.filter((d) => d.due && daysUntil(d.due) < 0).length;
  const week = dues.filter((d) => d.due && daysUntil(d.due) >= 0 && daysUntil(d.due) <= 7).length;
  const next = dues.slice(0, 3);
  const home = packFor(students[0]?.state ?? "GA");
  const stateDates = (home?.deadlines ?? []).filter((d) => d.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);

  // Set-up steps: each line goes away once it's done, then the whole card goes away.
  const connected = (id: string) => invites.some((i) => i.student_id === id && i.accepted_at);
  const setup: { key: string; text: string; href?: string; go: string; onGo?: () => void }[] = [];
  if (isParent || role === "none") {
    if (students.length === 0) setup.push({ key: "add", text: "Add your student", href: "/family", go: "Add" });
    for (const s of students.filter((x) => !connected(x.id) && x.grade_level >= 8))
      setup.push({ key: `join-${s.id}`, text: `Send ${s.first_name} the join code for their own app`, href: "/family", go: "Send code" });
  }
  const quizWho = students.filter((s) => !s.match_profile?.career_quiz);
  if (students.length === 0 || quizWho.length > 0)
    setup.push({ key: "quiz", text: role === "student" ? "Take the career quiz (15 minutes)" : `Career quiz: what careers fit ${quizWho.length === 1 ? quizWho[0]!.first_name : "your student"}?`, href: "/career-quiz", go: "Start" });
  // Allow AI help once here, so the counselor, tutor and essay coach can answer right away (no pop-up on those pages).
  if (ai.need) setup.push({ key: "ai", text: "Allow AI help (counselor, Homework Helper, essay coach)", go: ai.busy ? "One moment…" : "Allow", onGo: () => void ai.allow() });

  // Shortcuts follow the student's stage (nav.ts): a 7th grader's family sees habits and careers, not FAFSA.
  const stageKid = students.find((s) => s.id === current) ?? students[0];
  const stage = stageKid?.match_profile?.show_all_pages ? "apply" : stageOf(stageKid?.grade_level);
  type Cut = [icon: string, label: string, href: string];
  const shortcuts: Cut[] = stage === "explore" ? [
    ["🧩", "Career quiz", "/career-quiz"], ["🎓", "Grades", "/grades"], ["📚", "Study skills", "/study"], ["🔧", "Careers", "/trades"],
    ...(isParent
      ? [["👪", "My students", "/students"], ["👤", "My space", "/parent"], ["🤖", "Counselor", "/counselor"], ["🔎", "Colleges", "/colleges"]] as Cut[]
      : [["🦉", "Homework", "/homework"], ["✏️", "Practice", "/practice"], ["🏆", "Challenge", "/challenge"], ["🤖", "Counselor", "/counselor"]] as Cut[]),
  ] : stage === "build" ? [
    ["🗓️", "Course plan", "/grades/plan"], ["🎓", "Grades", "/grades"], ["🏅", "Activities", "/activities"], ["🔎", "Colleges", "/colleges"],
    ...(isParent
      ? [["👪", "My students", "/students"], ["👤", "My space", "/parent"], ["💰", "Scholarships", "/scholarships"], ["📝", "PSAT/SAT", "/test-prep"]] as Cut[]
      : [["🦉", "Homework", "/homework"], ["📝", "PSAT/SAT", "/test-prep"], ["🧩", "Career quiz", "/career-quiz"], ["🏆", "Challenge", "/challenge"]] as Cut[]),
  ] : [
    ["🗂️", "Plan", "/plan"], ["🎓", "Grades", "/grades"], ["💰", "Scholarships", "/scholarships"], ["🔎", "Colleges", "/colleges"],
    ...(isParent
      ? [["👪", "My students", "/students"], ["👤", "My space", "/parent"], ["🧾", "FAFSA", "/aid"], ["📝", "SAT/ACT", "/test-prep"]] as Cut[]
      : [["🦉", "Homework", "/homework"], ["📝", "SAT/ACT", "/test-prep"], ["🏅", "Activities", "/activities"], ["✍️", "Essays", "/essays"]] as Cut[]),
  ];

  return (
    <Page>
      <h1 className="home-title">{isParent ? "What's next" : role === "student" ? "Your next steps" : "Welcome to ScholarTasks"}</h1>
      {error && <p className="note note-err" role="alert">{error}</p>}
      <nav className="home-grid home-grid-top" aria-label="Shortcuts">
        {shortcuts.map(([icon, label, href]) => (
          <a key={href} href={href}><Icon of={icon} />{label}</a>
        ))}
      </nav>

      {isParent && waiting.length > 0 && (
        <section className="panel home-waiting" aria-label="Waiting for you">
          <h2>Waiting for you <span className="pill pill-soon">{waiting.length}</span></h2>
          <ul className="home-list">
            {waiting.slice(0, 4).map((w) => (
              <li key={w.key}>
                <span><Icon of={w.icon} /> {w.text}</span>
                {w.approve
                  ? <button className="btn btn-inline btn-sm" onClick={() => void run(() => approveWaiting(sb, w.approve!))}>Approve</button>
                  : <a className="btn btn-inline btn-sm link-btn" href={w.href}>{w.action}</a>}
              </li>
            ))}
          </ul>
          {waiting.length > 4 && <a className="home-more" href="/parent#sign-offs">See all {waiting.length}</a>}
        </section>
      )}

      {isParent && <PlanLevelNotice sb={sb} />}
      <AdultConsent sb={sb} mode="ask" />

      {setup.length > 0 && (
        <section className="panel home-setup" aria-label="Get set up">
          <h2>Get set up</h2>
          <ul className="home-list">
            {setup.map((s) => (
              <li key={s.key}><span>{s.text}</span>{s.onGo ? <button className="btn btn-inline btn-sm" onClick={s.onGo} disabled={ai.busy}>{s.go}</button> : <a className="btn btn-inline btn-sm link-btn" href={s.href}>{s.go}</a>}</li>
            ))}
          </ul>
        </section>
      )}
      <PasskeyOffer sb={sb} />

      {/* Dream board: on Home for grades 6 to 10, and later only once it has something in it. */}
      {stageKid && role !== "none" && (stage !== "apply" || !!(stageKid.match_profile as { dreams?: { wants?: string[] } } | null)?.dreams?.wants?.length) && (
        <DreamBoardCard sb={sb} student={stageKid} who={isParent ? "parent" : "student"}
          onSaved={(profile) => setStudents(students.map((x) => (x.id === stageKid.id ? { ...x, match_profile: profile as Student["match_profile"] } : x)))} />
      )}

      {students.length > 0 && (
        <section className="panel home-due" aria-label="Due next">
          <div className="home-due-top">
            <h2>Due next</h2>
            <span className="tile-alert">
              {late > 0 && <span className="pill pill-late">{late} late</span>}
              {week > 0 && <span className="pill pill-soon">{week} this week</span>}
              {dues.length === 0 && <span className="pill pill-ok">All caught up</span>}
            </span>
          </div>
          {next.length > 0 ? (
            <ul className="home-list">
              {next.map((d) => {
                const u = d.due ? daysUntil(d.due) : null;
                return (
                  <li key={d.key}>
                    {d.taskId
                      ? <label className="home-check"><input type="checkbox" onChange={() => void checkOff(d)} /> <span>{d.title}{many ? ` · ${nameOf(d.studentId)}` : ""}</span></label>
                      : <a href="/todo">{d.title}{many ? ` · ${nameOf(d.studentId)}` : ""}</a>}
                    {d.due && <span className={`pill ${u! < 0 ? "pill-late" : u! <= 7 ? "pill-soon" : ""}`}>{u! < 0 ? `${-u!} days late` : u === 0 ? "Today" : nice(d.due)}</span>}
                  </li>
                );
              })}
            </ul>
          ) : stateDates.length > 0 ? (
            <ul className="home-list">
              {stateDates.map((d) => <li key={d.id}><span>{d.title}</span><span className="pill">{nice(d.date)}</span></li>)}
            </ul>
          ) : null}
          <a className="home-more" href="/todo">{dues.length > 3 ? `See all ${dues.length}` : "Open the to-do list"}</a>
        </section>
      )}

      <form className="panel home-ask" onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        window.location.href = q ? `/counselor?ask=${encodeURIComponent(q)}&send=1` : "/counselor";
      }}>
        <label htmlFor="home-q" className="home-ask-label">💬 Ask the AI counselor</label>
        <div className="home-ask-row">
          <input id="home-q" name="q" placeholder="Colleges, aid, deadlines…" enterKeyHint="send" autoComplete="off" />
          <button className="btn btn-inline" type="submit">Ask</button>
        </div>
        {!isParent && <a className="home-more" href="/homework">🦉 Stuck on homework? Get a hint</a>}
      </form>

      {role === "student" && <ParentIdeasCard sb={sb} />}


      {/* Parents see each student's scorecard and streak on My students, not on their own Home. */}
      {role === "student" && students.map((s) => (
        <GpaScorecard key={s.id} rows={grades.filter((g) => g.student_id === s.id)} currentGrade={s.grade_level} pack={packFor(s.state)} name={s.first_name} compact href="/grades" goal={s.goal_gpa == null ? null : Number(s.goal_gpa)} minGrade={s.min_grade} weights={{ rigor: Number(s.weight_rigor ?? 1), honors: Number(s.weight_honors ?? 0.5) }} />
      ))}
      {role === "student" && students.map((s) => (
        <ProgressCard key={`p-${s.id}`} sb={sb} studentId={s.id} name={null} />
      ))}

      <p className="home-foot"><a href="/invite">💌 Invite a friend</a> · <a href="/rate">⭐ Rate the app</a> · <a href="/help">❓ Help</a></p>
    </Page>
  );
}

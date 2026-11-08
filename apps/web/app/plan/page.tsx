"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deadlineAppliesTo, fillDeadline, type CollegeDeadline, type CostInput, type FilledDeadline } from "@scholartasks/core";
import { packFor } from "../../lib/state-packs";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { IconTabs } from "../icon-tabs";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { costInput, loadCollegeDeadlines, type CollegeRow, type CostStudent } from "../../lib/colleges";
import { CollegePicker } from "../colleges/college-picker";
import { ScholarshipPicker } from "./scholarship-picker";
import { CostPanel } from "./cost-panel";
import { TextReminders } from "./text-reminders";
import { exploreView } from "../nav";

interface Student extends CostStudent { first_name: string; permissions: Record<string, boolean>; match_profile?: { show_all_pages?: boolean } | null }
interface College {
  id: string; student_id: string; name: string; plan: string; deadline: string | null; status: string; approved: boolean; notes: string | null;
  college_id: number | null; aid_offer: number | null; created_by: string | null;
}
interface Task {
  id: string; student_id: string; title: string; kind: string; due_on: string | null; status: string;
  url: string | null; amount: number | null; deadline_id: string | null; created_by: string | null;
}

const PLANS: Record<string, string> = {
  EA: "Early Action", ED: "Early Decision", ED2: "Early Decision II", REA: "Restrictive Early Action",
  RD: "Regular Decision", rolling: "Rolling", priority: "Priority",
};
const STATUSES: Record<string, string> = {
  considering: "Considering", applying: "Working on it", submitted: "Submitted", accepted: "Accepted 🎉",
  waitlisted: "Waitlisted", deferred: "Deferred", denied: "Not admitted", enrolled: "Enrolling 🎓", withdrawn: "Withdrawn",
};
const KINDS: Record<string, string> = { scholarship: "Scholarship", aid: "Financial aid form", test: "Test (SAT/ACT)", other: "Other" };

const todayIso = () => new Date().toLocaleDateString("en-CA");
const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(todayIso() + "T12:00:00")) / 86_400_000);
const nice = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const missingTables = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? ""));

function DueBadge({ iso, done }: { iso: string | null; done?: boolean }) {
  if (!iso) return <span className="pill">No date</span>;
  if (done) return <span className="pill pill-ok">Done</span>;
  const n = daysUntil(iso);
  if (n < 0) return <span className="pill pill-late">{-n} day{n === -1 ? "" : "s"} late</span>;
  if (n === 0) return <span className="pill pill-soon">Due today</span>;
  return <span className={`pill ${n <= 7 ? "pill-soon" : ""}`}>{n} day{n === 1 ? "" : "s"} left</span>;
}

export default function PlanPage() {
  const sb = supabase();
  const [me, setMe] = useState<{ id: string; role: "parent" | "student" | null; studentId?: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [colleges, setColleges] = useState<College[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [college, setCollege] = useState<{ name: string; plan: string; deadline: string; collegeId: number | null; url: string | null }>({ name: "", plan: "EA", deadline: "", collegeId: null, url: null });
  // The deadline fills itself from the college's own dates (team table) or the typical date for the plan,
  // until the family types a date of their own (then we leave it alone).
  const [known, setKnown] = useState<CollegeDeadline[]>([]);
  const [filled, setFilled] = useState<FilledDeadline | null>(null);
  const [typedDate, setTypedDate] = useState(false);
  // Grades 6 to 10 start on a light "explore colleges" view; this opens the full list and deadlines anyway.
  const [seeAll, setSeeAll] = useState(false);
  useEffect(() => setSeeAll(false), [current]);
  const pickCollege = async (name: string, c: CollegeRow | null) => {
    setCollege((x) => ({ ...x, name, collegeId: c?.id ?? null, url: c?.url ?? null }));
    const dates = c ? await loadCollegeDeadlines(sb!, [c.id]) : [];
    setKnown(dates);
    if (!typedDate) {
      const f = c ? fillDeadline(college.plan, dates, todayIso()) : null;
      setFilled(f);
      setCollege((x) => ({ ...x, deadline: f?.date ?? (c ? "" : x.deadline) }));
    }
  };
  const pickPlan = (plan: string) => {
    const f = college.collegeId ? fillDeadline(plan, known, todayIso()) : null;
    if (typedDate) return setCollege((x) => ({ ...x, plan }));
    setFilled(f);
    setCollege((x) => ({ ...x, plan, deadline: f?.date ?? "" }));
  };
  const [collegeData, setCollegeData] = useState<Map<number, CollegeRow>>(new Map());
  const [ctx, setCtx] = useState<CostInput | null>(null);
  const [task, setTask] = useState({ title: "", kind: "scholarship", due_on: "", amount: "", url: "" });

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/plan");
    const uid = s.session.user.id;
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", uid),
      sb.from("students").select("*").order("first_name"),
    ]);
    const rows = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = rows.find((r) => r.role === "student");
    const role = rows.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null;
    setMe({ id: uid, role, studentId: asStudent?.student_id ?? undefined });
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (role === "student" ? asStudent?.student_id ?? null : pickStudent(list, list[0]?.id)));

    const [col, tk, us] = await Promise.all([
      sb.from("student_colleges").select("*").order("deadline", { nullsFirst: false }),
      sb.from("tasks").select("id, student_id, title, kind, due_on, status, url, amount, deadline_id, created_by").order("due_on", { nullsFirst: false }),
      sb.from("user_settings").select("email_reminders").maybeSingle(),
    ]);
    if (missingTables(col.error) || missingTables(us.error)) return setOffline(true);
    setOffline(false);
    const cols = (col.data as College[]) ?? [];
    setColleges(cols);
    const ids = [...new Set(cols.map((c) => c.college_id).filter((x): x is number => x != null))];
    if (ids.length) {
      const { data: cd } = await sb.from("colleges").select("*").in("id", ids);
      setCollegeData(new Map(((cd as CollegeRow[]) ?? []).map((r) => [r.id, r])));
    }
    setTasks((tk.data as Task[]) ?? []);
    setReminders((us.data as { email_reminders: boolean } | null)?.email_reminders ?? true);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const isParent = me?.role === "parent";
  const mayChangePlan = isParent || !!student?.permissions?.change_plan_without_approval;
  const mayMarkDone = isParent || !!student?.permissions?.mark_done_without_approval;
  const mayUseIncome = isParent || !!student?.permissions?.see_income_and_costs;
  useEffect(() => {
    if (sb && student) void costInput(sb, student, mayUseIncome).then(setCtx);
  }, [sb, student, mayUseIncome]);

  const myColleges = colleges.filter((c) => c.student_id === current);
  const myTasks = tasks.filter((t) => t.student_id === current && t.status !== "dismissed" && t.kind !== "milestone"); // "Beyond grades" steps live on the To-do list
  const upcoming = useMemo(() => {
    const items = [
      ...myColleges.filter((c) => c.deadline && ["considering", "applying"].includes(c.status))
        .map((c) => ({ key: "c" + c.id, title: c.plan ? `${c.name} · ${PLANS[c.plan] ?? c.plan}` : c.name, due: c.deadline!, done: false })),
      ...myTasks.filter((t) => t.due_on && t.status !== "done").map((t) => ({ key: "t" + t.id, title: t.title, due: t.due_on!, done: false })),
    ];
    return items.sort((a, b) => a.due.localeCompare(b.due)).filter((i) => daysUntil(i.due) <= 60).slice(0, 8);
  }, [myColleges, myTasks]);
  const pack = student ? packFor(student.state) : null;
  const packDates = student && pack ? pack.deadlines.filter((d) => deadlineAppliesTo(d, student.grade_level, todayIso()) && daysUntil(d.date) >= 0) : [];

  if (!sb) return <Page title="College plan"><NotConfigured /></Page>;
  if (!me) return <Page title="College plan"><p className="hint">Loading…</p></Page>;

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) setError(friendly(e));
    await load();
    return !e;
  };

  if (offline)
    return (
      <Page title="College plan">
        <div className="panel">
          <h2>Almost ready</h2>
          <p className="hint" style={{ margin: 0 }}>The college list and deadline reminders are switching on. Check back shortly.</p>
        </div>
      </Page>
    );

  if (!me.role || !student)
    return (
      <Page title="College plan">
        <div className="panel family-card">
          <div>
            <h2>Add your student first</h2>
            <p className="hint" style={{ margin: 0 }}>Each plan belongs to a student. Add yours, then come back to build their college list and deadlines.</p>
          </div>
          <a className="btn btn-inline link-btn" href="/family">Add a student</a>
        </div>
      </Page>
    );

  // Grades 6 to 10 with nothing on the list yet: no application deadlines, just ways to look around.
  if (exploreView(student) && !seeAll && myColleges.length === 0)
    return (
      <Page title={isParent ? `Colleges for ${student.first_name}` : "Colleges"}>
        {isParent && students.length > 1 && (
          <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
            {students.map((s) => (
              <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>
            ))}
          </div>
        )}
        <section className="panel">
          <h2>No college applications yet in grade {student.grade_level}</h2>
          <p className="hint" style={{ marginTop: 0 }}>The college list, application deadlines and reminders open in 11th grade. For now, look around and see what fits.</p>
          <div className="kid-links">
            <a className="btn btn-inline btn-sm link-btn" href="/colleges">🔎 Explore colleges</a>
            <a className="btn btn-ghost btn-inline btn-sm link-btn" href="/career-quiz">🧩 Career quiz</a>
            <a className="btn btn-ghost btn-inline btn-sm link-btn" href="/trades">🔧 Trades</a>
            <a className="btn btn-ghost btn-inline btn-sm link-btn" href="/military">🎖️ Military paths</a>
          </div>
        </section>
        <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setSeeAll(true)}>Open the full college list anyway</button>
        {isParent && <p className="hint" style={{ fontSize: 13 }}>To show every page for {student.first_name} all the time, turn on Show every page on the <a href="/family">Family</a> page.</p>}
      </Page>
    );

  return (
    <Page title={isParent ? `${student.first_name}'s college plan` : "My college plan"}>
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>
          ))}
        </div>
      )}
      {error && <p className="note note-err" role="alert">{error}</p>}

      <IconTabs label="Parts of the college plan" tabs={[
        { key: "coming-up", icon: "📅", label: "Coming up", count: upcoming.length, body: <>
      <section className="panel">
        <h2>Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>Nothing due in the next 60 days. Add colleges and scholarships below and their deadlines show up here.</p>
        ) : (
          <ul className="due-list">
            {upcoming.map((i) => (
              <li key={i.key}><span>{i.title}</span><span className="due-right"><span className="hint">{nice(i.due)}</span> <DueBadge iso={i.due} /></span></li>
            ))}
          </ul>
        )}
        <label className="toggle">
          <input type="checkbox" checked={reminders} onChange={(e) => run(() => sb.from("user_settings").upsert({ user_id: me.id, email_reminders: e.target.checked, updated_at: new Date().toISOString() }))} />
          Email me reminders 30, 14, 7, 2 and 1 days before, and on the day
        </label>
        <TextReminders sb={sb} />
      </section>
        </> },
        { key: "colleges", icon: "🏫", label: "Colleges", count: myColleges.length, body: <>
      <section className="panel">
        <h2>Colleges</h2>
        <p className="hint" style={{ marginTop: 0 }}>Not sure where to apply? <a href="/colleges">Find colleges that fit</a> with five quick questions. Applying? Track your <a href="/plan/papers">transcripts and letters</a>.</p>
        {!mayChangePlan && <p className="note note-info" style={{ marginTop: 0 }}>Colleges you add will wait for your parent's OK.</p>}
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() => sb.from("student_colleges").insert({
              student_id: student.id, name: college.name.trim(), plan: college.plan, deadline: college.deadline || null, approved: mayChangePlan,
              college_id: college.collegeId,
            }));
            if (ok) { setCollege({ name: "", plan: college.plan, deadline: "", collegeId: null, url: null }); setFilled(null); setKnown([]); setTypedDate(false); }
          }}
        >
          <div className="field"><label htmlFor="c-name">College</label>
            <CollegePicker sb={sb} id="c-name" value={college.name} onChange={(name, c) => void pickCollege(name, c)} /></div>
          <div className="field" style={{ flex: "0 1 190px" }}>
            <label htmlFor="c-plan">Applying</label>
            <select id="c-plan" className="input" value={college.plan} onChange={(e) => pickPlan(e.target.value)}>
              {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: "0 1 170px" }}><label htmlFor="c-date">Deadline</label><input id="c-date" type="date" className="input" value={college.deadline} onChange={(e) => { setTypedDate(true); setFilled(null); setCollege({ ...college, deadline: e.target.value }); }} /></div>
          <button className="btn btn-inline" disabled={!college.name.trim()}>Add college</button>
        </form>
        {filled && college.deadline && (
          <p className="hint fill-note" style={{ marginTop: -6 }}>
            {filled.source === "college"
              ? <>{college.name}&apos;s {PLANS[college.plan] ?? college.plan} date{filled.note ? ` (${filled.note})` : ""}. Change it if their site says otherwise.</>
              : <>Typical {PLANS[college.plan] ?? college.plan} date. Check {college.url ? <a href={college.url} target="_blank" rel="noopener noreferrer">{college.name}&apos;s site</a> : `${college.name}'s site`} and change it if needed.</>}
          </p>
        )}
        {college.collegeId && !college.deadline && college.plan === "rolling" && <p className="hint fill-note" style={{ marginTop: -6 }}>Rolling admission has no fixed date. Earlier is better; add the date you are aiming for.</p>}

        {myColleges.length > 0 && (
          <ul className="items">
            {myColleges.map((c) => (
              <li key={c.id}>
                <div className="item-main">
                  <b>{c.name}</b>
                  <span className="hint">{PLANS[c.plan] ?? c.plan}{c.deadline ? ` · due ${nice(c.deadline)}` : ""}</span>
                  {!c.approved && <span className="pill pill-soon">Waiting for parent's OK</span>}
                  {c.created_by && (c.created_by === me.id ? isParent && <span className="pill">Added by you</span> : !isParent && <span className="pill">Added by your parent</span>)}
                </div>
                <div className="item-actions">
                  {["considering", "applying"].includes(c.status) && c.deadline && <DueBadge iso={c.deadline} />}
                  <select
                    className="input input-sm"
                    aria-label={`Status for ${c.name}`}
                    value={c.status}
                    onChange={(e) => run(() => sb.from("student_colleges").update({ status: e.target.value, ...(mayChangePlan ? {} : { approved: false }) }).eq("id", c.id))}
                  >
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {isParent && !c.approved && <button className="btn btn-inline btn-sm" onClick={() => run(() => sb.rpc("approve_college", { p_college: c.id }))}>Approve</button>}
                  <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${c.name}`} onClick={() => run(() => sb.from("student_colleges").delete().eq("id", c.id))}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
        </> },
        { key: "cost", icon: "💵", label: "Cost", body: (!!ctx) ? <>
      {ctx && (
        <CostPanel sb={sb} studentId={student.id} colleges={myColleges} data={collegeData} ctx={ctx}
          canEdit={mayChangePlan || isParent} onChanged={load} />
      )}
        </> : null },
        { key: "deadlines", icon: "💰", label: "Scholarships and more", count: myTasks.filter((t) => t.status === "todo").length, body: <>
      <section className="panel">
        <h2>Scholarships and other deadlines</h2>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            const url = task.url.trim();
            const ok = await run(() => sb.from("tasks").insert({
              student_id: student.id, title: task.title.trim(), kind: task.kind, due_on: task.due_on || null,
              amount: task.amount ? Number(task.amount) : null, url: url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : null,
            }));
            if (ok) setTask({ title: "", kind: task.kind, due_on: "", amount: "", url: "" });
          }}
        >
          <div className="field"><label htmlFor="t-title">What</label>
            {task.kind === "scholarship"
              ? <ScholarshipPicker sb={sb} id="t-title" value={task.title} onChange={(title, h) => setTask(h ? { ...task, title, due_on: h.deadline ?? task.due_on, amount: h.amount_max ? String(h.amount_max) : task.amount, url: h.url } : { ...task, title })} />
              : <input id="t-title" className="input" placeholder="e.g. Send SAT scores" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />}
          </div>
          <div className="field" style={{ flex: "0 1 180px" }}>
            <label htmlFor="t-kind">Type</label>
            <select id="t-kind" className="input" value={task.kind} onChange={(e) => setTask({ ...task, kind: e.target.value })}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: "0 1 170px" }}><label htmlFor="t-date">Due</label><input id="t-date" type="date" className="input" value={task.due_on} onChange={(e) => setTask({ ...task, due_on: e.target.value })} /></div>
          {task.kind === "scholarship" && (
            <div className="field" style={{ flex: "0 1 130px" }}><label htmlFor="t-amt">Amount ($)</label><input id="t-amt" className="input" inputMode="numeric" value={task.amount} onChange={(e) => setTask({ ...task, amount: e.target.value.replace(/\D/g, "") })} /></div>
          )}
          <div className="field"><label htmlFor="t-url">Link (optional)</label><input id="t-url" className="input" placeholder="https://" value={task.url} onChange={(e) => setTask({ ...task, url: e.target.value })} /></div>
          <button className="btn btn-inline" disabled={!task.title.trim()}>Add</button>
        </form>

        {myTasks.length > 0 && (
          <ul className="items">
            {myTasks.map((t) => {
              const done = t.status === "done";
              const pending = t.status === "needs_parent_approval";
              return (
                <li key={t.id} className={done ? "is-done" : ""}>
                  <label className="item-main item-check">
                    <input
                      type="checkbox"
                      checked={done || pending}
                      onChange={(e) => run(() => sb.from("tasks").update({ status: e.target.checked ? (mayMarkDone ? "done" : "needs_parent_approval") : "todo" }).eq("id", t.id))}
                    />
                    <span>
                      <b>{t.title}</b>
                      <span className="hint">
                        {KINDS[t.kind] ?? t.kind}{t.amount ? ` · $${t.amount.toLocaleString()}` : ""}{t.due_on ? ` · due ${nice(t.due_on)}` : ""}
                        {t.url && <> · <a href={t.url} target="_blank" rel="noreferrer noopener">open</a></>}
                      </span>
                      {pending && <span className="pill pill-soon">Marked done, waiting for parent's OK</span>}
                    </span>
                  </label>
                  <div className="item-actions">
                    {!done && !pending && <DueBadge iso={t.due_on} />}
                    {isParent && pending && <button className="btn btn-inline btn-sm" onClick={() => run(() => sb.from("tasks").update({ status: "done" }).eq("id", t.id))}>Approve</button>}
                    {(isParent || t.created_by === me.id) && (
                      <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${t.title}`} onClick={() => run(() => sb.from("tasks").delete().eq("id", t.id))}>Remove</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
        </> },
        { key: "offers", icon: "⚖️", label: "Aid offers", href: "/plan/offers" },
        { key: "state-dates", icon: "🏛️", label: "State dates", body: (packDates.length > 0) ? <>
      {packDates.length > 0 && (
        <section className="panel">
          <h2 className="state-dates">{pack?.name} dates for grade {student.grade_level}</h2>
          <p className="hint">Draft dates, being checked with the {pack?.agency.name}. For step-by-step FAFSA help, open the <a href="/aid">financial aid checklist</a>.</p>
          <ul className="items">
            {packDates.map((d) => {
              const added = myTasks.some((t) => t.deadline_id === d.id);
              return (
                <li key={d.id}>
                  <div className="item-main"><b>{d.title}</b><span className="hint">{d.kind === "opens" ? "Opens" : "Due"} {nice(d.date)} · <a href={d.where} target="_blank" rel="noreferrer noopener">{d.where.replace(/^https?:\/\//, "")}</a></span></div>
                  <div className="item-actions">
                    {added ? <span className="pill pill-ok">On your plan</span> : (
                      <button className="btn btn-ghost btn-inline btn-sm" onClick={() => run(() => sb.from("tasks").insert({ student_id: student.id, title: d.title, kind: "aid", due_on: d.date, deadline_id: d.id, url: d.where }))}>Add to plan</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
        </> : null },
      ]} />

    </Page>
  );
}

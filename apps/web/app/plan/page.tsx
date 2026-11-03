"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StatePack } from "@scholartasks/core";
import gaPack from "../../../../packs/states/GA.json";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";

const GA = gaPack as unknown as StatePack;

interface Student { id: string; first_name: string; grade_level: number; permissions: Record<string, boolean> }
interface College { id: string; student_id: string; name: string; plan: string; deadline: string | null; status: string; approved: boolean; notes: string | null }
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
  const [current, setCurrent] = useState<string | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [college, setCollege] = useState({ name: "", plan: "EA", deadline: "" });
  const [task, setTask] = useState({ title: "", kind: "scholarship", due_on: "", amount: "", url: "" });

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/plan");
    const uid = s.session.user.id;
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", uid),
      sb.from("students").select("id, first_name, grade_level, permissions").order("first_name"),
    ]);
    const rows = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = rows.find((r) => r.role === "student");
    const role = rows.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null;
    setMe({ id: uid, role, studentId: asStudent?.student_id ?? undefined });
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (role === "student" ? asStudent?.student_id ?? null : list[0]?.id ?? null));

    const [col, tk, us] = await Promise.all([
      sb.from("student_colleges").select("id, student_id, name, plan, deadline, status, approved, notes").order("deadline", { nullsFirst: false }),
      sb.from("tasks").select("id, student_id, title, kind, due_on, status, url, amount, deadline_id, created_by").order("due_on", { nullsFirst: false }),
      sb.from("user_settings").select("email_reminders").maybeSingle(),
    ]);
    if (missingTables(col.error) || missingTables(us.error)) return setOffline(true);
    setOffline(false);
    setColleges((col.data as College[]) ?? []);
    setTasks((tk.data as Task[]) ?? []);
    setReminders((us.data as { email_reminders: boolean } | null)?.email_reminders ?? true);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const isParent = me?.role === "parent";
  const mayChangePlan = isParent || !!student?.permissions?.change_plan_without_approval;
  const mayMarkDone = isParent || !!student?.permissions?.mark_done_without_approval;

  const myColleges = colleges.filter((c) => c.student_id === current);
  const myTasks = tasks.filter((t) => t.student_id === current && t.status !== "dismissed");
  const upcoming = useMemo(() => {
    const items = [
      ...myColleges.filter((c) => c.deadline && ["considering", "applying"].includes(c.status))
        .map((c) => ({ key: "c" + c.id, title: `${c.name} · ${PLANS[c.plan] ?? c.plan}`, due: c.deadline!, done: false })),
      ...myTasks.filter((t) => t.due_on && t.status !== "done").map((t) => ({ key: "t" + t.id, title: t.title, due: t.due_on!, done: false })),
    ];
    return items.sort((a, b) => a.due.localeCompare(b.due)).filter((i) => daysUntil(i.due) <= 60).slice(0, 8);
  }, [myColleges, myTasks]);
  const packDates = student ? GA.deadlines.filter((d) => d.grade_levels.includes(student.grade_level) && daysUntil(d.date) >= 0) : [];

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
      </section>

      <section className="panel">
        <h2>Colleges</h2>
        {!mayChangePlan && <p className="note note-info" style={{ marginTop: 0 }}>Colleges you add will wait for your parent's OK.</p>}
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() => sb.from("student_colleges").insert({
              student_id: student.id, name: college.name.trim(), plan: college.plan, deadline: college.deadline || null, approved: mayChangePlan,
            }));
            if (ok) setCollege({ name: "", plan: college.plan, deadline: "" });
          }}
        >
          <div className="field"><label htmlFor="c-name">College</label><input id="c-name" className="input" placeholder="e.g. University of Georgia" value={college.name} onChange={(e) => setCollege({ ...college, name: e.target.value })} /></div>
          <div className="field" style={{ flex: "0 1 190px" }}>
            <label htmlFor="c-plan">Applying</label>
            <select id="c-plan" className="input" value={college.plan} onChange={(e) => setCollege({ ...college, plan: e.target.value })}>
              {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: "0 1 170px" }}><label htmlFor="c-date">Deadline</label><input id="c-date" type="date" className="input" value={college.deadline} onChange={(e) => setCollege({ ...college, deadline: e.target.value })} /></div>
          <button className="btn btn-inline" disabled={!college.name.trim()}>Add college</button>
        </form>

        {myColleges.length > 0 && (
          <ul className="items">
            {myColleges.map((c) => (
              <li key={c.id}>
                <div className="item-main">
                  <b>{c.name}</b>
                  <span className="hint">{PLANS[c.plan] ?? c.plan}{c.deadline ? ` · due ${nice(c.deadline)}` : ""}</span>
                  {!c.approved && <span className="pill pill-soon">Waiting for parent's OK</span>}
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
          <div className="field"><label htmlFor="t-title">What</label><input id="t-title" className="input" placeholder="e.g. Coca-Cola Scholars" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /></div>
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

      {packDates.length > 0 && (
        <section className="panel">
          <h2>Georgia dates for grade {student.grade_level}</h2>
          <p className="hint">Draft dates, being checked with the Georgia Student Finance Commission.</p>
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
    </Page>
  );
}

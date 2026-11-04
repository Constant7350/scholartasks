"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";

interface Student { id: string; first_name: string; permissions: Record<string, boolean> }
interface College { id: string; student_id: string; name: string; plan: string; deadline: string | null; status: string }
interface Task { id: string; student_id: string; title: string; kind: string; due_on: string | null; status: string; url: string | null; amount: number | null; created_by: string | null }
interface Choice { id: string; student_id: string; scholarship_id: string; choice: string; task_id: string | null; done_steps: number[] | null }
interface StepRow { scholarship_id: string; steps: { title: string; detail: string }[] }

const PLANS: Record<string, string> = {
  EA: "Early Action", ED: "Early Decision", ED2: "Early Decision II", REA: "Restrictive Early Action",
  RD: "Regular Decision", rolling: "Rolling", priority: "Priority",
};
const KINDS: Record<string, string> = { scholarship: "Scholarship", aid: "Financial aid form", test: "Test (SAT/ACT)", other: "Other", college: "College application" };
const OPEN_COLLEGE = ["considering", "applying"];
const DONE_COLLEGE: Record<string, string> = {
  submitted: "Submitted", accepted: "Accepted 🎉", waitlisted: "Waitlisted", deferred: "Deferred", denied: "Not admitted", enrolled: "Enrolling 🎓",
};

const todayIso = () => new Date().toLocaleDateString("en-CA");
const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(todayIso() + "T12:00:00")) / 86_400_000);
const nice = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const missingTables = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? ""));

type Urgency = "late" | "week" | "month" | "later" | "none";
const urgency = (iso: string | null): Urgency => {
  if (!iso) return "none";
  const n = daysUntil(iso);
  return n < 0 ? "late" : n <= 7 ? "week" : n <= 30 ? "month" : "later";
};
const GROUPS: { key: Urgency; title: string; hint: string }[] = [
  { key: "late", title: "Late", hint: "The due date has passed. Do these first, or check if the sponsor still accepts them." },
  { key: "week", title: "Due this week", hint: "Due in the next 7 days." },
  { key: "month", title: "Due this month", hint: "Due in 8 to 30 days." },
  { key: "later", title: "Later", hint: "More than 30 days away." },
  { key: "none", title: "No due date yet", hint: "Add a date on the College plan page to get reminders." },
];

function DueBadge({ iso }: { iso: string | null }) {
  if (!iso) return <span className="pill">No date</span>;
  const n = daysUntil(iso);
  if (n < 0) return <span className="pill pill-late">{-n} day{n === -1 ? "" : "s"} late</span>;
  if (n === 0) return <span className="pill pill-late">Due today</span>;
  if (n === 1) return <span className="pill pill-soon">Due tomorrow</span>;
  return <span className={`pill ${n <= 7 ? "pill-soon" : ""}`}>{n} days left</span>;
}

/** One line on the list: a task, a college application or a saved scholarship. */
interface Item {
  key: string; title: string; kind: string; due: string | null; done: boolean; pending: boolean; doneLabel?: string;
  url?: string | null; amount?: number | null; task?: Task; college?: College;
  steps?: { list: StepRow["steps"]; done: number[]; choice: Choice };
}

export default function TodoPage() {
  const sb = supabase();
  const [me, setMe] = useState<{ id: string; role: "parent" | "student" | null; studentId?: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [stepRows, setStepRows] = useState<StepRow[]>([]);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/todo");
    const uid = s.session.user.id;
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", uid),
      sb.from("students").select("id, first_name, permissions").order("first_name"),
    ]);
    const rows = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = rows.find((r) => r.role === "student");
    const role = rows.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null;
    setMe({ id: uid, role, studentId: asStudent?.student_id ?? undefined });
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (role === "student" ? asStudent?.student_id ?? null : list[0]?.id ?? null));

    const [col, tk, ch] = await Promise.all([
      sb.from("student_colleges").select("id, student_id, name, plan, deadline, status"),
      sb.from("tasks").select("id, student_id, title, kind, due_on, status, url, amount, created_by"),
      sb.from("scholarship_choices").select("id, student_id, scholarship_id, choice, task_id, done_steps").eq("choice", "added"),
    ]);
    if (missingTables(col.error) || missingTables(tk.error)) return setOffline(true);
    setOffline(false);
    setColleges((col.data as College[]) ?? []);
    setTasks((tk.data as Task[]) ?? []);
    const chosen = ch.error ? [] : ((ch.data as Choice[]) ?? []);
    setChoices(chosen);
    const ids = [...new Set(chosen.map((c) => c.scholarship_id))];
    if (ids.length) {
      const { data: sr } = await sb.from("scholarship_steps").select("scholarship_id, steps").in("scholarship_id", ids);
      setStepRows((sr as StepRow[]) ?? []);
    }
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const isParent = me?.role === "parent";
  const mayMarkDone = isParent || !!student?.permissions?.mark_done_without_approval;
  const mayChangePlan = isParent || !!student?.permissions?.change_plan_without_approval;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const c of colleges.filter((c) => c.student_id === current)) {
      const open = OPEN_COLLEGE.includes(c.status);
      if (!open && !DONE_COLLEGE[c.status]) continue; // withdrawn
      out.push({
        key: "c" + c.id, title: `Apply to ${c.name}`, kind: `College application · ${PLANS[c.plan] ?? c.plan}`, due: c.deadline,
        done: !open, pending: false, doneLabel: DONE_COLLEGE[c.status], college: c,
      });
    }
    for (const t of tasks.filter((t) => t.student_id === current && t.status !== "dismissed")) {
      const choice = choices.find((c) => c.task_id === t.id);
      const list = choice ? stepRows.find((r) => r.scholarship_id === choice.scholarship_id)?.steps : undefined;
      out.push({
        key: "t" + t.id, title: t.title, kind: KINDS[t.kind] ?? t.kind, due: t.due_on, done: t.status === "done",
        pending: t.status === "needs_parent_approval", url: t.url, amount: t.amount, task: t,
        steps: choice && list?.length ? { list, done: choice.done_steps ?? [], choice } : undefined,
      });
    }
    return out.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title));
  }, [colleges, tasks, choices, stepRows, current]);

  const todo = items.filter((i) => !i.done && !i.pending);
  const done = items.filter((i) => i.done || i.pending).reverse();
  const late = todo.filter((i) => urgency(i.due) === "late").length;
  const week = todo.filter((i) => urgency(i.due) === "week").length;

  const title = isParent && student ? `${student.first_name}'s to-do list` : "My to-do list";
  if (!sb) return <Page title="To-do list"><NotConfigured /></Page>;
  if (!me) return <Page title="To-do list"><p className="hint">Loading…</p></Page>;

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) setError(friendly(e));
    await load();
  };
  const markDone = (i: Item, yes: boolean) => {
    if (i.task) return run(() => sb.from("tasks").update({ status: yes ? (mayMarkDone ? "done" : "needs_parent_approval") : "todo" }).eq("id", i.task!.id));
    if (i.college) return run(() => sb.from("student_colleges").update({ status: yes ? "submitted" : "applying", ...(mayChangePlan ? {} : { approved: false }) }).eq("id", i.college!.id));
  };
  const toggleStep = (i: Item, n: number) => {
    const s = i.steps!;
    const next = s.done.includes(n) ? s.done.filter((x) => x !== n) : [...s.done, n];
    return run(() => sb.from("scholarship_choices").update({ done_steps: next }).eq("id", s.choice.id));
  };

  if (offline)
    return (
      <Page title="To-do list">
        <div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>The to-do list is switching on. Check back shortly.</p></div>
      </Page>
    );

  if (!me.role || !student)
    return (
      <Page title="To-do list">
        <div className="panel family-card">
          <div>
            <h2>Add your student first</h2>
            <p className="hint" style={{ margin: 0 }}>Each to-do list belongs to a student. Add yours, then add colleges and scholarships to fill it.</p>
          </div>
          <a className="btn btn-inline link-btn" href="/family">Add a student</a>
        </div>
      </Page>
    );

  const row = (i: Item) => {
    const u = i.done || i.pending ? "done" : urgency(i.due);
    const left = i.steps ? i.steps.list.length - i.steps.done.filter((n) => n < i.steps!.list.length).length : 0;
    return (
      <li key={i.key} className={`todo-item todo-${u}${i.done ? " is-done" : ""}`}>
        <div className="todo-top">
          <label className="item-main item-check">
            <input type="checkbox" checked={i.done || i.pending} onChange={(e) => void markDone(i, e.target.checked)} aria-label={`${i.done || i.pending ? "Not done" : "Done"}: ${i.title}`} />
            <span>
              <b>{i.title}</b>
              <span className="hint">
                {i.kind}{i.amount ? ` · $${i.amount.toLocaleString()}` : ""}
                {i.url && <> · <a href={i.url} target="_blank" rel="noreferrer noopener">open</a></>}
              </span>
              <span className="todo-due">{i.due ? `Due ${nice(i.due)}` : "No due date"}</span>
            </span>
          </label>
          <div className="item-actions">
            {i.pending ? <span className="pill pill-soon">Waiting for parent&apos;s OK</span>
              : i.done ? <span className="pill pill-ok">{i.doneLabel ?? "Done"} ✓</span>
              : <DueBadge iso={i.due} />}
            {isParent && i.pending && <button className="btn btn-inline btn-sm" onClick={() => void run(() => sb.from("tasks").update({ status: "done" }).eq("id", i.task!.id))}>Approve</button>}
          </div>
        </div>
        {i.steps && !i.done && (
          <details className="todo-steps">
            <summary>{left === 0 ? "All steps done. Ready to submit!" : `${i.steps.list.length - left} of ${i.steps.list.length} steps done`}</summary>
            <ul>
              {i.steps.list.map((s, n) => (
                <li key={n}>
                  <label className="item-check">
                    <input type="checkbox" checked={i.steps!.done.includes(n)} onChange={() => void toggleStep(i, n)} />
                    <span className={i.steps!.done.includes(n) ? "step-done" : ""}>{s.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            <a className="hint" href="/scholarships">Open the essay coach and full checklist →</a>
          </details>
        )}
      </li>
    );
  };

  return (
    <Page title={title}>
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>
          ))}
        </div>
      )}
      {error && <p className="note note-err" role="alert">{error}</p>}

      <div className="todo-summary">
        <span className={`todo-count todo-late${late ? "" : " is-zero"}`}><b>{late}</b> late</span>
        <span className={`todo-count todo-week${week ? "" : " is-zero"}`}><b>{week}</b> due this week</span>
        <span className="todo-count todo-done"><b>{done.length}</b> done</span>
      </div>

      <div className="tabs todo-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "todo"} onClick={() => setTab("todo")}>To do ({todo.length})</button>
        <button role="tab" aria-selected={tab === "done"} onClick={() => setTab("done")}>Done ({done.length})</button>
      </div>

      {tab === "todo" ? (
        todo.length === 0 ? (
          <div className="panel">
            <h2>{items.length ? "All caught up 🎉" : "Nothing here yet"}</h2>
            <p className="hint" style={{ margin: 0 }}>
              {items.length ? "Everything is done. New deadlines show up here when you add them." : "Add colleges and deadlines on the College plan, or save scholarships, and they show up here with their due dates."}
            </p>
            <p style={{ marginBottom: 0 }}><a href="/plan">College plan</a> · <a href="/scholarships">Scholarships</a></p>
          </div>
        ) : (
          GROUPS.map((g) => {
            const list = todo.filter((i) => urgency(i.due) === g.key);
            if (!list.length) return null;
            return (
              <section key={g.key} className={`panel todo-group todo-group-${g.key}`}>
                <h2><span className="todo-dot" aria-hidden="true" />{g.title} <span className="hint">({list.length})</span></h2>
                <p className="hint" style={{ margin: 0 }}>{g.hint}</p>
                <ul className="items">{list.map(row)}</ul>
              </section>
            );
          })
        )
      ) : done.length === 0 ? (
        <div className="panel"><h2>Nothing done yet</h2><p className="hint" style={{ margin: 0 }}>Tick the box next to a to-do when it&apos;s finished and it moves here.</p></div>
      ) : (
        <section className="panel todo-group todo-group-done">
          <h2><span className="todo-dot" aria-hidden="true" />Done <span className="hint">({done.length})</span></h2>
          <p className="hint" style={{ margin: 0 }}>Untick one to move it back to To do.</p>
          <ul className="items">{done.map(row)}</ul>
        </section>
      )}

      <p className="hint" style={{ marginTop: 16 }}>Add or change deadlines on the <a href="/plan">College plan</a>. Reminder emails go out before each due date.</p>
    </Page>
  );
}

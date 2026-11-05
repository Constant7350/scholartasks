"use client";

import { useEffect, useState } from "react";
import { addDays, checklistSteps, tradeTaskId } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { checklistById, tradeBySlug } from "../../lib/trades";

interface Student { id: string; first_name: string; state: string }

/** Shows an apply checklist and adds its steps to the student's To-do list (and so the calendar). */
export function AddChecklist({ id, trade }: { id: string; trade: string }) {
  const sb = supabase();
  const c = checklistById(id)!;
  const t = tradeBySlug(trade)!;
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [have, setHave] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return setSignedIn(false);
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return setSignedIn(false);
      setSignedIn(true);
      const [mem, st] = await Promise.all([
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name, state").order("first_name"),
      ]);
      const own = ((mem.data as { role: string; student_id: string | null }[]) ?? []).find((r) => r.role === "student")?.student_id;
      const list = (st.data as Student[]) ?? [];
      setStudents(list);
      setCurrent((x) => (x && list.some((s2) => s2.id === x) ? x : own ?? pickStudent(list, list[0]?.id)));
    })();
  }, [sb, setCurrent]);

  const student = students.find((s) => s.id === current);
  const steps = checklistSteps(c, student?.state ?? "GA");

  useEffect(() => {
    if (!sb || !student) return;
    void sb.from("tasks").select("deadline_id").eq("student_id", student.id).like("deadline_id", `tr:${c.id}:%`)
      .then(({ data }) => setHave(new Set(((data as { deadline_id: string }[]) ?? []).map((r) => r.deadline_id))));
  }, [sb, student, c.id]);

  const missing = steps.filter((s) => !have.has(tradeTaskId(c.id, s.key)));

  const add = async () => {
    if (!sb || !student) return;
    setBusy(true); setError(null); setMsg(null);
    const today = new Date().toLocaleDateString("en-CA");
    const rows = missing.map((s) => ({
      student_id: student.id, kind: "other", status: "todo", deadline_id: tradeTaskId(c.id, s.key),
      title: `${t.name}: ${s.title}`, due_on: addDays(today, s.days), url: s.url ?? `/trades/${t.slug}`,
    }));
    const { error: e } = await sb.from("tasks").insert(rows);
    setBusy(false);
    if (e) return setError(friendly(e));
    setHave(new Set([...have, ...rows.map((r) => r.deadline_id)]));
    setMsg(`Added ${rows.length} steps to ${student.first_name}'s To-do list.`);
  };

  return (
    <div className="trade-checklist">
      <h3>{c.title}</h3>
      <p className="hint">{c.summary}</p>
      <ol>
        {steps.map((s) => (
          <li key={s.key}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</li>
        ))}
      </ol>
      {signedIn === false && <a className="btn btn-inline btn-sm" href={`/signin?next=/trades/${t.slug}`}>Sign in to add these to a To-do list</a>}
      {signedIn && students.length === 0 && <p className="hint">Add a student on the <a href="/family">Family page</a> first.</p>}
      {signedIn && student && (missing.length === 0
        ? <p className="hint">✓ On {student.first_name}'s <a href="/todo">To-do list</a>.</p>
        : <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void add()}>
            {busy ? "Adding…" : `Add ${missing.length} steps to ${student.first_name}'s To-do list`}
          </button>)}
      {msg && <p className="hint" role="status">{msg} <a href="/todo">Open To-do list</a></p>}
      {error && <p className="note note-err" role="alert">{error}</p>}
    </div>
  );
}

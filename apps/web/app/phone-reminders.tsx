"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

declare global { interface Window { ReactNativeWebView?: { postMessage: (s: string) => void } } }

/**
 * Inside the ScholarTasks phone app, hands the app the coming deadlines so it
 * can show reminders on the phone itself (7, 2 and 1 days before, and on the
 * day), even when the app is closed. On the website this does nothing.
 */
export function PhoneReminders() {
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.ReactNativeWebView : undefined;
    const sb = supabase();
    if (!bridge || !sb) return;
    let stop = false;
    const send = async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session || stop) return;
      const today = new Date().toLocaleDateString("en-CA");
      const [students, tasks, colleges] = await Promise.all([
        sb.from("students").select("id, first_name"),
        sb.from("tasks").select("id, student_id, title, due_on, status").gte("due_on", today).in("status", ["todo", "needs_parent_approval"]),
        sb.from("student_colleges").select("id, student_id, name, deadline, status, approved").gte("deadline", today).in("status", ["considering", "applying"]),
      ]);
      if (tasks.error || colleges.error) return;
      const names = new Map(((students.data as { id: string; first_name: string }[]) ?? []).map((x) => [x.id, x.first_name]));
      const many = names.size > 1;
      const who = (id: string) => (many && names.get(id) ? `${names.get(id)}: ` : "");
      const items = [
        ...((tasks.data as { id: string; student_id: string; title: string; due_on: string }[]) ?? []).map((t) => ({ id: "t" + t.id, title: who(t.student_id) + t.title, date: t.due_on })),
        ...((colleges.data as { id: string; student_id: string; name: string; deadline: string; approved: boolean }[]) ?? [])
          .filter((c) => c.approved).map((c) => ({ id: "c" + c.id, title: `${who(c.student_id)}${c.name} application`, date: c.deadline })),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 40);
      bridge.postMessage(JSON.stringify({ reminders: items }));
    };
    void send();
    const onVis = () => { if (document.visibilityState === "visible") void send(); };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => void send(), 10 * 60_000);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return null;
}

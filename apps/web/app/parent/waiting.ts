import type { SupabaseClient } from "@supabase/supabase-js";
import { PART_TIME_KINDS } from "@scholartasks/core";

/** One thing waiting for a parent. `approve` is set when it can be approved with one tap (no signature needed). */
export interface Waiting { key: string; icon: string; text: string; href: string; action: string; approve?: { table: "task" | "college"; id: string } }

interface Rows { jobs: unknown; links: unknown; tasks: unknown; colleges: unknown; entries: unknown; perms: unknown }

/** Builds the "Waiting for you" list from the rows below. Used by Home and My parent space. */
export function waitingFrom(name: (id: string | null) => string, r: Rows): Waiting[] {
  const w: Waiting[] = [];
  for (const a of ((r.jobs as { id: string; student_id: string; title: string; company_name: string; kind: string; status: string }[] | null) ?? []).filter((x) => x.status === "needs_parent")) {
    const part = (PART_TIME_KINDS as readonly string[]).includes(a.kind);
    w.push({ key: `job-${a.id}`, icon: "🛍️", text: `${name(a.student_id)} wants to apply to ${a.title} at ${a.company_name}`, href: part ? "/jobs" : "/trades/openings", action: "Review and sign" });
  }
  for (const l of ((r.links as { id: string; student_id: string; school_name: string; status: string }[] | null) ?? []).filter((x) => x.status === "pending_parent")) {
    w.push({ key: `school-${l.id}`, icon: "🏫", text: `${name(l.student_id)} wants to connect to ${l.school_name}`, href: "/my-school", action: "Review and sign" });
  }
  for (const t of (r.tasks as { id: string; student_id: string; title: string }[] | null) ?? []) {
    w.push({ key: `task-${t.id}`, icon: "✅", text: `${name(t.student_id)} marked "${t.title}" done`, href: "/plan", action: "Check and approve", approve: { table: "task", id: t.id } });
  }
  for (const c of (r.colleges as { id: string; student_id: string; name: string }[] | null) ?? []) {
    w.push({ key: `college-${c.id}`, icon: "🗂️", text: `${name(c.student_id)} changed ${c.name} on the college list`, href: "/plan", action: "Check and approve", approve: { table: "college", id: c.id } });
  }
  // Essay challenge entries still waiting for a parent's signed permission (database update 59).
  const okd = new Set(((r.perms as { challenge_id: string; student_id: string }[] | null) ?? []).map((p) => `${p.challenge_id}:${p.student_id}`));
  for (const e of (r.entries as { challenge_id: string; student_id: string; challenges: { title: string; status: string } | null }[] | null) ?? []) {
    if (okd.has(`${e.challenge_id}:${e.student_id}`) || e.challenges?.status !== "open") continue;
    w.push({ key: `challenge-${e.challenge_id}-${e.student_id}`, icon: "🏆", text: `${name(e.student_id)} wants to take part in the challenge "${e.challenges.title}"`, href: "/challenge", action: "Read the rules and sign" });
  }
  return w;
}

/** Loads everything waiting for a parent (Home). */
export async function loadWaiting(sb: SupabaseClient, name: (id: string | null) => string): Promise<Waiting[]> {
  const [jobs, links, tasks, colleges, entries, perms] = await Promise.all([
    sb.rpc("my_job_applications"),
    sb.rpc("my_school_links"),
    sb.from("tasks").select("id, student_id, title").eq("status", "needs_parent_approval"),
    sb.from("student_colleges").select("id, student_id, name").eq("approved", false),
    sb.from("challenge_entries").select("challenge_id, student_id, challenges(title, status)").eq("status", "draft"),
    sb.from("challenge_permissions").select("challenge_id, student_id"),
  ]);
  return waitingFrom(name, { jobs: jobs.data, links: links.data, tasks: tasks.data, colleges: colleges.data, entries: entries.data, perms: perms.data });
}

/** One-tap approval for a student's to-do or college list change. */
export function approveWaiting(sb: SupabaseClient, a: NonNullable<Waiting["approve"]>) {
  return a.table === "task" ? sb.from("tasks").update({ status: "done" }).eq("id", a.id) : sb.rpc("approve_college", { p_college: a.id });
}

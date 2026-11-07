"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { Page } from "../ui";
import { usePortal } from "./portal";
import { ShareCode, daysAgo, type LocalSch } from "./parts";
import { WHAT, fmtDay, type Req } from "./transcripts";

interface Ev { id: string; title: string; starts_on: string }

/** Today: what needs the counselor right now, each with its one-click action. */
export default function Today() {
  const sb = supabase();
  const { school, role, rows, pending, me, reload } = usePortal();
  const [papers, setPapers] = useState<Req[] | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [local, setLocal] = useState<LocalSch[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const soon = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const [t, e, l] = await Promise.all([
      sb.rpc("school_transcript_requests", { p_school: school.id }),
      sb.from("school_events").select("id, title, starts_on").eq("school_id", school.id).gte("starts_on", today).lte("starts_on", soon).order("starts_on").limit(5),
      sb.rpc("school_scholarships", { p_school: school.id }),
    ]);
    setPapers(((t.data as Req[]) ?? []).filter((r) => r.status === "asked" || r.status === "to_ask"));
    setEvents((e.data as Ev[]) ?? []);
    setLocal(((l.data as LocalSch[]) ?? []).filter((s) => s.deadline && s.deadline >= today && s.deadline <= soon));
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);

  const all = rows ?? [];
  const seniors = all.filter((r) => r.grade_level === 12);
  const noFafsa = seniors.filter((r) => !r.fafsa_submitted).length;
  const noList = all.filter((r) => r.grade_level >= 11 && r.colleges === 0).length;
  const overdue = all.filter((r) => r.tasks_overdue > 0).length;
  const quiet = all.filter((r) => { const d = daysAgo(r.last_active); return d === null || d > 30; }).length;
  const sent = seniors.reduce((n, r) => n + r.submitted, 0);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const markSent = async (id: string) => {
    if (!sb) return;
    setErr(null);
    const { error } = await sb.rpc("school_mark_paper", { p_id: id, p_status: "sent", p_note: null });
    if (error) setErr(friendly(error)); else { void load(); reload(); }
  };

  const fafsaMsg = `/school/messages?grades=12&subject=${encodeURIComponent("Reminder: please file the FAFSA")}`;
  const items: { key: string; tone: "red" | "gold" | "gray"; title: string; sub: string; action?: { label: string; href?: string; onClick?: () => void } }[] = [
    ...(papers ?? []).slice(0, 6).map((p) => ({
      key: p.id, tone: "red" as const,
      title: `${WHAT[p.what] ?? p.what}${p.person ? ` (${p.person})` : ""} for ${p.first_name}, ${p.college}`,
      sub: p.needed_by ? `Needed by ${fmtDay(p.needed_by)}` : "No due date",
      action: { label: "Mark sent", onClick: () => void markSent(p.id) },
    })),
    ...(papers && papers.length > 6 ? [{ key: "more-papers", tone: "red" as const, title: `${papers.length - 6} more papers to send`, sub: "Transcripts and letters", action: { label: "See all", href: "/school/papers" } }] : []),
    ...(noFafsa ? [{ key: "fafsa", tone: "gold" as const, title: `${noFafsa} ${noFafsa === 1 ? "senior has" : "seniors have"} not filed the FAFSA`, sub: "Send one reminder to grade 12", action: { label: "Remind them", href: fafsaMsg } }] : []),
    ...(overdue ? [{ key: "overdue", tone: "gold" as const, title: `${overdue} ${overdue === 1 ? "student has" : "students have"} overdue deadlines`, sub: "On their own to-do lists", action: { label: "See who", href: "/school/students?f=overdue" } }] : []),
    ...(noList ? [{ key: "nolist", tone: "gray" as const, title: `${noList} juniors and seniors have no college list yet`, sub: "A good time for a planning night", action: { label: "See who", href: "/school/students?f=no_list" } }] : []),
    ...(quiet ? [{ key: "quiet", tone: "gray" as const, title: `${quiet} ${quiet === 1 ? "student hasn't" : "students haven't"} used the app in 30 days`, sub: "Maybe a quick check-in", action: { label: "See who", href: "/school/students?f=quiet" } }] : []),
    ...(pending ? [{ key: "pending", tone: "gray" as const, title: `${pending} ${pending === 1 ? "family asked" : "families asked"} to connect`, sub: "Waiting for a parent to approve. Nothing for you to do." }] : []),
  ];

  return (
    <Page>
      <div className="portal-head">
        <div>
          <p className="hint" style={{ margin: 0 }}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 style={{ margin: 0 }}>{hello}{me ? `, ${me.split(" ")[0]}` : ""}</h1>
        </div>
        <div className="share-row">
          <a className="btn btn-ghost btn-inline" href="/school/settings">Invite families</a>
          <a className="btn btn-inline" href="/school/messages">Send a message</a>
        </div>
      </div>

      {rows !== null && all.length === 0 ? (
        <>
          <p className="note note-info">No students yet. Share this code with families. When a parent connects, the student shows up here.</p>
          <ShareCode school={school} role={role} onChanged={reload} />
        </>
      ) : (
        <ul className="portal-stats">
          <li><b>{all.length}</b><span>students connected{seniors.length ? `, ${seniors.length} seniors` : ""}</span></li>
          <li><b>{seniors.length - noFafsa} <small>of {seniors.length}</small></b><span>seniors filed the FAFSA</span>
            {seniors.length > 0 && <span className="portal-bar" aria-hidden="true"><span style={{ width: `${Math.round(((seniors.length - noFafsa) / seniors.length) * 100)}%` }} /></span>}</li>
          <li><b>{sent}</b><span>college applications sent by seniors</span></li>
          <li><b>{papers?.length ?? "…"}</b><span>transcripts and letters to send</span></li>
        </ul>
      )}

      {err && <p className="note note-err" role="alert">{err}</p>}
      <div className="portal-two">
        <section className="panel">
          <h2>Needs you today</h2>
          {rows === null || papers === null ? <p className="hint">Loading…</p> : items.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>Nothing needs you right now. 🎉</p>
          ) : (
            <ul className="portal-todo">
              {items.map((i) => (
                <li key={i.key}>
                  <span className={`portal-dot portal-dot-${i.tone}`} aria-hidden="true" />
                  <div><b>{i.title}</b><small>{i.sub}</small></div>
                  {i.action?.href && <a className="btn btn-ghost btn-inline portal-act" href={i.action.href}>{i.action.label}</a>}
                  {i.action?.onClick && <button type="button" className="btn btn-ghost btn-inline portal-act" onClick={i.action.onClick}>{i.action.label}</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Coming up</h2>
          {events.length === 0 && local.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>Nothing in the next few weeks. <a href="/school/events">Add an event</a></p>
          ) : (
            <ul className="portal-dates">
              {[...events.map((e) => ({ id: e.id, day: e.starts_on, title: e.title, href: "/school/events" })),
                ...local.map((s) => ({ id: s.id, day: s.deadline!, title: `${s.name} closes`, href: "/school/scholarships" }))]
                .sort((a, b) => a.day.localeCompare(b.day))
                .map((d) => <li key={d.id}><span className="portal-date">{fmtDay(d.day)}</span><a href={d.href}>{d.title}</a></li>)}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { Page } from "../../ui";
import { usePortal } from "../portal";
import { fmtDay } from "../transcripts";
import { timeText, type SchoolEvent } from "../event-time";

/** FAFSA nights, college visits, deadlines. Connected families see them on My school. */
export default function Events() {
  const sb = supabase();
  const { school } = usePortal();
  const [list, setList] = useState<SchoolEvent[] | null>(null);
  const [f, setF] = useState({ title: "", day: "", time: "", location: "", details: "" });
  const [grades, setGrades] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("school_events").select("id, title, starts_on, start_time, location, details, grades").eq("school_id", school.id).order("starts_on");
    if (error && /school_events/.test(error.message)) setErr("Events need database update 63. Ask the ScholarTasks team.");
    setList((data as SchoolEvent[]) ?? []);
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const toggle = (g: number) => setGrades((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g].sort()));
  const add = async () => {
    if (!sb) return;
    setErr(null); setOk(null);
    const { error } = await sb.from("school_events").insert({
      school_id: school.id, title: f.title.trim(), starts_on: f.day, start_time: f.time || null,
      location: f.location.trim() || null, details: f.details.trim() || null, grades,
    });
    if (error) return setErr(friendly(error));
    setOk(f.title.trim());
    setF({ title: "", day: "", time: "", location: "", details: "" });
    void load();
  };

  const upcoming = (list ?? []).filter((e) => e.starts_on >= today);
  const past = (list ?? []).filter((e) => e.starts_on < today).reverse();
  return (
    <Page title="Events">
      <div className="panel">
        <h2>Add an event</h2>
        <p className="hint">Families connected to your school see it on their My school page and can add it to their calendar.</p>
        <div className="row">
          <div className="field"><label htmlFor="e-title">What</label><input id="e-title" className="input" maxLength={150} value={f.title} onChange={set("title")} placeholder="e.g. FAFSA night" /></div>
          <div className="field" style={{ flex: "0 1 170px" }}><label htmlFor="e-day">Date</label><input id="e-day" type="date" className="input" value={f.day} onChange={set("day")} /></div>
          <div className="field" style={{ flex: "0 1 140px" }}><label htmlFor="e-time">Time (optional)</label><input id="e-time" type="time" className="input" value={f.time} onChange={set("time")} /></div>
        </div>
        <div className="field" style={{ marginTop: 12 }}><label htmlFor="e-where">Where (optional)</label><input id="e-where" className="input" maxLength={200} value={f.location} onChange={set("location")} placeholder="e.g. Library" /></div>
        <div className="field"><label htmlFor="e-details">Details (optional)</label><textarea id="e-details" className="input" rows={2} maxLength={1500} value={f.details} onChange={set("details")} /></div>
        <p className="small" style={{ margin: "4px 0 6px", fontWeight: 600 }}>For</p>
        <div className="chips" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
          <button type="button" className={`chip ${grades.length === 0 ? "chip-on" : ""}`} aria-pressed={grades.length === 0} onClick={() => setGrades([])}>Everyone</button>
          {[8, 9, 10, 11, 12].map((g) => <button key={g} type="button" className={`chip ${grades.includes(g) ? "chip-on" : ""}`} aria-pressed={grades.includes(g)} onClick={() => toggle(g)}>Grade {g}</button>)}
        </div>
        <button type="button" className="btn btn-inline" disabled={f.title.trim().length < 2 || !f.day} onClick={() => void add()}>Add event</button>
        {ok && (
          <p className="note note-ok" role="status">
            Added. Families see it now.{" "}
            <a href={`/school/messages?${new URLSearchParams({ ...(grades.length ? { grades: grades.join(",") } : {}), subject: ok })}`}>Email them about it too</a>
          </p>
        )}
        {err && <p className="note note-err" role="alert">{err}</p>}
      </div>

      <div className="panel">
        <h2>Coming up</h2>
        {list === null ? <p className="hint">Loading…</p> : upcoming.length === 0 ? <p className="hint" style={{ margin: 0 }}>No events yet.</p> : (
          <ul className="portal-dates">
            {upcoming.map((e) => <EventLine key={e.id} e={e} onDelete={load} />)}
          </ul>
        )}
        {past.length > 0 && (
          <details className="perm" style={{ marginTop: 12 }}>
            <summary>Past events ({past.length})</summary>
            <ul className="portal-dates">{past.map((e) => <EventLine key={e.id} e={e} onDelete={load} />)}</ul>
          </details>
        )}
      </div>
    </Page>
  );
}

function EventLine({ e, onDelete }: { e: SchoolEvent; onDelete: () => void }) {
  const sb = supabase();
  return (
    <li>
      <span className="portal-date">{fmtDay(e.starts_on)}</span>
      <span style={{ flex: 1 }}>
        <b>{e.title}</b>
        <small className="hint" style={{ display: "block" }}>
          {[timeText(e.start_time), e.location, e.grades.length ? `Grade ${e.grades.join(", ")}` : "Everyone"].filter(Boolean).join(" · ")}
        </small>
      </span>
      <button type="button" className="admin-linkbtn" onClick={async () => {
        if (!sb || !window.confirm(`Delete "${e.title}"? Families stop seeing it.`)) return;
        await sb.from("school_events").delete().eq("id", e.id); onDelete();
      }}>Delete</button>
    </li>
  );
}

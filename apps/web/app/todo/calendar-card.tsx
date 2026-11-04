"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Put these dates in my calendar": one private link that Google, Apple or
 * Outlook calendar checks every few hours, so new deadlines appear by themselves.
 */
export function CalendarCard({ sb }: { sb: SupabaseClient }) {
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const get = async (fresh = false) => {
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("my_calendar_token", { p_new: fresh });
    setBusy(false);
    if (error || typeof data !== "string") return setMsg(/function|schema cache/i.test(error?.message ?? "") ? "Calendar links need the latest database update." : "Couldn't make the link. Try again.");
    setLink(`${window.location.origin}/api/calendar/${data}.ics`);
    if (fresh) setMsg("New link made. The old one no longer works; add the new one to your calendar.");
  };
  const copy = async () => { if (link) { try { await navigator.clipboard.writeText(link); setMsg("Link copied ✓"); } catch { setMsg("Copy the link above."); } } };

  const webcal = link?.replace(/^https?:/, "webcal:");
  return (
    <section className="panel">
      <h2>📅 Put these dates in my calendar</h2>
      <p className="hint" style={{ marginTop: 0 }}>Every deadline on this list shows up in your phone or computer calendar, with a reminder the evening before. New dates appear by themselves. Each parent and student adds their own.</p>
      {!link ? (
        <button className="btn btn-inline" disabled={busy} onClick={() => void get()}>{busy ? "Making…" : "Add to my calendar"}</button>
      ) : (
        <>
          <div className="row">
            <a className="btn btn-inline link-btn" href={webcal}>iPhone or Mac Calendar</a>
            <a className="btn btn-inline link-btn" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal!)}`} target="_blank" rel="noreferrer noopener">Google Calendar</a>
            <a className="btn btn-inline link-btn" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(link)}&name=ScholarTasks`} target="_blank" rel="noreferrer noopener">Outlook</a>
            <button className="btn btn-ghost btn-inline" onClick={() => void copy()}>Copy link</button>
          </div>
          <p className="hint">Keep this link private: anyone who has it can see the dates. <button className="btn-link" onClick={() => void get(true)}>Make a new link</button> if you shared it by mistake.</p>
        </>
      )}
      {msg && <p className="hint" role="status">{msg}</p>}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";

export interface Req {
  id: string; student_id?: string; first_name: string; grade_level: number; college: string; plan: string; what: string; person: string | null;
  how: string; needed_by: string | null; status: "asked" | "sent" | "received" | "to_ask"; asked_on: string | null;
  sent_on: string | null; school_note: string | null;
}
export const WHAT: Record<string, string> = {
  transcript: "Transcript", counselor_letter: "Counselor letter and school report", teacher_letter: "Teacher letter",
  test_scores: "Test scores", mid_year: "Mid-year report", final_transcript: "Final transcript",
};
const HOW: Record<string, string> = {
  common_app: "Common App", gafutures: "GAfutures", parchment: "Parchment", college_portal: "College's own portal",
  email: "Email", mail: "Mail", testing_agency: "College Board or ACT", other: "Other",
};
export const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Transcript and letter requests students sent in the app. Students still apply on Common App or the
 * college's site; this is the counselor's to-send list. Opening it is written to the audit log.
 */
export function SchoolTranscripts({ schoolId, onChanged }: { schoolId: string; onChanged?: () => void }) {
  const sb = supabase();
  const [list, setList] = useState<Req[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.rpc("school_transcript_requests", { p_school: schoolId });
    if (error) setErr(/school_transcript_requests/.test(error.message) ? "Transcript requests need database update 62. Ask the ScholarTasks team." : friendly(error));
    setList((data as Req[]) ?? []);
  }, [sb, schoolId]);
  useEffect(() => { void load(); }, [load]);
  const changed = () => { void load(); onChanged?.(); };

  const toSend = (list ?? []).filter((r) => r.status === "asked" || r.status === "to_ask");
  const done = (list ?? []).filter((r) => r.status === "sent" || r.status === "received");
  return (
    <div className="panel">
      <h2>Transcript and letter requests{toSend.length ? ` (${toSend.length} to send)` : ""}</h2>
      <p className="hint">Students ask here for what each college needs from the school. Send it the way you always do (Common App, GAfutures, Parchment), then tap <b>Sent</b>. The family sees it, with your note.</p>
      {err && <p className="note note-err" role="alert">{err}</p>}
      {!list && <p className="hint">Loading…</p>}
      {list && list.length === 0 && !err && <p className="hint">None yet.</p>}
      {toSend.map((r) => <One key={r.id} r={r} onChanged={changed} />)}
      {done.length > 0 && (
        <details className="rescue-more" style={{ marginTop: 10 }}>
          <summary>Sent ({done.length})</summary>
          {done.map((r) => <One key={r.id} r={r} onChanged={changed} />)}
        </details>
      )}
    </div>
  );
}

function One({ r, onChanged }: { r: Req; onChanged: () => void }) {
  const sb = supabase();
  const [note, setNote] = useState(r.school_note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const mark = async (status: "sent" | "asked") => {
    if (!sb) return;
    setMsg(null);
    const { error } = await sb.rpc("school_mark_paper", { p_id: r.id, p_status: status, p_note: note });
    if (error) return setMsg(friendly(error));
    onChanged();
  };
  const sent = r.status === "sent" || r.status === "received";
  const soon = r.needed_by && !sent && new Date(r.needed_by + "T00:00:00").getTime() - Date.now() < 7 * 86_400_000;
  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b>{r.first_name}</b> · grade {r.grade_level} · {r.college} ({r.plan})
          <div>{WHAT[r.what] ?? r.what}{r.person ? ` · ${r.person}` : ""} · by {HOW[r.how] ?? r.how}</div>
          <div className="hint small">
            {r.needed_by ? <span className={soon ? "pill pill-late" : ""}>Needed by {fmtDay(r.needed_by)}</span> : "No deadline given"}
            {r.asked_on ? ` · asked ${fmtDay(r.asked_on)}` : ""}{r.sent_on ? ` · sent ${fmtDay(r.sent_on)}` : ""}
          </div>
        </div>
        <span className={`pill ${sent ? "pill-ok" : "pill-soon"}`}>{sent ? (r.status === "received" ? "College has it" : "Sent") : "To send"}</span>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 6 }}>
        <div className="field" style={{ flex: "1 1 240px", margin: 0 }}>
          <label htmlFor={`tn-${r.id}`} className="small">Note the family will see (optional)</label>
          <input id={`tn-${r.id}`} className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sent through Common App. Pay the $5 fee at the front office." />
        </div>
        {!sent && <button className="btn btn-inline btn-sm" onClick={() => void mark("sent")}>Sent</button>}
        {sent && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void mark("asked")}>Not sent yet</button>}
        {!sent && note.trim() !== (r.school_note ?? "") && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void mark("asked")}>Save note</button>}
      </div>
      {msg && <p className="note note-err" role="alert">{msg}</p>}
    </div>
  );
}

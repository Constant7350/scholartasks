"use client";

import { useCallback, useEffect, useState } from "react";
import type { SchoolPacket } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";

type Status = "new" | "reviewing" | "awarded" | "not_awarded";
interface App {
  id: string; scholarship_id: string; scholarship_name: string; first_name: string; grade_level: number;
  packet: SchoolPacket; sent_at: string; status: Status; school_note: string | null;
}
const LABEL: Record<Status, string> = { new: "New", reviewing: "Reviewing", awarded: "Awarded", not_awarded: "Not chosen" };

/**
 * Applications students sent in the app for this school's own local scholarships.
 * Families chose what to include. Opening this list is written to the audit log.
 */
export function SchoolApplications({ schoolId }: { schoolId: string }) {
  const sb = supabase();
  const [list, setList] = useState<App[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.rpc("school_applications", { p_school: schoolId });
    if (error) setErr(friendly(error));
    setList((data as App[]) ?? []);
  }, [sb, schoolId]);
  useEffect(() => { void load(); }, [load]);

  if (!list || list.length === 0) {
    return (
      <div className="panel">
        <h2>Applications for your scholarships</h2>
        <p className="hint">{list ? "None yet. When a student applies in the app for one of your local scholarships, it shows up here." : "Loading…"}</p>
        {err && <p className="note note-err" role="alert">{err}</p>}
      </div>
    );
  }
  const names = [...new Set(list.map((a) => a.scholarship_name))];
  return (
    <div className="panel">
      <h2>Applications for your scholarships ({list.length})</h2>
      <p className="hint">Sent by students in the app. Each family chose what to include. Mark where each one stands, and the family sees it (with your note) in their app.</p>
      {err && <p className="note note-err" role="alert">{err}</p>}
      {names.map((n) => (
        <div key={n} style={{ marginTop: 14 }}>
          <h3 style={{ margin: "0 0 6px" }}>{n}</h3>
          {list.filter((a) => a.scholarship_name === n).map((a) => <One key={a.id} a={a} onChanged={load} />)}
        </div>
      ))}
    </div>
  );
}

function One({ a, onChanged }: { a: App; onChanged: () => void }) {
  const sb = supabase();
  const [note, setNote] = useState(a.school_note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const p = a.packet;
  const mark = async (status: Exclude<Status, "new">) => {
    if (!sb) return;
    setMsg(null);
    const { error } = await sb.rpc("school_review_application", { p_id: a.id, p_status: status, p_note: note });
    if (error) return setMsg(friendly(error));
    onChanged();
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    w.document.write(`<title>${esc(p.full_name)} · ${esc(a.scholarship_name)}</title><body style="font-family:sans-serif;max-width:720px;margin:24px auto;line-height:1.5">
      <h1 style="font-size:22px">${esc(a.scholarship_name)}</h1><p><b>${esc(p.full_name)}</b> · Grade ${p.grade_level}${p.email ? ` · ${esc(p.email)}` : ""}</p>
      ${p.gpa || p.sat || p.act ? `<p>${[p.gpa && `GPA ${esc(p.gpa)}`, p.sat && `SAT ${p.sat}`, p.act && `ACT ${p.act}`].filter(Boolean).join(" · ")}</p>` : ""}
      ${p.answers.map((x) => `<h3 style="font-size:15px;margin-bottom:2px">${esc(x.q)}</h3><p style="white-space:pre-wrap;margin-top:0">${esc(x.a)}</p>`).join("")}
      ${p.essay ? `<h3 style="font-size:15px">Essay</h3><p style="white-space:pre-wrap">${esc(p.essay.text)}</p>` : ""}
      ${p.activities?.length ? `<h3 style="font-size:15px">Activities</h3><ul>${p.activities.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${p.honors?.length ? `<h3 style="font-size:15px">Honors</h3><ul>${p.honors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${p.letters?.length ? `<p><b>Letters from:</b> ${p.letters.map(esc).join(", ")}</p>` : ""}</body>`);
    w.document.close();
    w.print();
  };
  return (
    <details className="rescue-more" style={{ marginBottom: 8 }}>
      <summary>
        <b>{p.full_name}</b> · grade {a.grade_level} · sent {new Date(a.sent_at).toLocaleDateString()}{" "}
        <span className={`pill ${a.status === "awarded" ? "pill-ok" : a.status === "new" ? "pill-soon" : ""}`}>{LABEL[a.status]}</span>
      </summary>
      <div style={{ padding: "8px 4px" }}>
        {p.email && <p className="hint" style={{ margin: "0 0 6px" }}>Email: <a href={`mailto:${p.email}`}>{p.email}</a></p>}
        {(p.gpa || p.sat || p.act) && <p style={{ margin: "0 0 6px" }}>{[p.gpa && `GPA ${p.gpa}`, p.sat && `SAT ${p.sat}`, p.act && `ACT ${p.act}`].filter(Boolean).join(" · ")}</p>}
        {p.answers.map((x, i) => <div key={i} style={{ marginBottom: 8 }}><b>{x.q}</b><p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}>{x.a}</p></div>)}
        {p.essay && <div style={{ marginBottom: 8 }}><b>Essay</b><p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}>{p.essay.text}</p></div>}
        {!!p.activities?.length && <><b>Activities</b><ul style={{ margin: "2px 0 8px" }}>{p.activities.map((x) => <li key={x}>{x}</li>)}</ul></>}
        {!!p.honors?.length && <><b>Honors</b><ul style={{ margin: "2px 0 8px" }}>{p.honors.map((x) => <li key={x}>{x}</li>)}</ul></>}
        {!!p.letters?.length && <p className="hint">Letters from: {p.letters.join(", ")}</p>}
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor={`note-${a.id}`}>Note the family will see (optional)</label>
          <input id={`note-${a.id}`} className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Interviews are December 2 in the library." />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void mark("reviewing")}>Reviewing</button>
          <button className="btn btn-inline btn-sm" onClick={() => void mark("awarded")}>Awarded</button>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void mark("not_awarded")}>Not chosen</button>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={print}>Print</button>
        </div>
        {msg && <p className="note note-err" role="alert">{msg}</p>}
      </div>
    </details>
  );
}

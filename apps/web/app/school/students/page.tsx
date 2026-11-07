"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { displayGpa } from "@scholartasks/core";
import { gpaLabel } from "../../../lib/state-packs";
import { friendly, supabase } from "../../../lib/supabase";
import { Page } from "../../ui";
import { usePortal } from "../portal";
import { FILTERS, csvCell, daysAgo, hopeGpa, type Filter, type Row } from "../parts";
import { WHAT, fmtDay, type Req } from "../transcripts";

interface Note { id: string; body: string; author_id: string; author_name: string | null; created_at: string }

/** Every connected student in one table. Click a name to see the student on the right. */
export default function Students() {
  const sb = supabase();
  const { school, rows, reload } = usePortal();
  const [grade, setGrade] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [papers, setPapers] = useState<Req[]>([]);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("f") as Filter | null;
    if (f && FILTERS.some(([k]) => k === f)) setFilter(f);
  }, []);
  useEffect(() => {
    if (!sb) return;
    void sb.rpc("school_transcript_requests", { p_school: school.id }).then(({ data }) => setPapers((data as Req[]) ?? []));
  }, [sb, school.id]);

  const all = rows ?? [];
  const count = (f: Filter) => all.filter((r) => match(r, f)).length;
  const list = useMemo(() => all.filter((r) =>
    (!grade || r.grade_level === grade) && match(r, filter) && (!q.trim() || r.first_name.toLowerCase().includes(q.trim().toLowerCase())),
  ), [all, grade, filter, q]);
  const sel = all.find((r) => r.student_id === open) ?? null;

  const exportCsv = () => {
    const head = ["First name", "Grade", "Class of", "Colleges on list", "Applications sent", "Accepted", "FAFSA filed", "Aid steps done",
      "Scholarships saved", "Overdue deadlines", "Due in 14 days", "SAT", "ACT", `${gpaLabel(school.state)} (if shared)`, "Last active"];
    const lines = list.map((r) => {
      const g = hopeGpa(r, school.state);
      return [r.first_name, r.grade_level, r.class_of, r.colleges, r.submitted, r.accepted, r.fafsa_submitted ? "yes" : "no", r.aid_steps_done,
        r.scholarships_saved, r.tasks_overdue, r.tasks_next_14, r.sat ?? "", r.act ?? "", g === null ? "" : displayGpa(g), r.last_active ?? ""].map(csvCell).join(",");
    });
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${school.name.replace(/[^a-z0-9]+/gi, "-")}-students.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page>
      <div className="portal-head">
        <div>
          <h1 style={{ margin: 0 }}>Students</h1>
          <p className="hint" style={{ margin: 0 }}>Only students whose parents connected them appear here, with what they chose to share.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-inline" disabled={!list.length} onClick={exportCsv}>Download CSV</button>
      </div>

      <div className="row" style={{ alignItems: "end", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div className="field" style={{ flex: "0 1 220px", margin: 0 }}>
          <label htmlFor="f-q">Search</label>
          <input id="f-q" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="First name" />
        </div>
        <div className="field" style={{ flex: "0 1 150px", margin: 0 }}>
          <label htmlFor="f-grade">Grade</label>
          <select id="f-grade" className="input" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            <option value={0}>All grades</option>
            {[8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
      </div>
      <div className="chips" style={{ justifyContent: "flex-start", marginBottom: 14 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`chip ${filter === k ? "chip-on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label} ({count(k)})
          </button>
        ))}
      </div>

      <div className="portal-split">
        <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
          {rows === null ? <p className="hint" style={{ padding: 16 }}>Loading…</p> : list.length === 0 ? (
            <p className="hint" style={{ padding: 16, margin: 0 }}>{all.length === 0 ? "No students yet. Share your school code with families (Families and staff)." : "No students match."}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="record-table school-table">
                <thead><tr><th>Student</th><th>Grade</th><th>Colleges</th><th>FAFSA</th><th>Deadlines</th><th>Last active</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const d = daysAgo(r.last_active);
                    return (
                      <tr key={r.link_id} className={open === r.student_id ? "portal-row-on" : ""}>
                        <td><button type="button" className="admin-linkbtn" style={{ fontSize: 15 }} onClick={() => setOpen(open === r.student_id ? null : r.student_id)}>{r.first_name}</button></td>
                        <td>{r.grade_level}</td>
                        <td>{r.colleges === 0 ? <span className="pill pill-soon">None yet</span> : `${r.submitted} of ${r.colleges} sent${r.accepted ? `, ${r.accepted} in` : ""}`}</td>
                        <td>{r.grade_level < 12 ? "—" : r.fafsa_submitted ? <span className="pill pill-ok">Filed</span> : <span className="pill pill-late">Not yet</span>}</td>
                        <td>{r.tasks_overdue ? <span className="pill pill-late">{r.tasks_overdue} overdue</span> : null} {r.tasks_next_14 ? `${r.tasks_next_14} soon` : r.tasks_overdue ? "" : "—"}</td>
                        <td>{d === null ? "Never" : d === 0 ? "Today" : `${d}d ago`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {sel && <StudentPanel key={sel.student_id} r={sel} papers={papers.filter((p) => p.student_id === sel.student_id)} onClose={() => setOpen(null)} onRemoved={() => { setOpen(null); reload(); }} />}
      </div>
    </Page>
  );
}

function match(r: Row, f: Filter) {
  if (f === "no_fafsa") return r.grade_level === 12 && !r.fafsa_submitted;
  if (f === "no_list") return r.colleges === 0;
  if (f === "overdue") return r.tasks_overdue > 0;
  if (f === "quiet") { const d = daysAgo(r.last_active); return d === null || d > 30; }
  return true;
}

function StudentPanel({ r, papers, onClose, onRemoved }: { r: Row; papers: Req[]; onClose: () => void; onRemoved: () => void }) {
  const sb = supabase();
  const { school } = usePortal();
  const [notes, setNotes] = useState<Note[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const g = hopeGpa(r, school.state);
  const d = daysAgo(r.last_active);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("school_student_notes").select("id, body, author_id, author_name, created_at")
      .eq("school_id", school.id).eq("student_id", r.student_id).order("created_at", { ascending: false });
    if (error && /school_student_notes/.test(error.message)) setErr("Notes need database update 63. Ask the ScholarTasks team.");
    setNotes((data as Note[]) ?? []);
  }, [sb, school.id, r.student_id]);
  useEffect(() => { void load(); void sb?.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null)); }, [load, sb]);

  const add = async () => {
    if (!sb || !text.trim()) return;
    setErr(null);
    const { error } = await sb.from("school_student_notes").insert({ school_id: school.id, student_id: r.student_id, body: text.trim() });
    if (error) setErr(friendly(error)); else { setText(""); void load(); }
  };

  return (
    <aside className="panel portal-panel" aria-label={r.first_name}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{r.first_name}</h2>
          <p className="hint" style={{ margin: 0 }}>Grade {r.grade_level} · {r.share === "progress" ? "shares progress" : "shares progress and grades"} · active {d === null ? "never" : d === 0 ? "today" : `${d} days ago`}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-inline btn-sm" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <ul className="portal-facts">
        <li><small>{gpaLabel(school.state)}</small><b>{r.share === "progress" ? "Not shared" : g === null ? "—" : displayGpa(g)}</b></li>
        <li><small>Tests</small><b>{[r.sat ? `SAT ${r.sat}` : "", r.act ? `ACT ${r.act}` : ""].filter(Boolean).join(", ") || "—"}</b></li>
        <li><small>Colleges</small><b>{r.colleges ? `${r.submitted} of ${r.colleges} sent${r.accepted ? `, ${r.accepted} in` : ""}` : "None yet"}</b></li>
        <li><small>FAFSA</small><b>{r.grade_level < 12 ? "Not yet due" : r.fafsa_submitted ? "Filed" : "Not yet"}</b></li>
        <li><small>Scholarships saved</small><b>{r.scholarships_saved}</b></li>
        <li><small>Deadlines</small><b>{r.tasks_overdue ? `${r.tasks_overdue} overdue` : r.tasks_next_14 ? `${r.tasks_next_14} soon` : "On track"}</b></li>
      </ul>
      {papers.length > 0 && (
        <>
          <h3 className="portal-h3">Papers asked for</h3>
          <ul className="portal-dates">
            {papers.map((p) => (
              <li key={p.id}><span className={`pill ${p.status === "sent" || p.status === "received" ? "pill-ok" : "pill-soon"}`}>{p.status === "sent" || p.status === "received" ? "Sent" : "To send"}</span>
                {WHAT[p.what] ?? p.what}, {p.college}{p.needed_by ? ` · ${fmtDay(p.needed_by)}` : ""}</li>
            ))}
          </ul>
          <a href="/school/papers" className="small">Open transcripts and letters</a>
        </>
      )}
      <h3 className="portal-h3">Private notes</h3>
      <p className="hint small" style={{ marginTop: 0 }}>Only counselors at {school.name} see these. The family never does.</p>
      <div className="row" style={{ gap: 8, alignItems: "end" }}>
        <textarea aria-label="New note" className="input" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Met 11/3, wants engineering." style={{ flex: 1 }} />
        <button type="button" className="btn btn-inline btn-sm" disabled={!text.trim()} onClick={() => void add()}>Save</button>
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
      <ul className="portal-notes">
        {notes.map((n) => (
          <li key={n.id}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{n.body}</p>
            <small className="hint">{n.author_name ?? "Counselor"} · {new Date(n.created_at).toLocaleDateString()}
              {n.author_id === me && <> · <button type="button" className="admin-linkbtn" onClick={async () => { await sb?.from("school_student_notes").delete().eq("id", n.id); void load(); }}>Delete</button></>}
            </small>
          </li>
        ))}
      </ul>
      <button type="button" className="admin-linkbtn" style={{ color: "var(--err)", marginTop: 12 }}
        onClick={async () => {
          if (!sb || !window.confirm(`Stop following ${r.first_name}? The family can connect again with your code.`)) return;
          const { error } = await sb.rpc("end_school_link", { p_link: r.link_id });
          if (error) setErr(friendly(error)); else onRemoved();
        }}>Stop following {r.first_name}</button>
    </aside>
  );
}

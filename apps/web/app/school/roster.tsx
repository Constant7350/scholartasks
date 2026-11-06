"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import type { School } from "./dashboard";

interface Agreement { id: string; signer_name: string; signer_title: string; district: string | null; signed_at: string; ended_at: string | null }
interface RosterRow { student_ref: string; first_name: string; last_name: string; grade_level: number; email: string | null; connected: boolean; invited_at: string | null }
interface Upload { student_ref: string; first_name: string; last_name: string; grade_level: number; email: string | null }

/** Splits CSV text into rows, handling quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some((x) => x.trim())) rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const HEADERS: Record<keyof Upload, RegExp> = {
  student_ref: /^(student\s*)?(id|number|#)$|student\s*(id|number)/i,
  first_name: /first/i,
  last_name: /last|surname/i,
  grade_level: /grade/i,
  email: /e-?mail/i,
};

/** Turns the school's export into roster rows. Returns rows and any problems found. */
export function rosterFromCsv(text: string): { rows: Upload[]; problems: string[] } {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], problems: ["The file needs a header row and at least one student."] };
  const head = all[0]!.map((h) => h.trim());
  const col = (k: keyof Upload) => head.findIndex((h) => HEADERS[k].test(h));
  const idx = { student_ref: col("student_ref"), first_name: col("first_name"), last_name: col("last_name"), grade_level: col("grade_level"), email: col("email") };
  const missing = (["student_ref", "first_name", "last_name", "grade_level"] as const).filter((k) => idx[k] < 0);
  if (missing.length) return { rows: [], problems: [`Missing columns: ${missing.map((m) => ({ student_ref: "Student ID", first_name: "First name", last_name: "Last name", grade_level: "Grade" })[m]).join(", ")}.`] };
  const rows: Upload[] = [], problems: string[] = [];
  all.slice(1).forEach((r, i) => {
    const get = (j: number) => (j >= 0 ? (r[j] ?? "").trim() : "");
    const grade = parseInt(get(idx.grade_level).replace(/\D/g, ""), 10);
    const email = get(idx.email).toLowerCase();
    const row = { student_ref: get(idx.student_ref).slice(0, 40), first_name: get(idx.first_name).slice(0, 80), last_name: get(idx.last_name).slice(0, 80), grade_level: grade, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email.slice(0, 200) : null };
    if (!row.student_ref || !row.first_name || !row.last_name || !(grade >= 6 && grade <= 12)) problems.push(`Row ${i + 2} skipped (needs student ID, first and last name, and grade 6 to 12).`);
    else rows.push(row);
  });
  return { rows, problems: problems.slice(0, 10) };
}

/**
 * Class roster (school portal phase 2): the school admin signs the student data
 * agreement and uploads a CSV export. Counselors see who has connected and can
 * email the school code to families who haven't.
 */
export function Roster({ school, role }: { school: School; role: "admin" | "counselor" }) {
  const sb = supabase();
  const [dpa, setDpa] = useState<Agreement | null | undefined>(undefined);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [form, setForm] = useState({ name: "", title: "", district: "", agree: false });
  const [pending, setPending] = useState<{ rows: Upload[]; problems: string[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "not">("not");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const [a, r] = await Promise.all([
      sb.from("school_data_agreements").select("id, signer_name, signer_title, district, signed_at, ended_at").eq("school_id", school.id).is("ended_at", null).maybeSingle(),
      sb.rpc("school_roster_status", { p_school: school.id }),
    ]);
    if (a.error && /school_data_agreements/.test(a.error.message)) { setDpa(null); setNote({ ok: false, text: "Run database update 44 in Supabase to use rosters." }); return; }
    setDpa((a.data as Agreement | null) ?? null);
    setRows((r.data as RosterRow[]) ?? []);
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);
  if (!sb || dpa === undefined) return null;

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true); setNote(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setNote({ ok: false, text: friendly(error) }); else { setNote({ ok: true, text: ok }); await load(); }
  };
  const invite = async (grades: number[]) => {
    setBusy(true); setNote(null);
    const { data: s } = await sb.auth.getSession();
    const res = await fetch("/api/school/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` }, body: JSON.stringify({ school: school.id, grades }) });
    const out = (await res.json().catch(() => null)) as { sent?: number; error?: string } | null;
    setBusy(false);
    setNote(res.ok ? { ok: true, text: `✓ Invited ${out?.sent ?? 0} famil${out?.sent === 1 ? "y" : "ies"}. Each family is invited at most once a week.` } : { ok: false, text: out?.error ?? "The invites couldn't be sent." });
    await load();
  };

  const connected = rows.filter((r) => r.connected).length;
  const canInvite = rows.filter((r) => !r.connected && r.email && (!r.invited_at || Date.now() - new Date(r.invited_at).getTime() > 7 * 86400000)).length;
  const shown = filter === "not" ? rows.filter((r) => !r.connected) : rows;

  return (
    <div className="panel">
      <h2>Class roster (optional)</h2>
      <p className="hint">Upload your class list to see who has connected and email your school code to families who haven&apos;t. Only names, grade, school ID and an email are uploaded. No grades. Families still choose what to share.</p>
      {note && <p className={`note ${note.ok ? "note-ok" : "note-err"}`} role="status">{note.text}</p>}

      {!dpa ? (
        role === "admin" ? (
          <form onSubmit={(e) => { e.preventDefault(); void run(() => sb.rpc("sign_school_data_agreement", { p_school: school.id, p_name: form.name, p_title: form.title, p_district: form.district }), "Agreement signed. You can upload a roster now."); }}>
            <h3>Student data agreement</h3>
            <ul className="gaps">
              <li>ScholarTasks uses roster data only to show your staff who has connected and to send your school&apos;s invite. It is never sold, shared or used for ads.</li>
              <li>Only your school&apos;s staff can see the roster. Every upload, view and invite is logged.</li>
              <li>You can delete the roster any time. If this agreement ends, the roster is deleted within 45 days.</li>
              <li>Families decide what they share with your school. The roster does not give access to any student&apos;s account.</li>
              <li>Data is stored in the United States and protected as described in our <a href="/privacy" target="_blank">privacy policy</a>, in line with Georgia&apos;s Student Data Privacy law (O.C.G.A. 20-2-660 to 668) and FERPA.</li>
            </ul>
            <p className="hint small">Your district may require its own data agreement. <a href="/contact">Contact us</a> and we will sign it.</p>
            <div className="row">
              <div className="field"><label htmlFor="dpa-name">Your full name</label><input id="dpa-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="dpa-title">Job title</label><input id="dpa-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="field"><label htmlFor="dpa-district">School district</label><input id="dpa-district" className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
            </div>
            <label className="toggle"><input type="checkbox" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} /> I am allowed to agree to this for {school.name}, and I agree.</label>
            <button className="btn btn-inline" disabled={busy || !form.agree || form.name.trim().length < 2 || form.title.trim().length < 2}>Sign the agreement</button>
          </form>
        ) : <p className="hint">Your school admin signs the student data agreement and uploads the roster.</p>
      ) : (
        <>
          <p className="hint small">Agreement signed by {dpa.signer_name}, {dpa.signer_title}{dpa.district ? `, ${dpa.district}` : ""}, on {new Date(dpa.signed_at).toLocaleDateString("en-US")}.</p>
          {role === "admin" && (
            <div className="row" style={{ alignItems: "end" }}>
              <div className="field">
                <label htmlFor="roster-file">Upload a CSV from your student information system</label>
                <input id="roster-file" type="file" accept=".csv,text/csv" className="input" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPending(rosterFromCsv(await f.text())); e.target.value = ""; }} />
                <span className="hint small">Columns: Student ID, First name, Last name, Grade, and Email (a parent&apos;s or the student&apos;s, optional). Uploading replaces the old list.</span>
              </div>
            </div>
          )}
          {pending && (
            <div className="note note-info">
              <p style={{ margin: 0 }}>{pending.rows.length} students ready to upload.</p>
              {pending.problems.length > 0 && <ul className="gaps">{pending.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
              {pending.rows.length > 0 && <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void run(() => sb.rpc("upload_school_roster", { p_school: school.id, p_rows: pending.rows, p_replace: true }), `✓ Uploaded ${pending.rows.length} students.`).then(() => setPending(null))}>Upload {pending.rows.length} students</button>}{" "}
              <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setPending(null)}>Cancel</button>
            </div>
          )}
          {rows.length > 0 && (
            <>
              <p><b>{connected} of {rows.length}</b> students on the roster are connected.</p>
              <div className="row" style={{ alignItems: "center" }}>
                <button className="btn btn-inline btn-sm" disabled={busy || canInvite === 0} onClick={() => void invite([])}>Email the school code to {canInvite} famil{canInvite === 1 ? "y" : "ies"}</button>
                <select className="input" style={{ width: 200 }} aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "not")}>
                  <option value="not">Not connected yet</option><option value="all">Everyone</option>
                </select>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="record-table school-table">
                  <thead><tr><th>Name</th><th>Grade</th><th>ID</th><th>Email</th><th>Status</th></tr></thead>
                  <tbody>{shown.slice(0, 500).map((r) => (
                    <tr key={r.student_ref}><td>{r.last_name}, {r.first_name}</td><td>{r.grade_level}</td><td>{r.student_ref}</td><td>{r.email ?? "—"}</td>
                      <td>{r.connected ? <span className="pill pill-ok">Connected</span> : r.invited_at ? <span className="pill">Invited {new Date(r.invited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : <span className="pill pill-soon">Not yet</span>}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              {shown.length > 500 && <p className="hint small">Showing the first 500.</p>}
            </>
          )}
          {role === "admin" && (
            <p className="hint small" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-inline btn-sm" disabled={busy || rows.length === 0} onClick={() => void run(() => sb.rpc("delete_school_roster", { p_school: school.id }), "Roster deleted.")}>Delete the roster now</button>{" "}
              <button className="btn btn-ghost btn-inline btn-sm" disabled={busy} onClick={() => void run(() => sb.rpc("end_school_data_agreement", { p_school: school.id }), "Agreement ended. The roster will be deleted within 45 days.")}>End the agreement</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

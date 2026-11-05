"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { displayGpa, evaluateStatePrograms, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../../packs/states/GA.json";
import { friendly, supabase } from "../../lib/supabase";

const GA = gaPack as unknown as StatePack;

export interface School {
  id: string; name: string; city: string; state: string;
  status: "pending" | "approved" | "closed"; join_code: string; staff_code: string; ai_plan: string;
}

interface Row {
  link_id: string; student_id: string; first_name: string; grade_level: number; class_of: number;
  share: "progress" | "progress_grades"; linked_at: string;
  colleges: number; applying: number; submitted: number; accepted: number;
  fafsa_submitted: boolean; aid_steps_done: number; scholarships_saved: number;
  tasks_overdue: number; tasks_next_14: number; sat: number | null; act: number | null;
  last_active: string | null;
  grades: { term: string; course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number }[] | null;
}
interface Staff { user_id: string; role: "admin" | "counselor"; full_name: string; job_title: string | null }
interface Msg { id: string; subject: string; grades: number[]; recipients: number; sent_at: string }
interface LocalSch { id: string; name: string; amount_text: string; deadline: string | null; status: string; url: string }

type Filter = "all" | "no_fafsa" | "no_list" | "overdue" | "quiet";
const FILTERS: [Filter, string][] = [
  ["all", "Everyone"], ["no_fafsa", "Seniors without FAFSA"], ["no_list", "No college list"],
  ["overdue", "Overdue deadlines"], ["quiet", "Not active in 30 days"],
];

const daysAgo = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + "T12:00:00").getTime()) / 86400000) : null);

function hopeGpa(r: Row, state: string): number | null {
  if (!r.grades || state !== GA.state) return null;
  const grades: CourseGrade[] = r.grades.map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level }));
  const res = evaluateStatePrograms({ state: GA.state, gradeLevel: r.grade_level, grades, sat: r.sat ?? undefined, act: r.act ?? undefined }, GA);
  return res.find((p) => p.programId === "ga-hope")?.gpa ?? null;
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function Dashboard({ school, role, onChanged }: { school: School; role: "admin" | "counselor"; onChanged: () => void }) {
  const sb = supabase();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, setPending] = useState(0);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [local, setLocal] = useState<LocalSch[]>([]);
  const [grade, setGrade] = useState<number | 0>(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const [c, p, st, m, l] = await Promise.all([
      sb.rpc("school_caseload", { p_school: school.id }),
      sb.rpc("school_pending_count", { p_school: school.id }),
      sb.from("school_staff").select("user_id, role, full_name, job_title").eq("school_id", school.id).order("added_at"),
      sb.from("school_messages").select("id, subject, grades, recipients, sent_at").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(10),
      sb.rpc("school_scholarships", { p_school: school.id }),
    ]);
    if (c.error) setError(friendly(c.error));
    setRows((c.data as Row[]) ?? []);
    setPending((p.data as number) ?? 0);
    setStaff((st.data as Staff[]) ?? []);
    setMsgs((m.data as Msg[]) ?? []);
    setLocal((l.data as LocalSch[]) ?? []);
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => (rows ?? []).filter((r) => {
    if (grade && r.grade_level !== grade) return false;
    if (filter === "no_fafsa") return r.grade_level === 12 && !r.fafsa_submitted;
    if (filter === "no_list") return r.colleges === 0;
    if (filter === "overdue") return r.tasks_overdue > 0;
    if (filter === "quiet") { const d = daysAgo(r.last_active); return d === null || d > 30; }
    return true;
  }), [rows, grade, filter]);

  const all = rows ?? [];
  const seniors = all.filter((r) => r.grade_level === 12);
  const stats = [
    { n: all.length, label: "students connected" },
    { n: seniors.filter((r) => r.fafsa_submitted).length + " of " + seniors.length, label: "seniors filed the FAFSA" },
    { n: all.filter((r) => r.grade_level >= 11 && r.colleges === 0).length, label: "juniors and seniors with no college list" },
    { n: all.filter((r) => r.tasks_overdue > 0).length, label: "students with overdue deadlines" },
  ];

  const exportCsv = () => {
    const head = ["First name", "Grade", "Class of", "Colleges on list", "Applications sent", "Accepted", "FAFSA filed", "Aid steps done",
      "Scholarships saved", "Overdue deadlines", "Due in 14 days", "SAT", "ACT", "HOPE GPA (if shared)", "Last active"];
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
    <>
      {error && <p className="note note-err" role="alert">{error}</p>}
      <p className="hint">{school.city}, {school.state} · You're {role === "admin" ? "the school admin" : "a counselor"} here</p>

      <ShareCode school={school} role={role} onChanged={onChanged} />

      <ul className="badge-row" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", margin: "16px 0" }}>
        {stats.map((s) => <li key={s.label}><span style={{ fontSize: 24, fontWeight: 700 }}>{s.n}</span><span className="hint" style={{ fontSize: 13 }}>{s.label}</span></li>)}
      </ul>
      {pending > 0 && <p className="note note-info">{pending} {pending === 1 ? "student has" : "students have"} asked to connect and {pending === 1 ? "is" : "are"} waiting for a parent to approve.</p>}

      <div className="panel">
        <h2>Your students</h2>
        <p className="hint">Only students whose families connected to your school appear here, with what they chose to share.</p>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="field" style={{ flex: "0 1 160px" }}>
            <label htmlFor="f-grade">Grade</label>
            <select id="f-grade" className="input" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              <option value={0}>All grades</option>
              {[8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <button className="btn btn-ghost btn-inline" disabled={!list.length} onClick={exportCsv}>Download CSV</button>
        </div>
        <div className="chips" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? "chip-on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        {rows === null ? <p className="hint">Loading…</p> : list.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>{all.length === 0 ? "No students yet. Share your school code with families to get started." : "No students match."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="record-table school-table">
              <thead>
                <tr><th>Student</th><th>Grade</th><th>Colleges</th><th>FAFSA</th><th>Scholarships</th><th>Deadlines</th><th>Tests</th><th>HOPE GPA</th><th>Last active</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const g = hopeGpa(r, school.state);
                  const d = daysAgo(r.last_active);
                  return (
                    <tr key={r.link_id}>
                      <td>{r.first_name}</td>
                      <td>{r.grade_level}</td>
                      <td>{r.colleges === 0 ? <span className="pill pill-soon">None yet</span> : `${r.submitted} of ${r.colleges} sent${r.accepted ? `, ${r.accepted} in` : ""}`}</td>
                      <td>{r.grade_level < 12 ? "—" : r.fafsa_submitted ? <span className="pill pill-ok">Filed</span> : <span className="pill pill-late">Not yet</span>}</td>
                      <td>{r.scholarships_saved}</td>
                      <td>{r.tasks_overdue ? <span className="pill pill-late">{r.tasks_overdue} overdue</span> : null} {r.tasks_next_14 ? `${r.tasks_next_14} soon` : r.tasks_overdue ? "" : "—"}</td>
                      <td>{[r.sat ? `SAT ${r.sat}` : "", r.act ? `ACT ${r.act}` : ""].filter(Boolean).join(", ") || "—"}</td>
                      <td>{r.share === "progress" ? <span className="hint" style={{ fontSize: 12 }}>Not shared</span> : g === null ? "—" : displayGpa(g)}</td>
                      <td>{d === null ? "Never" : d === 0 ? "Today" : `${d}d ago`}</td>
                      <td>
                        <button className="btn btn-ghost btn-inline" style={{ padding: "4px 10px", fontSize: 13 }}
                          onClick={async () => {
                            if (!sb || !window.confirm(`Stop following ${r.first_name}? The family can connect again with your code.`)) return;
                            const { error: e } = await sb.rpc("end_school_link", { p_link: r.link_id });
                            if (e) setError(friendly(e)); else void load();
                          }}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SendMessage schoolId={school.id} sent={msgs} onSent={load} />
      <LocalScholarships schoolId={school.id} list={local} onPosted={load} />
      <StaffList school={school} role={role} staff={staff} onChanged={load} />
    </>
  );
}

function ShareCode({ school, role, onChanged }: { school: School; role: "admin" | "counselor"; onChanged: () => void }) {
  const sb = supabase();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const familyLink = `${origin}/my-school?code=${school.join_code}`;
  const staffLink = `${origin}/school?staff=${school.staff_code}`;
  const familyText = `${school.name} uses ScholarTasks to help with college, scholarships and the FAFSA. It's free for families. Sign in, then connect to our school here: ${familyLink} (school code ${school.join_code}). You choose what the school can see.`;
  const copy = async (k: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(null), 2500); } catch {} };
  return (
    <div className="panel">
      <h2>Invite families</h2>
      <p className="hint">Put this in a newsletter, an email to a grade, or on a slide at FAFSA night.</p>
      <div className="code-box">
        <div>School code for families:</div>
        <div className="code">{school.join_code}</div>
        <p className="hint" style={{ margin: "6px 0 0", fontSize: 13 }}>{familyLink}</p>
        <div className="share-row" style={{ marginTop: 10 }}>
          <a className="btn btn-inline share-btn" href={`mailto:?subject=${encodeURIComponent(`Connect to ${school.name} on ScholarTasks`)}&body=${encodeURIComponent(familyText)}`}>✉️ Email it</a>
          <button className="btn btn-ghost btn-inline" onClick={() => void copy("fam", familyText)}>{copied === "fam" ? "✓ Copied" : "Copy message"}</button>
          {role === "admin" && (
            <button className="btn btn-ghost btn-inline" onClick={async () => {
              if (!sb || !window.confirm("Make a new family code? The old code stops working for new connections. Families already connected stay connected.")) return;
              await sb.rpc("new_school_codes", { p_school: school.id, p_which: "join" }); onChanged();
            }}>New code</button>
          )}
        </div>
      </div>
      {role === "admin" && (
        <details className="perm">
          <summary>Add counselors (staff code)</summary>
          <p style={{ margin: "8px 0" }}>Staff code: <strong style={{ letterSpacing: 2 }}>{school.staff_code}</strong></p>
          <p className="hint" style={{ fontSize: 13 }}>Send this only to staff. Anyone with it can see your connected students. Make a new one if it gets out.</p>
          <div className="share-row">
            <button className="btn btn-ghost btn-inline" onClick={() => void copy("staff", `Join ${school.name} on the ScholarTasks school portal: ${staffLink}`)}>{copied === "staff" ? "✓ Copied" : "Copy staff link"}</button>
            <button className="btn btn-ghost btn-inline" onClick={async () => {
              if (!sb || !window.confirm("Make a new staff code? The old one stops working.")) return;
              await sb.rpc("new_school_codes", { p_school: school.id, p_which: "staff" }); onChanged();
            }}>New staff code</button>
          </div>
        </details>
      )}
    </div>
  );
}

function SendMessage({ schoolId, sent, onSent }: { schoolId: string; sent: Msg[]; onSent: () => void }) {
  const sb = supabase();
  const [grades, setGrades] = useState<number[]>([12]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (g: number) => setGrades((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g].sort()));
  return (
    <div className="panel">
      <h2>Send a reminder</h2>
      <p className="hint">Emails connected students and their parents. Replies come back to your email.</p>
      <div className="chips" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
        {[8, 9, 10, 11, 12].map((g) => <button key={g} className={`chip ${grades.includes(g) ? "chip-on" : ""}`} aria-pressed={grades.includes(g)} onClick={() => toggle(g)}>Grade {g}</button>)}
      </div>
      <div className="field"><label htmlFor="m-sub">Subject</label><input id="m-sub" className="input" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. FAFSA night is Tuesday at 6pm" /></div>
      <div className="field"><label htmlFor="m-body">Message</label><textarea id="m-body" className="input" rows={5} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <button
        className="btn btn-inline"
        disabled={busy || !grades.length || subject.trim().length < 2 || body.trim().length < 2}
        onClick={async () => {
          if (!sb) return;
          setBusy(true); setNote(null);
          try {
            const { data } = await sb.auth.getSession();
            const res = await fetch("/api/school/message", {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
              body: JSON.stringify({ school: schoolId, grades, subject, body }),
            });
            const j = (await res.json().catch(() => ({}))) as { error?: string; sent?: number };
            if (!res.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
            setNote({ ok: true, text: j.sent ? `Sent to ${j.sent} ${j.sent === 1 ? "person" : "people"}.` : "Saved, but no connected families in those grades have an email yet." });
            setSubject(""); setBody(""); onSent();
          } catch (e) {
            setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
          }
          setBusy(false);
        }}
      >
        {busy ? "Sending…" : "Send"}
      </button>
      {note && <p className={`note ${note.ok ? "note-ok" : "note-err"}`} role="status">{note.text}</p>}
      {sent.length > 0 && (
        <details className="perm">
          <summary>Sent before ({sent.length})</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {sent.map((m) => <li key={m.id}>{new Date(m.sent_at).toLocaleDateString()}: {m.subject} · grade {m.grades.join(", ") || "all"} · {m.recipients} people</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function LocalScholarships({ schoolId, list, onPosted }: { schoolId: string; list: LocalSch[]; onPosted: () => void }) {
  const sb = supabase();
  const [f, setF] = useState({ name: "", url: "", summary: "", amount_text: "", amount_max: "", deadline: "", how: "" });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ready = f.name.trim().length >= 2 && /^https:\/\//i.test(f.url.trim()) && f.summary.trim().length >= 10 && f.amount_text.trim().length >= 2;
  return (
    <div className="panel">
      <h2>Local scholarships</h2>
      <p className="hint">Awards from local clubs, businesses and your school. Only your connected families see them. Our team checks each one, and it shows as "Not yet verified" until then.</p>
      <div className="row">
        <div className="field"><label htmlFor="l-name">Scholarship name</label><input id="l-name" className="input" value={f.name} onChange={set("name")} /></div>
        <div className="field"><label htmlFor="l-amt">Amount (as families should see it)</label><input id="l-amt" className="input" value={f.amount_text} onChange={set("amount_text")} placeholder="e.g. $1,000" /></div>
        <div className="field" style={{ flex: "0 1 170px" }}><label htmlFor="l-due">Deadline</label><input id="l-due" type="date" className="input" value={f.deadline} onChange={set("deadline")} /></div>
      </div>
      <div className="field" style={{ marginTop: 12 }}><label htmlFor="l-url">Link to the application or details (https://)</label><input id="l-url" className="input" value={f.url} onChange={set("url")} placeholder="https://" /></div>
      <div className="field"><label htmlFor="l-sum">Who it's for</label><textarea id="l-sum" className="input" rows={3} maxLength={1500} value={f.summary} onChange={set("summary")} /></div>
      <div className="field"><label htmlFor="l-how">How to apply (optional)</label><textarea id="l-how" className="input" rows={2} maxLength={1500} value={f.how} onChange={set("how")} /></div>
      <button className="btn btn-inline" disabled={!ready} onClick={async () => {
        if (!sb) return;
        setErr(null); setOk(false);
        const amt = Number(f.amount_max || (f.amount_text.match(/\d[\d,]*/)?.[0] ?? "").replace(/,/g, ""));
        const { error } = await sb.rpc("school_post_scholarship", {
          p_school: schoolId, p_name: f.name, p_url: f.url.trim(), p_summary: f.summary, p_amount_text: f.amount_text,
          p_amount_max: Number.isFinite(amt) && amt > 0 ? Math.min(amt, 1000000) : null, p_deadline: f.deadline || null,
          p_how_to_apply: f.how || null, p_grades: [12],
        });
        if (error) setErr(/unique|duplicate/i.test(error.message) ? "That scholarship is already posted." : friendly(error));
        else { setOk(true); setF({ name: "", url: "", summary: "", amount_text: "", amount_max: "", deadline: "", how: "" }); onPosted(); }
      }}>Post scholarship</button>
      {ok && <p className="note note-ok" role="status">Posted. Your families can see it now.</p>}
      {err && <p className="note note-err" role="alert">{err}</p>}
      {list.length > 0 && (
        <ul style={{ margin: "14px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          {list.map((s) => (
            <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> · {s.amount_text}{s.deadline ? ` · due ${new Date(s.deadline + "T12:00:00").toLocaleDateString()}` : ""}{" "}
              <span className={`pill ${s.status === "approved" ? "pill-ok" : s.status === "pending" ? "pill-soon" : ""}`}>{s.status === "approved" ? "Verified" : s.status === "pending" ? "Being checked" : "Retired"}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaffList({ school, role, staff, onChanged }: { school: School; role: "admin" | "counselor"; staff: Staff[]; onChanged: () => void }) {
  const sb = supabase();
  const [me, setMe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void sb?.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null)); }, [sb]);
  const act = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setErr(null);
    const { error } = await fn();
    if (error) setErr(friendly(error)); else onChanged();
  };
  return (
    <div className="panel">
      <h2>Counselors at {school.name}</h2>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {staff.map((s) => (
          <li key={s.user_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ flex: 1 }}>{s.full_name}{s.job_title ? `, ${s.job_title}` : ""} {s.role === "admin" && <span className="pill">Admin</span>}{s.user_id === me && <span className="pill">You</span>}</span>
            {role === "admin" && s.user_id !== me && (
              <>
                <button className="btn btn-ghost btn-inline" style={{ padding: "4px 10px", fontSize: 13 }}
                  onClick={() => act(() => sb!.rpc("set_school_staff_role", { p_school: school.id, p_user: s.user_id, p_role: s.role === "admin" ? "counselor" : "admin" }))}>
                  {s.role === "admin" ? "Make counselor" : "Make admin"}
                </button>
                <button className="btn btn-ghost btn-inline" style={{ padding: "4px 10px", fontSize: 13, color: "#b42318" }}
                  onClick={() => window.confirm(`Remove ${s.full_name} from ${school.name}?`) && act(() => sb!.rpc("remove_school_staff", { p_school: school.id, p_user: s.user_id }))}>
                  Remove
                </button>
              </>
            )}
            {s.user_id === me && (
              <button className="btn btn-ghost btn-inline" style={{ padding: "4px 10px", fontSize: 13 }}
                onClick={() => window.confirm(`Leave ${school.name}? You'll stop seeing its students.`) && act(() => sb!.rpc("remove_school_staff", { p_school: school.id, p_user: s.user_id }))}>
                Leave school
              </button>
            )}
          </li>
        ))}
      </ul>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </div>
  );
}

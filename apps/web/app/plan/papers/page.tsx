"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { pickStudent, useCurrentStudent } from "../../../lib/current-student";

type What = "transcript" | "counselor_letter" | "teacher_letter" | "test_scores" | "mid_year" | "final_transcript";
type How = "common_app" | "gafutures" | "parchment" | "college_portal" | "email" | "mail" | "testing_agency" | "other";
type Status = "to_ask" | "asked" | "sent" | "received";

interface Student { id: string; first_name: string }
interface College { id: string; student_id: string; name: string; plan: string; deadline: string | null; status: string }
interface Req {
  id: string; student_id: string; college_id: string; what: What; person: string | null; how: How;
  needed_by: string | null; status: Status; asked_on: string | null; sent_on: string | null;
  notes: string | null; school_id: string | null; school_note: string | null;
}
interface Link { student_id: string; school_name: string; status: string }

const WHAT: Record<What, string> = {
  transcript: "Transcript",
  counselor_letter: "Counselor letter and school report",
  teacher_letter: "Teacher letter",
  test_scores: "SAT or ACT scores",
  mid_year: "Mid-year report",
  final_transcript: "Final transcript",
};
const WHO: Record<What, string> = {
  transcript: "The school counselor or records office sends it.",
  counselor_letter: "Your counselor writes it. Ask early and give them your brag sheet.",
  teacher_letter: "Ask the teacher in person 3 to 4 weeks ahead, then add them in Common App so they get the link.",
  test_scores: "You send these from your College Board or ACT account. Some colleges take self-reported scores.",
  mid_year: "Your counselor sends first-semester grades in January or February.",
  final_transcript: "Your school sends it after graduation to the one college you pick.",
};
const HOW: Record<How, string> = {
  common_app: "Common App",
  gafutures: "GAfutures",
  parchment: "Parchment",
  college_portal: "College's own portal",
  email: "Email",
  mail: "Mail",
  testing_agency: "College Board or ACT",
  other: "Other",
};
const STATUS: Record<Status, string> = { to_ask: "To ask", asked: "Asked", sent: "Sent", received: "College has it" };
const ORDER: Status[] = ["to_ask", "asked", "sent", "received"];
const USUAL: What[] = ["transcript", "counselor_letter", "teacher_letter", "test_scores"];

const DAY = 86_400_000;
const today = () => new Date(new Date().toDateString());
const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
/** Ask the school at least two weeks before the college needs it. */
function askBy(r: Req, c: College): Date | null {
  const due = r.needed_by ?? c.deadline;
  return due ? new Date(new Date(due + "T00:00:00").getTime() - 14 * DAY) : null;
}

/** What each college needs from the school, who has been asked, and what has been sent. */
export default function TranscriptsAndLetters() {
  const sb = supabase();
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [isParent, setIsParent] = useState(false);
  const [colleges, setColleges] = useState<College[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/plan/papers");
    const [mem, st, col, rq, ln] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name").order("first_name"),
      sb.from("student_colleges").select("id, student_id, name, plan, deadline, status").order("deadline", { nullsFirst: false }),
      sb.from("transcript_requests").select("*").order("created_at"),
      sb.rpc("my_school_links"),
    ]);
    if (rq.error) return setState("offline");
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    setIsParent(m.some((r) => r.role === "parent"));
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (own ?? pickStudent(list, list[0]?.id)));
    setColleges((col.data as College[]) ?? []);
    setReqs((rq.data as Req[]) ?? []);
    setLinks(((ln.data as Link[]) ?? []).filter((l) => l.status === "active"));
    setState("ready");
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const title = "Transcripts and letters";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (state === "loading") return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (state === "offline") return <Page title={title}><div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>This page is switching on. Check back shortly.</p></div></Page>;
  const student = students.find((s) => s.id === current);
  if (!student) return <Page title={title}><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const school = links.find((l) => l.student_id === student.id) ?? null;
  const mine = colleges.filter((c) => c.student_id === student.id && !["withdrawn", "denied"].includes(c.status));
  const myReqs = reqs.filter((r) => r.student_id === student.id);
  const now = today();
  const late = myReqs.filter((r) => {
    const c = mine.find((x) => x.id === r.college_id);
    const by = c && askBy(r, c);
    return r.status === "to_ask" && by && by <= now;
  });
  const waiting = myReqs.filter((r) => r.status === "asked").length;
  const sent = myReqs.filter((r) => r.status === "sent" || r.status === "received").length;

  const add = async (c: College, what: What[]) => {
    setMsg(null);
    const rows = what.map((w) => ({ student_id: student.id, college_id: c.id, what: w, how: (w === "test_scores" ? "testing_agency" : "common_app") as How }));
    const { error } = await sb.from("transcript_requests").insert(rows);
    if (error) return setMsg(friendly(error));
    await load();
  };

  return (
    <Page title={isParent ? `${student.first_name}'s transcripts and letters` : "My transcripts and letters"}>
      <p className="hint"><a href="/plan">← College list</a> · <a href="/activities/common-app">Common App ready</a> · <a href="/my-school">My school</a></p>
      <div className="panel">
        <p style={{ marginTop: 0 }}>You send your own application on Common App or the college&apos;s site. Your <b>school</b> sends the transcript and counselor letter, and <b>teachers</b> send their letters. Use this page to ask on time and see what has gone out.</p>
        <p className="hint" style={{ margin: 0 }}>
          {school
            ? <>Connected to <b>{school.school_name}</b>. Tap <b>Ask my counselor</b> on a line and it shows up in your counselor&apos;s ScholarTasks list. They mark it sent and you see it here.</>
            : <>Ask your counselor in person or by email, then tick <b>Asked</b>. If your school uses ScholarTasks, <a href="/my-school">connect to it</a> and you can ask right here.</>}
        </p>
      </div>

      {myReqs.length > 0 && (
        <div className="row" style={{ gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
          <span className={`pill ${late.length ? "pill-late" : "pill-ok"}`}>{late.length} to ask now</span>
          <span className="pill pill-soon">{waiting} asked, waiting</span>
          <span className="pill pill-ok">{sent} sent</span>
        </div>
      )}
      {msg && <p className="note note-err" role="alert">{msg}</p>}

      {mine.length === 0 && (
        <div className="panel"><p className="hint" style={{ margin: 0 }}>Add colleges on the <a href="/plan">College list</a> first. Each one gets its own list here.</p></div>
      )}

      {mine.map((c) => {
        const rs = myReqs.filter((r) => r.college_id === c.id);
        return (
          <div key={c.id} className="panel" style={{ marginTop: 12 }}>
            <h2 style={{ marginBottom: 2 }}>{c.name}</h2>
            <p className="hint" style={{ marginTop: 0 }}>{c.plan}{c.deadline ? ` · application due ${fmt(c.deadline)}` : " · add the deadline on the College list"}</p>
            {rs.length === 0 && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-inline btn-sm" onClick={() => void add(c, USUAL)}>Add the usual four</button>
                <span className="hint small">Transcript, counselor letter, one teacher letter and test scores. Check the college&apos;s site; some want more, some less.</span>
              </div>
            )}
            {rs.map((r) => <Line key={r.id} r={r} c={c} school={school} onChanged={load} />)}
            {rs.length > 0 && <AddOne have={rs} onAdd={(w) => void add(c, [w])} />}
          </div>
        );
      })}

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Good to know</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Ask your counselor at least <b>two weeks</b> before a deadline, and teachers <b>three to four weeks</b> before.</li>
          <li>Georgia public colleges often get transcripts through <a href="https://www.gafutures.org" target="_blank" rel="noopener">GAfutures</a>. Many other schools use <a href="https://www.parchment.com" target="_blank" rel="noopener">Parchment</a> or Common App.</li>
          <li>Send SAT scores from <a href="https://mysat.collegeboard.org" target="_blank" rel="noopener">College Board</a> and ACT scores from <a href="https://my.act.org" target="_blank" rel="noopener">MyACT</a>. Check if the college takes self-reported scores first; it can save the fee.</li>
          <li>Give teachers and your counselor your <a href="/activities">activities and resume</a> so their letters say more.</li>
          <li>After you apply, check each college&apos;s portal to see that every paper arrived, then tick <b>College has it</b>.</li>
        </ul>
      </div>
    </Page>
  );
}

function AddOne({ have, onAdd }: { have: Req[]; onAdd: (w: What) => void }) {
  const [w, setW] = useState<What>("teacher_letter");
  const key = have[0]?.college_id ?? "new";
  return (
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
      <label className="hint small" htmlFor={`add-${key}`}>Add another:</label>
      <select id={`add-${key}`} className="input" style={{ maxWidth: 260 }} value={w} onChange={(e) => setW(e.target.value as What)}>
        {(Object.keys(WHAT) as What[]).map((k) => <option key={k} value={k}>{WHAT[k]}</option>)}
      </select>
      <button className="btn btn-ghost btn-inline btn-sm" onClick={() => onAdd(w)}>Add</button>
    </div>
  );
}

function Line({ r, c, school, onChanged }: { r: Req; c: College; school: Link | null; onChanged: () => Promise<void> }) {
  const sb = supabase()!;
  const [person, setPerson] = useState(r.person ?? "");
  const [err, setErr] = useState<string | null>(null);
  const save = async (patch: Partial<Req>) => {
    setErr(null);
    const { error } = await sb.from("transcript_requests").update(patch).eq("id", r.id);
    if (error) return setErr(friendly(error));
    await onChanged();
  };
  const rpc = async (fn: "ask_school_for_paper" | "cancel_school_paper") => {
    setErr(null);
    const { error } = await sb.rpc(fn, { p_id: r.id });
    if (error) return setErr(friendly(error));
    await onChanged();
  };
  const remove = async () => {
    const { error } = await sb.from("transcript_requests").delete().eq("id", r.id);
    if (error) return setErr(friendly(error));
    await onChanged();
  };
  const by = askBy(r, c);
  const late = r.status === "to_ask" && by && by <= today();
  const inPortal = !!r.school_id;
  const canAskSchool = !!school && !inPortal && r.what !== "test_scores" && r.what !== "teacher_letter" && (r.status === "to_ask" || r.status === "asked");
  return (
    <div style={{ borderTop: "1px solid var(--line, #e5e5e5)", padding: "10px 0" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b>{WHAT[r.what]}</b>{r.person ? ` · ${r.person}` : ""}{" "}
          <span className={`pill ${r.status === "received" || r.status === "sent" ? "pill-ok" : late ? "pill-late" : "pill-soon"}`}>{late ? "Ask now" : STATUS[r.status]}</span>
          <div className="hint small">{WHO[r.what]}</div>
          {by && r.status === "to_ask" && <div className="hint small">Ask by {by.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>}
          {r.asked_on && <div className="hint small">Asked {fmt(r.asked_on)}{r.sent_on ? ` · sent ${fmt(r.sent_on)}` : ""}</div>}
          {inPortal && <div className="hint small">In your counselor&apos;s ScholarTasks list.</div>}
          {r.school_note && <p className="note" style={{ margin: "4px 0 0" }}>School: {r.school_note}</p>}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Where it stands">
          {ORDER.map((s) => (
            <button key={s} className={`btn btn-inline btn-sm ${r.status === s ? "" : "btn-ghost"}`} aria-pressed={r.status === s}
              disabled={inPortal && s === "to_ask"} onClick={() => void save({ status: s })}>{STATUS[s]}</button>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "end" }}>
        {r.what === "teacher_letter" && (
          <div className="field" style={{ flex: "1 1 160px", margin: 0 }}>
            <label htmlFor={`p-${r.id}`} className="small">Teacher</label>
            <input id={`p-${r.id}`} className="input" maxLength={120} placeholder="Ms. Diaz" value={person}
              onChange={(e) => setPerson(e.target.value)} onBlur={() => { if (person.trim() !== (r.person ?? "")) void save({ person: person.trim() || null }); }} />
          </div>
        )}
        <div className="field" style={{ flex: "1 1 160px", margin: 0 }}>
          <label htmlFor={`h-${r.id}`} className="small">Sent through</label>
          <select id={`h-${r.id}`} className="input" value={r.how} onChange={(e) => void save({ how: e.target.value as How })}>
            {(Object.keys(HOW) as How[]).map((k) => <option key={k} value={k}>{HOW[k]}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 140px", margin: 0 }}>
          <label htmlFor={`d-${r.id}`} className="small">Needed by</label>
          <input id={`d-${r.id}`} type="date" className="input" value={r.needed_by ?? c.deadline ?? ""}
            onChange={(e) => void save({ needed_by: e.target.value || null })} />
        </div>
        {canAskSchool && <button className="btn btn-inline btn-sm" onClick={() => void rpc("ask_school_for_paper")}>Ask my counselor</button>}
        {inPortal && r.status === "asked" && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void rpc("cancel_school_paper")}>Take back</button>}
        {!inPortal && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void remove()} aria-label={`Remove ${WHAT[r.what]}`}>Remove</button>}
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </div>
  );
}

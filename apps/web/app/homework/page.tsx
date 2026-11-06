"use client";

import { NO_SUGGEST, VoiceButton } from "../voice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { ReportAi } from "../report-ai";
import { Formatted } from "../formatted";
import { AttachButtons, AttachPreview } from "../attach-buttons";
import type { Attachment } from "../../lib/attach";
import { printPage } from "../../lib/print";
import { HELP_LABEL, START_KINDS, SUBJECTS, subjectById, type HelpType, type StartKind } from "../../lib/homework";

interface Student { id: string; first_name: string; grade_level: number; permissions: Record<string, boolean> }
interface Msg { role: "user" | "assistant"; content: string; help?: HelpType; hints?: number; photo?: boolean | "pdf" }
interface LogRow { created_at: string; subject: string; topic: string | null; help_type: HelpType; hints: number; solved: boolean; said_no: string | null; safety: boolean; note: string | null }
interface Saved { subject: string; msgs: Msg[]; hints: number; solved: boolean; pid?: string }
interface Recent extends Saved { pid: string; title: string; at: number }

const storeKey = (id: string | null) => `st-homework-${id}`;
// Recent problems stay on this device only (never on our servers), so a student can pick up where they left off.
const recentKey = (id: string | null) => `st-homework-recent-${id}`;
const MAX_RECENT = 10;
function readRecent(id: string | null): Recent[] {
  try { return (JSON.parse(localStorage.getItem(recentKey(id)) ?? "[]") as Recent[]).filter((r) => r && r.pid && Array.isArray(r.msgs)); } catch { return []; }
}
function writeRecent(id: string | null, list: Recent[]) {
  try { localStorage.setItem(recentKey(id), JSON.stringify(list.slice(0, MAX_RECENT))); } catch { /* storage full or private mode */ }
}
/** A short name for a problem: what the student typed, or what the helper read from their photo. */
function problemTitle(msgs: Msg[]): string {
  const first = msgs.find((m) => m.role === "user")?.content ?? "";
  const typed = /The problem: ([\s\S]*?)(?:\n\n|$)/.exec(first)?.[1];
  const photo = /\[Photo of the problem: ([\s\S]*?)\]$/.exec(first)?.[1];
  const file = /\[From my file ([^\]]*)\]/.exec(first)?.[1];
  const t = (typed || photo || (file ? `File: ${file}` : "") || first.split("\n").find((l) => l.trim()) || "Problem").replace(/\s+/g, " ").trim();
  return t.length > 80 ? t.slice(0, 77) + "…" : t;
}
const cleanUser = (m: Msg) => m.content.replace(/\n\n\[Photo of the problem: ([\s\S]*)\]$/, "\n\n(From my photo: $1)").replace(/\n\n\[From my file ([^\]]*)\][\s\S]*$/, "\n\n(From my file $1)");
const SAID_NO: Record<string, string> = { answer: "Asked for an answer", writing: "Asked the helper to write for them", test: "Asked for help on a test or quiz", other: "Asked for something the helper doesn't do" };

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** What the parent sees: subjects, thinking score, said-no list and safety flags. Never the chat itself. */
function ParentPanel({ student, enabled, onToggle }: { student: Student; enabled: boolean; onToggle: (on: boolean) => void }) {
  const sb = supabase();
  const [rows, setRows] = useState<LogRow[] | null>(null);
  useEffect(() => {
    if (!sb) return;
    const since = new Date(Date.now() - 35 * 86400000).toISOString();
    void sb.from("homework_log").select("created_at, subject, topic, help_type, hints, solved, said_no, safety, note")
      .eq("student_id", student.id).gte("created_at", since).order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => setRows((data as LogRow[]) ?? []));
  }, [sb, student.id]);

  const weeks = useMemo(() => {
    const now = startOfWeek(new Date());
    return [0, 1, 2, 3].map((w) => {
      const from = new Date(now); from.setDate(from.getDate() - 7 * w);
      const to = new Date(from); to.setDate(to.getDate() + 7);
      const inWeek = (rows ?? []).filter((r) => { const t = new Date(r.created_at); return t >= from && t < to; });
      const solved = inWeek.filter((r) => r.solved);
      return {
        label: w === 0 ? "This week" : w === 1 ? "Last week" : from.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        replies: inWeek.length,
        b: [solved.filter((r) => r.hints === 0).length, solved.filter((r) => r.hints === 1).length, solved.filter((r) => r.hints === 2).length, solved.filter((r) => r.hints >= 3).length],
      };
    });
  }, [rows]);
  const thisWeek = useMemo(() => {
    const from = startOfWeek(new Date());
    const map = new Map<string, Set<string>>();
    for (const r of rows ?? []) {
      if (new Date(r.created_at) < from) continue;
      const set = map.get(r.subject) ?? new Set<string>();
      if (r.topic) set.add(r.topic);
      map.set(r.subject, set);
    }
    return [...map.entries()];
  }, [rows]);
  const saidNo = (rows ?? []).filter((r) => r.said_no);
  const flags = (rows ?? []).filter((r) => r.safety);

  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <h2 style={{ marginTop: 0 }}>What {student.first_name} worked on</h2>
      <p className="hint" style={{ marginTop: -6 }}>You see subjects, topics, hints and every time the helper said no. Chats themselves are never saved.</p>
      <label className="hw-switch">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span>Homework Helper is <b>{enabled ? "on" : "off"}</b> for {student.first_name}</span>
      </label>
      {rows === null ? <p className="hint">Loading…</p> : rows.length === 0 ? (
        <p className="hint">Nothing yet. When {student.first_name} uses the helper, a short summary shows up here.</p>
      ) : (
        <>
          {flags.length > 0 && (
            <div className="note note-err" role="alert">
              <b>Please check in with {student.first_name}.</b> On {flags.map((f) => new Date(f.created_at).toLocaleDateString()).join(", ")} the helper suggested talking to a trusted adult. If it's urgent, call or text 988.
            </div>
          )}
          <h3>This week</h3>
          {thisWeek.length === 0 ? <p className="hint">No homework help yet this week.</p> : (
            <ul className="plan-list">{thisWeek.map(([s, topics]) => <li key={s}><b>{s}</b>{topics.size ? `: ${[...topics].slice(0, 6).join(", ")}` : ""}</li>)}</ul>
          )}
          <h3>Thinking score</h3>
          <p className="hint" style={{ marginTop: -6 }}>Problems {student.first_name} finished, by how many hints it took. More in the first columns means more independent thinking.</p>
          <div className="hw-scroll">
            <table className="record-table">
              <thead><tr><th>Week</th><th>No hints</th><th>1 hint</th><th>2 hints</th><th>3 or more</th><th>Helper replies</th></tr></thead>
              <tbody>{weeks.map((w) => <tr key={w.label}><td>{w.label}</td>{w.b.map((n, i) => <td key={i}>{n}</td>)}<td>{w.replies}</td></tr>)}</tbody>
            </table>
          </div>
          <h3>When the helper said no</h3>
          {saidNo.length === 0 ? <p className="hint">None in the last five weeks.</p> : (
            <ul className="plan-list">
              {saidNo.slice(0, 20).map((r, i) => (
                <li key={i}>{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, {r.subject}: {SAID_NO[r.said_no!] ?? SAID_NO.other}. {r.note ?? ""}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default function HomeworkPage() {
  const sb = supabase();
  const [role, setRole] = useState<"parent" | "student" | null | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useCurrentStudent();
  const [subject, setSubject] = useState("math");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hints, setHints] = useState(0);
  const [solved, setSolved] = useState(false);
  const [problem, setProblem] = useState("");
  const [tried, setTried] = useState("");
  const [att, setAtt] = useState<Attachment | null>(null);
  const [chatAtt, setChatAtt] = useState<Attachment | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/homework");
    const [mem, st, hs] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, grade_level, permissions").order("first_name"),
      sb.from("homework_settings").select("student_id, enabled"),
    ]);
    const m = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = m.find((r) => r.role === "student");
    setRole(m.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null);
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setEnabled(Object.fromEntries(((hs.data as { student_id: string; enabled: boolean }[]) ?? []).map((r) => [r.student_id, r.enabled])));
    setCurrent((c) => c ?? asStudent?.student_id ?? pickStudent(list, list[0]?.id));
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  // The conversation stays in this browser tab only; it is never saved to the database.
  useEffect(() => {
    if (role === undefined) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey(current)) ?? "null") as Saved | null;
      setMsgs(saved?.msgs ?? []); setHints(saved?.hints ?? 0); setSolved(saved?.solved ?? false); setPid(saved?.pid ?? null);
      if (saved?.subject) setSubject(saved.subject);
    } catch { setMsgs([]); }
    setRecent(readRecent(current));
  }, [current, role]);
  useEffect(() => {
    if (role === undefined || busy) return;
    try { sessionStorage.setItem(storeKey(current), JSON.stringify({ subject, msgs, hints, solved, pid: pid ?? undefined } satisfies Saved)); } catch { /* private mode */ }
    // Keep this problem in the device's recent list so it can be opened again later.
    if (!pid || !msgs.some((m) => m.role === "assistant" && m.content)) return;
    const item: Recent = { pid, subject, msgs, hints, solved, title: problemTitle(msgs), at: Date.now() };
    const list = [item, ...readRecent(current).filter((r) => r.pid !== pid)];
    writeRecent(current, list);
    setRecent(list.slice(0, MAX_RECENT));
  }, [msgs, hints, solved, subject, current, busy, role, pid]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (content: string, a: Attachment | null = null) => {
    let text = content.trim() || (a ? "Here is my work. Can you look at it with me?" : "");
    if (!sb || !current || !text || busy) return;
    setError(null);
    // Word and text files go in as text; photos and PDFs are read by the helper once.
    if (a?.kind === "text") text += `\n\n[From my file ${a.name.replace(/[\[\]]/g, "")}]\n${a.text.slice(0, 6000)}`;
    const image = a && a.kind !== "text" ? a.dataUrl : null;
    const history: Msg[] = [...msgs, { role: "user", content: text, photo: a?.kind === "pdf" ? "pdf" : a?.kind === "image" }];
    if (!pid || msgs.length === 0) setPid(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId: current, subject, image, messages: history.slice(-16).map(({ role, content }) => ({ role, content })) }),
      });
      const out = (await res.json().catch(() => null)) as { reply?: string; help_type?: HelpType; hints?: number; solved?: boolean; problem_text?: string; error?: string } | null;
      if (!res.ok || !out?.reply) throw new Error(out?.error ?? "The helper couldn't answer. Please try again.");
      // A photo or PDF is sent once; after that the conversation carries what it showed as text.
      if (image && out.problem_text) history[history.length - 1] = { ...history[history.length - 1]!, content: `${text}\n\n[Photo of the problem: ${out.problem_text}]` };
      setMsgs([...history, { role: "assistant", content: out.reply, help: out.help_type, hints: out.hints }]);
      setHints(out.hints ?? 0);
      setSolved(!!out.solved);
      setDraft("");
      setProblem(""); setTried(""); setAtt(null); setChatAtt(null);
    } catch (e) {
      setError((e as Error).message);
      setMsgs(msgs);
      if (msgs.length > 0) setDraft(text);
    } finally {
      setBusy(false);
    }
  };

  const start = (kind: StartKind) => {
    const lead = START_KINDS.find((k) => k.id === kind)!.lead;
    const parts = [lead, problem.trim() ? `The problem: ${problem.trim()}` : att?.kind === "pdf" ? "The problem is in the file." : att?.kind === "image" ? "The problem is in the photo." : att ? "The problem is in my file." : "", `What I've tried so far: ${tried.trim() || "nothing yet"}`];
    void send(parts.filter(Boolean).join("\n\n"), att);
  };
  const newProblem = () => { setMsgs([]); setHints(0); setSolved(false); setError(null); setDraft(""); setChatAtt(null); setPid(null); };
  const reopen = (r: Recent) => { setSubject(r.subject); setMsgs(r.msgs); setHints(r.hints); setSolved(r.solved); setPid(r.pid); setError(null); setDraft(""); };
  const forget = (id: string | "all") => {
    const list = id === "all" ? [] : readRecent(current).filter((r) => r.pid !== id);
    writeRecent(current, list); setRecent(list);
  };
  const saveNotes = () => {
    // The study sheet below is shown only while printing; Print lets the student save it as a PDF too.
    const root = document.documentElement;
    root.classList.add("print-notes");
    const done = () => { root.classList.remove("print-notes"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    printPage();
    setTimeout(done, 1500);
  };
  const toggle = async (on: boolean) => {
    if (!sb || !current) return;
    const { error: e } = await sb.rpc("homework_set_enabled", { p_student: current, p_on: on });
    if (e) setError(friendly(e)); else setEnabled((x) => ({ ...x, [current]: on }));
  };

  const title = "Homework Helper";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (role === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!students.length) return <Page title={title}><p className="note">Add your student on <a href="/family">Family and permissions</a> first, then come back. The helper is built around your student's grade and classes.</p></Page>;
  const student = students.find((s) => s.id === current) ?? students[0]!;
  const isOn = enabled[student.id] ?? true;
  const blocked = role === "student" && (!student.permissions?.ai_chat || !isOn);
  const subj = subjectById(subject);

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        Help with any homework, in any subject, that keeps you doing the thinking. The helper gives hints, checks your work and explains ideas. It never gives the answer or writes for you.
      </p>
      {role === "parent" && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === student.id} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}

      {blocked ? (
        <p className="note note-info">Your parent has turned off the Homework Helper for your account. Ask them to turn it on.</p>
      ) : (
        <section className="panel chat">
          {role === "student" && <p className="hint" style={{ margin: 0 }}>🔒 Your parent can see the subjects you work on and when I say no to an answer, not your whole chat.</p>}
          {msgs.length === 0 ? (
            <div className="chips" style={{ justifyContent: "flex-start" }} aria-label="Subject">
              {SUBJECTS.map((s) => (
                <button key={s.id} className={`chip${s.id === subject ? " chip-on" : ""}`} aria-pressed={s.id === subject} onClick={() => setSubject(s.id)}>{s.icon} {s.label}</button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0 }}><b>{subj.icon} {subj.label}</b> <span className="hint">· to change subject, tap New problem</span></p>
          )}

          {msgs.length === 0 ? (
            <div className="hw-start">
              {recent.length > 0 && (
                <div className="hw-recent">
                  <p style={{ margin: 0 }}><b>Pick up where you left off</b> <span className="hint">· saved on this device only</span></p>
                  <ul className="plain-list">
                    {recent.map((r) => (
                      <li key={r.pid}>
                        <button type="button" className="linklike hw-recent-open" onClick={() => reopen(r)}>
                          {subjectById(r.subject).icon} {r.title}
                        </button>
                        <span className="hint"> · {new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{r.solved ? " · ✓ solved" : ""}</span>
                        <button type="button" className="linklike hint" aria-label={`Remove ${r.title}`} onClick={() => forget(r.pid)} style={{ marginLeft: 8 }}>Remove</button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="linklike hint" onClick={() => forget("all")}>Clear the list</button>
                </div>
              )}
              <label className="field">
                <span>What are you working on? ({subj.label})</span>
                <textarea {...NO_SUGGEST} className="input" rows={3} maxLength={2000} placeholder="Type the problem or question, or add a photo or file" value={problem} onChange={(e) => setProblem(e.target.value)} />
              </label>
              <div className="share-row">
                <VoiceButton value={problem} onText={setProblem} max={2000} disabled={busy} />
                <AttachButtons onPick={setAtt} onError={setError} disabled={busy} photoLabel={att ? "New photo" : "Take a photo"} />
                {att && <AttachPreview a={att} onRemove={() => setAtt(null)} />}
              </div>
              <label className="field">
                <span>What have you tried so far?</span>
                <textarea {...NO_SUGGEST} className="input" rows={2} maxLength={1500} placeholder="Your steps, your answer, or where you got stuck" value={tried} onChange={(e) => setTried(e.target.value)} />
              </label>
              <div className="share-row" style={{ marginTop: -6 }}>
                <VoiceButton value={tried} onText={setTried} max={1500} disabled={busy} small />
                <span className="hint">Explaining out loud is quick, and it helps you think.</span>
              </div>
              <div className="share-row">
                {START_KINDS.map((k, i) => (
                  <button key={k.id} className={`btn btn-inline${i ? " btn-ghost" : ""}`} disabled={busy || (!problem.trim() && !att)} onClick={() => start(k.id)}>{k.label}</button>
                ))}
              </div>
              <p className="hint" style={{ margin: 0 }}>Tip: showing what you tried gets you better help, faster. Snap a photo of your worksheet or your work, or upload the assignment (photo, PDF, Word, Excel or PowerPoint, old or new).</p>
            </div>
          ) : (
            <div className="chat-log" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`bubble bubble-${m.role}${m.role === "assistant" ? " hw-reply" : ""}`}>
                  {m.role === "assistant" && m.help && <span className="pill">{m.help === "hint" && m.hints ? `Hint ${Math.min(m.hints, 3)} of 3` : HELP_LABEL[m.help]}</span>}
                  {m.role === "assistant" ? (m.content ? <Formatted text={m.content} /> : <span className="typing">Thinking…</span>) : m.content.replace(/\n\n\[Photo of the problem: [\s\S]*\]$/, m.photo ? (m.photo === "pdf" ? "\n\n📄 file" : "\n\n📷 photo") : "").replace(/\n\n\[From my file ([^\]]*)\][\s\S]*$/, "\n\n📝 $1")}
                  {m.role === "assistant" && m.content && !busy && <ReportAi feature="homework" text={m.content} />}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {error && <p className="note note-err" role="alert">{error}</p>}

          {msgs.length > 0 && (
            <>
              {solved && (
                <p className="note note-ok" role="status">
                  ✓ Solved with {hints === 0 ? "no hints" : hints === 1 ? "1 hint" : `${hints} hints`}. Now try the twin problem on paper, without me. That's how it sticks.
                </p>
              )}
              {chatAtt && <p style={{ margin: 0 }}><AttachPreview a={chatAtt} onRemove={() => setChatAtt(null)} /> <span className="hint">Sends with your next message.</span></p>}
              <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void send(draft, chatAtt); }}>
                <textarea
                  {...NO_SUGGEST}
                  className="input"
                  rows={2}
                  maxLength={4000}
                  placeholder="Your next step, your answer, or your question…"
                  aria-label="Your message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft, chatAtt); } }}
                />
                <VoiceButton chat value={draft} onText={setDraft} max={4000} disabled={busy} />
                <button className="btn btn-inline" disabled={busy || (!draft.trim() && !chatAtt)}>{busy ? "…" : "Send"}</button>
              </form>
              <div className="chips" style={{ justifyContent: "flex-start" }}>
                <button className="chip" disabled={busy} onClick={() => void send("Can I have a hint?")}>💡 Hint</button>
                <button className="chip" disabled={busy || !draft.trim()} onClick={() => void send(`Please check my work: ${draft}`)}>✔️ Check this</button>
                <button className="chip" disabled={busy} onClick={() => void send("Can you explain the idea behind this with a different example?")}>📘 Explain the idea</button>
                <button className="chip" onClick={newProblem} disabled={busy}>➕ New problem</button>
                <button className="chip" onClick={saveNotes} disabled={busy || !msgs.some((m) => m.role === "assistant" && m.content)}>📄 Save my notes</button>
                <AttachButtons onPick={setChatAtt} onError={setError} disabled={busy} small photoLabel="Photo of my work" fileLabel="File" />
              </div>
              <div className="hw-print" aria-hidden="true">
                <h1>Homework Helper notes</h1>
                <p>{student.first_name} · {subj.label} · {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
                <h2>The problem</h2>
                <p>{problemTitle(msgs)}</p>
                <h2>How I worked through it</h2>
                {msgs.filter((m) => m.content).map((m, i) => (
                  <div key={i} className="hw-print-turn">
                    <b>{m.role === "user" ? "Me" : m.help ? HELP_LABEL[m.help] : "Helper"}:</b>
                    {m.role === "assistant" ? <Formatted text={m.content} /> : <p style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{cleanUser(m)}</p>}
                  </div>
                ))}
                <p><b>{solved ? `Solved by me, with ${hints === 0 ? "no hints" : hints === 1 ? "1 hint" : `${hints} hints`}.` : "Not finished yet."}</b> {solved ? "Try the twin problem on paper, without help." : ""}</p>
                <p className="hint">Made with the ScholarTasks Homework Helper. The helper gives hints and explains ideas; the work is my own.</p>
              </div>
              <div className="chat-foot">
                <span className="hint">Hints on this problem: {hints}. Save my notes makes a study sheet you can print or save as a PDF. This problem is kept on this device so you can open it again. The helper can make mistakes; if something looks wrong, ask your teacher. Follow your teacher's rules about AI.</span>
              </div>
            </>
          )}
        </section>
      )}

      {role === "parent" && <ParentPanel student={student} enabled={isOn} onToggle={(on) => void toggle(on)} />}
    </Page>
  );
}

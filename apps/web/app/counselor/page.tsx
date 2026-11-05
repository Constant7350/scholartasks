"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Formatted } from "../formatted";
import { supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { ReportAi } from "../report-ai";

interface Student { id: string; first_name: string; grade_level: number; permissions: Record<string, boolean> }
interface Msg { role: "user" | "assistant"; content: string; fromBank?: boolean }

const STARTERS = [
  "What should we be doing this month?",
  "Is my student on track for HOPE and Zell Miller?",
  "Which deadlines are coming up first?",
  "How do the FAFSA and the GSFAPP differ?",
];
const GENERAL_STARTERS = [
  "What should a high school senior be doing this month?",
  "How does the HOPE Scholarship work?",
  "What's the difference between Early Action and Early Decision?",
  "How do the FAFSA and the GSFAPP differ?",
];
const storeKey = (id: string | null) => `st-counselor-${id}`;

export default function CounselorPage() {
  const sb = supabase();
  const [role, setRole] = useState<"parent" | "student" | null | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/counselor");
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, grade_level, permissions").order("first_name"),
    ]);
    const m = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = m.find((r) => r.role === "student");
    setRole(m.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null);
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? asStudent?.student_id ?? pickStudent(list, list[0]?.id));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);
  // A question handed over from another page (e.g. "Ask the AI counselor about this goal").
  useEffect(() => {
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask) setDraft(ask.slice(0, 4000));
  }, []);

  // The conversation stays in this browser tab only; it is not saved to the database.
  useEffect(() => {
    if (role === undefined) return;
    try { setMsgs(JSON.parse(sessionStorage.getItem(storeKey(current)) ?? "[]") as Msg[]); } catch { setMsgs([]); }
  }, [current, role]);
  useEffect(() => {
    if (role === undefined || busy) return;
    try { sessionStorage.setItem(storeKey(current), JSON.stringify(msgs)); } catch { /* private mode */ }
  }, [msgs, current, busy, role]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!sb || !content || busy) return;
    setError(null);
    setDraft("");
    const history: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/counselor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId: current ?? "", messages: history.slice(-20).map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? "The counselor couldn't answer. Please try again.");
      }
      const fromBank = res.headers.get("X-Answer-Source") === "bank";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMsgs([...history, { role: "assistant", content: answer, fromBank }]);
      }
      if (!answer.trim()) throw new Error("The counselor didn't answer. Please try again.");
    } catch (e) {
      setError((e as Error).message);
      setMsgs(history.slice(0, -1));
      setDraft(content);
    } finally {
      setBusy(false);
    }
  };

  const title = "AI counselor";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (role === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  const student = students.find((s) => s.id === current);
  const blocked = role === "student" && !!student && !student.permissions?.ai_chat;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        Ask about colleges, scholarships, aid forms and deadlines.{" "}
        {student ? <>Answers use {student.first_name}'s saved grades, college list and deadlines.</> : <>For advice built around your own student, <a href="/family">add them</a> any time.</>}
      </p>
      {role === "parent" && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}

      {blocked ? (
        <p className="note note-info">Your parent has turned off the AI counselor for your account. Ask them to turn on "AI chat" in Family and permissions.</p>
      ) : (
        <section className="panel chat">
          {msgs.length === 0 ? (
            <div className="chat-empty">
              <span className="tile-icon">🤖</span>
              <b>Where would you like to start?</b>
              <div className="chips">
                {(student ? STARTERS : GENERAL_STARTERS).map((q) => <button key={q} className="chip" onClick={() => void send(q)}>{q}</button>)}
              </div>
            </div>
          ) : (
            <div className="chat-log" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`bubble bubble-${m.role}`}>
                  {m.role === "assistant" ? (m.content ? <Formatted text={m.content} /> : <span className="typing">Thinking…</span>) : m.content}
                  {m.fromBank && <span className="bank-note">✓ From the ScholarTasks answer library, reviewed by our team</span>}
                  {m.role === "assistant" && m.content && !busy && <ReportAi feature="counselor" text={m.content} />}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {error && <p className="note note-err" role="alert">{error}</p>}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
            <textarea
              className="input"
              rows={2}
              maxLength={4000}
              placeholder="Ask the counselor…"
              aria-label="Your question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
            />
            <button className="btn btn-inline" disabled={busy || !draft.trim()}>{busy ? "…" : "Send"}</button>
          </form>
          <div className="chat-foot">
            <span className="hint">AI can make mistakes. Check dates and amounts on the official sites. Never share passwords, FSA IDs or Social Security numbers.</span>
            {msgs.length > 0 && !busy && <button className="linklike" onClick={() => { setMsgs([]); setError(null); }}>Start over</button>}
          </div>
        </section>
      )}
    </Page>
  );
}

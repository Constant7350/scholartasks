"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

interface Q { id: string; subject: string; topic: string; kind: "mc" | "written"; question: string; options: string[] | null; answer_index: number | null; model_answer: string | null; explanation: string | null; status: "pending" | "approved" | "rejected" }
interface Edit { question: string; options: string[]; answer_index: number; model_answer: string; explanation: string; topic: string }
const TABS = [["pending", "Waiting for review"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export default function QuestionReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Q["status"]>("pending");
  const [subject, setSubject] = useState("all");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rows, setRows] = useState<Q[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/questions");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.from("practice_questions")
      .select("id, subject, topic, kind, question, options, answer_index, model_answer, explanation, status")
      .eq("status", tab).order("subject").order("kind").order("topic").limit(500);
    if (e) setError(friendly(e));
    const list = (data as Q[]) ?? [];
    setRows(list);
    setSubjects((prev) => Array.from(new Set([...prev, ...list.map((q) => q.subject)])).sort());
  }, [sb, tab]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => rows.filter((q) => subject === "all" || q.subject === subject), [rows, subject]);
  const editOf = (q: Q): Edit => edits[q.id] ?? { question: q.question, options: q.options ?? [], answer_index: q.answer_index ?? 0, model_answer: q.model_answer ?? "", explanation: q.explanation ?? "", topic: q.topic };

  const decide = async (q: Q, status: Q["status"]) => {
    if (!sb) return;
    setError(null); setSaved(null);
    const { data: s } = await sb.auth.getSession();
    const ed = editOf(q);
    const patch: Record<string, unknown> = {
      status, question: ed.question.trim(), topic: ed.topic.trim(), explanation: ed.explanation.trim() || null,
      reviewed_by: s.session?.user.id, reviewed_at: new Date().toISOString(),
    };
    if (q.kind === "mc") { patch.options = ed.options.map((o) => o.trim()); patch.answer_index = ed.answer_index; }
    else patch.model_answer = ed.model_answer.trim();
    const { error: e } = await sb.from("practice_questions").update(patch).eq("id", q.id);
    if (e) return setError(friendly(e));
    setSaved(status === "approved" ? "Approved. Students now see it without the Draft label." : status === "rejected" ? "Rejected. Students won't see it." : "Saved.");
    const next = { ...edits }; delete next[q.id]; setEdits(next);
    void load();
  };

  const title = "Practice question review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        These are the practice questions students use to test themselves. Check that each question is clear, the right answer is marked, and the explanation would help a student. Fix anything right here, then approve. Questions waiting for review show a &ldquo;Draft&rdquo; label to students; rejected ones are hidden.
      </p>
      <div className="tabs" role="tablist" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: 520 }}>
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="subj">Subject</label>
        <select id="subj" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="all">All subjects ({rows.length})</option>
          {subjects.map((s) => <option key={s} value={s}>{s} ({rows.filter((q) => q.subject === s).length})</option>)}
        </select>
      </div>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {saved && <p className="note note-ok" role="status">{saved}</p>}
      {shown.length === 0 && <p className="hint">Nothing here.</p>}
      {shown.map((q) => {
        const ed = editOf(q);
        const set = (p: Partial<Edit>) => setEdits({ ...edits, [q.id]: { ...ed, ...p } });
        return (
          <section key={q.id} className="panel review">
            <span className="hint" style={{ fontSize: 12 }}>{q.subject} · {q.kind === "mc" ? "Multiple choice" : "Written answer (AI checks it)"}</span>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`t-${q.id}`}>Topic</label><input id={`t-${q.id}`} className="input" value={ed.topic} onChange={(e) => set({ topic: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`q-${q.id}`}>Question</label><textarea id={`q-${q.id}`} className="input" value={ed.question} onChange={(e) => set({ question: e.target.value })} /></div>
            {q.kind === "mc" ? (
              <fieldset className="field" style={{ margin: 0, border: 0, padding: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: 6 }}>Choices (pick the right one)</legend>
                {ed.options.map((o, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input type="radio" name={`ans-${q.id}`} aria-label={`Choice ${i + 1} is correct`} checked={ed.answer_index === i} onChange={() => set({ answer_index: i })} />
                    <input className="input" aria-label={`Choice ${i + 1}`} value={o} onChange={(e) => { const opts = [...ed.options]; opts[i] = e.target.value; set({ options: opts }); }} />
                  </div>
                ))}
              </fieldset>
            ) : (
              <div className="field" style={{ margin: 0 }}><label htmlFor={`m-${q.id}`}>Model answer (the AI compares students&apos; answers to this)</label><textarea id={`m-${q.id}`} className="input" value={ed.model_answer} onChange={(e) => set({ model_answer: e.target.value })} /></div>
            )}
            <div className="field" style={{ margin: 0 }}><label htmlFor={`e-${q.id}`}>Explanation shown after answering</label><textarea id={`e-${q.id}`} className="input" value={ed.explanation} onChange={(e) => set({ explanation: e.target.value })} /></div>
            <div className="share-row" style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-inline" onClick={() => void decide(q, "approved")}>{q.status === "approved" ? "Save changes" : "Approve"}</button>
              {q.status !== "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(q, "rejected")}>{q.status === "approved" ? "Stop using" : "Reject"}</button>}
              {q.status === "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(q, "pending")}>Move back to review</button>}
            </div>
          </section>
        );
      })}
    </Page>
  );
}

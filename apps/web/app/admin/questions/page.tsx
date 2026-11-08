"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { ReviewNav, chunks, DoneRow, OneHeader, ReviewBar, StatusPill, useMode, whenOf, type Done } from "../review-kit";

interface Q { id: string; level: number | null; reviewed_at: string | null; passage: string | null; subject: string; topic: string; kind: "mc" | "written"; question: string; options: string[] | null; answer_index: number | null; model_answer: string | null; explanation: string | null; status: "pending" | "approved" | "rejected" }
interface Edit { passage: string; question: string; options: string[]; answer_index: number; model_answer: string; explanation: string; topic: string }
const LEVEL_NAMES = ["Foundation", "Core", "Strong", "Advanced", "Expert"];
const TABS = [["pending", "Waiting for review"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export default function QuestionReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Q["status"]>("pending");
  const [subject, setSubject] = useState("all");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rows, setRows] = useState<Q[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [done, setDone] = useState<Record<string, Done & { was: Q }>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [mode, setMode] = useMode("questions");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/questions");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    // The bank has more than 1,000 questions, so read it a page at a time.
    const list: Q[] = [];
    for (let from = 0; from < 10000; from += 1000) {
      const { data, error: e } = await sb.from("practice_questions")
        .select("*")
        .eq("status", tab).order("subject").order("kind").order("passage", { nullsFirst: true }).order("topic").order("id").range(from, from + 999);
      if (e) { setError(friendly(e)); break; }
      list.push(...((data as Q[]) ?? []));
      if ((data ?? []).length < 1000) break;
    }
    setRows(list);
    setDone({}); setSkipped([]); setEdits({});
    setSubjects((prev) => Array.from(new Set([...prev, ...list.map((q) => q.subject)])).sort());
  }, [sb, tab]);
  useEffect(() => { void load(); }, [load]);

  const [pageSize, setPageSize] = useState(25);
  useEffect(() => setPageSize(25), [tab, subject]);
  const matching = useMemo(() => rows.filter((q) => subject === "all" || q.subject === subject), [rows, subject]);
  // Items still to look at (not saved this visit), skipped ones last.
  const left = useMemo(() => {
    const l = matching.filter((q) => !done[q.id]);
    return [...l.filter((q) => !skipped.includes(q.id)), ...l.filter((q) => skipped.includes(q.id))];
  }, [matching, done, skipped]);
  const shown = mode === "one" ? left.slice(0, 1) : matching.slice(0, pageSize);
  const editOf = (q: Q): Edit => edits[q.id] ?? { passage: q.passage ?? "", question: q.question, options: q.options ?? [], answer_index: q.answer_index ?? 0, model_answer: q.model_answer ?? "", explanation: q.explanation ?? "", topic: q.topic };
  const doneLabel = (status: Q["status"], same: boolean) => same ? "Changes saved" : status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Moved back to review";

  const decide = async (q: Q, status: Q["status"]) => {
    if (!sb) return;
    setError(null);
    const { data: s } = await sb.auth.getSession();
    const ed = editOf(q);
    const patch: Record<string, unknown> = {
      status, question: ed.question.trim(), topic: ed.topic.trim(), explanation: ed.explanation.trim() || null,
      reviewed_by: s.session?.user.id, reviewed_at: new Date().toISOString(),
    };
    if (q.passage != null) patch.passage = ed.passage.trim() || null;
    if (q.kind === "mc") { patch.options = ed.options.map((o) => o.trim()); patch.answer_index = ed.answer_index; }
    else patch.model_answer = ed.model_answer.trim();
    const { error: e } = await sb.from("practice_questions").update(patch).eq("id", q.id);
    if (e) return setError(friendly(e));
    const next = { ...edits }; delete next[q.id]; setEdits(next);
    setRows((rs) => rs.map((r) => (r.id === q.id ? ({ ...r, ...patch } as Q) : r)));
    setDone((d) => ({ ...d, [q.id]: { label: doneLabel(status, status === q.status), at: new Date(), ok: status === "approved", was: q } }));
  };

  const undo = async (id: string) => {
    if (!sb) return;
    const was = done[id]?.was;
    if (!was) return;
    const { error: e } = await sb.from("practice_questions").update({ status: was.status, question: was.question, topic: was.topic, explanation: was.explanation, passage: was.passage, options: was.options, answer_index: was.answer_index, model_answer: was.model_answer, reviewed_at: was.reviewed_at }).eq("id", id);
    if (e) return setError(friendly(e));
    setRows((rs) => rs.map((r) => (r.id === id ? was : r)));
    setDone((d) => { const n = { ...d }; delete n[id]; return n; });
  };

  const approveAll = async () => {
    if (!sb) return;
    setError(null);
    const { data: s } = await sb.auth.getSession();
    const todo = [...left];
    // Questions you edited are saved with your edits; the rest are approved as they are.
    for (const q of todo.filter((q) => edits[q.id])) await decide(q, "approved");
    const plain = todo.filter((q) => !edits[q.id]);
    const at = new Date();
    for (const part of chunks(plain.map((q) => q.id))) {
      const { error: e } = await sb.from("practice_questions").update({ status: "approved", reviewed_by: s.session?.user.id, reviewed_at: at.toISOString() }).in("id", part);
      if (e) return setError(friendly(e));
      setDone((d) => ({ ...d, ...Object.fromEntries(part.map((id) => [id, { label: "Approved", at, ok: true, was: plain.find((q) => q.id === id)! }])) }));
    }
  };

  const title = "Practice question review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <ReviewNav />
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
      {matching.length > 0 && (
        <ReviewBar
          left={left.length} doneCount={Object.keys(done).length} mode={mode} setMode={setMode}
          allLabel={tab === "pending" ? (n) => `Approve all ${n}${subject === "all" ? "" : ` ${subject}`}` : undefined}
          allNote="Approves every question left in this list. Any you edited are saved with your edits."
          onAll={tab === "pending" ? approveAll : undefined}
        />
      )}
      {shown.length === 0 && <p className="hint">{matching.length ? "✓ You've been through every question in this list." : "Nothing here."}</p>}
      {mode === "one" && shown[0] && <OneHeader index={1} total={left.length} onSkip={() => setSkipped((k) => [...k.filter((x) => x !== shown[0]!.id), shown[0]!.id])} />}
      {mode === "list" && matching.length > 0 && <p className="hint" style={{ fontSize: 13 }}>Showing {shown.length} of {matching.length}. Questions that share a reading passage appear one after another.</p>}
      {shown.map((q) => {
        const d = done[q.id];
        if (d && d.label !== "Changes saved") return <DoneRow key={q.id} title={q.question} done={d} onUndo={() => void undo(q.id)} />;
        const ed = editOf(q);
        const set = (p: Partial<Edit>) => setEdits({ ...edits, [q.id]: { ...ed, ...p } });
        return (
          <section key={q.id} className="panel review">
            <div className="review-head">
              <StatusPill status={q.status === "approved" ? "ok" : q.status === "pending" ? "wait" : "off"} label={q.status === "approved" ? "✓ Approved" : q.status === "pending" ? "Waiting for review" : "Rejected"} />
              <span className="hint" style={{ fontSize: 12 }}>{q.subject} · {q.kind === "mc" ? "Multiple choice" : "Written answer (AI checks it)"}{q.level ? ` · ${LEVEL_NAMES[q.level - 1]} level` : ""}{q.reviewed_at && !d ? ` · last saved ${whenOf(q.reviewed_at)}` : ""}</span>
              {d && <span className="pill pill-ok" role="status">✓ Changes saved {d.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
              {edits[q.id] && <span className="unsaved">● Not saved yet</span>}
            </div>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`t-${q.id}`}>Topic</label><input id={`t-${q.id}`} className="input" value={ed.topic} onChange={(e) => set({ topic: e.target.value })} /></div>
            {q.passage != null && <div className="field" style={{ margin: 0 }}><label htmlFor={`p-${q.id}`}>Passage (shared by every question that uses it; [[double brackets]] = underlined)</label><textarea id={`p-${q.id}`} className="input" rows={6} value={ed.passage} onChange={(e) => set({ passage: e.target.value })} /></div>}
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
              <button className="btn btn-inline" disabled={q.status === "approved" && !edits[q.id]} onClick={() => void decide(q, "approved")}>{q.status === "approved" ? (edits[q.id] ? "Save changes" : "No changes to save") : mode === "one" ? "Approve and next" : "Approve"}</button>
              {q.status !== "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(q, "rejected")}>{q.status === "approved" ? "Stop using" : "Reject"}</button>}
              {q.status === "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(q, "pending")}>Move back to review</button>}
            </div>
          </section>
        );
      })}
      {mode === "list" && matching.length > shown.length && <button className="btn btn-ghost btn-inline" onClick={() => setPageSize(pageSize + 25)}>Show 25 more</button>}
    </Page>
  );
}

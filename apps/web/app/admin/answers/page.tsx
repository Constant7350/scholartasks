"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { ReviewNav, chunks, DoneRow, OneHeader, ReviewBar, StatusPill, timeOf, useMode, whenOf, type Done } from "../review-kit";

interface Entry { id: string; state: string; question: string; answer: string; status: "pending" | "approved" | "rejected"; hits: number; created_at: string; reviewed_at: string | null }
const TABS = [["pending", "Waiting for review"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export default function AnswerReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Entry["status"]>("pending");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [edits, setEdits] = useState<Record<string, { question: string; answer: string }>>({});
  const [done, setDone] = useState<Record<string, Done & { was: Entry }>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [mode, setMode] = useMode("answers");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/answers");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.from("answer_bank").select("id, state, question, answer, status, hits, created_at, reviewed_at").eq("status", tab).order("created_at", { ascending: false }).limit(500);
    if (e) setError(friendly(e));
    setEntries((data as Entry[]) ?? []);
    setDone({}); setSkipped([]); setEdits({});
  }, [sb, tab]);
  useEffect(() => { void load(); }, [load]);

  const left = useMemo(() => {
    const l = entries.filter((en) => !done[en.id]);
    return [...l.filter((en) => !skipped.includes(en.id)), ...l.filter((en) => skipped.includes(en.id))];
  }, [entries, done, skipped]);
  const shown = mode === "one" ? left.slice(0, 1) : entries;

  const decide = async (en: Entry, status: Entry["status"]) => {
    if (!sb) return;
    setError(null);
    const { data: s } = await sb.auth.getSession();
    const edit = edits[en.id] ?? { question: en.question, answer: en.answer };
    const patch = { status, question: edit.question.trim(), answer: edit.answer.trim(), reviewed_by: s.session?.user.id, reviewed_at: new Date().toISOString() };
    const { error: e } = await sb.from("answer_bank").update(patch).eq("id", en.id);
    if (e) return setError(friendly(e));
    const next = { ...edits }; delete next[en.id]; setEdits(next);
    setEntries((rs) => rs.map((r) => (r.id === en.id ? { ...r, ...patch } : r)));
    const same = status === en.status;
    setDone((d) => ({ ...d, [en.id]: { label: same ? "Changes saved" : status === "approved" ? "Approved" : status === "rejected" ? (en.status === "approved" ? "No longer used" : "Rejected") : "Moved back", at: new Date(), ok: status === "approved", was: en } }));
  };

  const undo = async (id: string) => {
    if (!sb) return;
    const was = done[id]?.was;
    if (!was) return;
    const { error: e } = await sb.from("answer_bank").update({ status: was.status, question: was.question, answer: was.answer, reviewed_at: was.reviewed_at }).eq("id", id);
    if (e) return setError(friendly(e));
    setEntries((rs) => rs.map((r) => (r.id === id ? was : r)));
    setDone((d) => { const n = { ...d }; delete n[id]; return n; });
  };

  const approveAll = async () => {
    if (!sb) return;
    setError(null);
    const { data: s } = await sb.auth.getSession();
    const todo = [...left];
    for (const en of todo.filter((en) => edits[en.id])) await decide(en, "approved");
    const plain = todo.filter((en) => !edits[en.id]);
    const at = new Date();
    for (const part of chunks(plain.map((en) => en.id))) {
      const { error: e } = await sb.from("answer_bank").update({ status: "approved", reviewed_by: s.session?.user.id, reviewed_at: at.toISOString() }).in("id", part);
      if (e) return setError(friendly(e));
      setDone((d) => ({ ...d, ...Object.fromEntries(part.map((id) => [id, { label: "Approved", at, ok: true, was: plain.find((en) => en.id === id)! }])) }));
    }
  };

  const title = "Answer library review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <ReviewNav />
      <p className="hint" style={{ marginTop: -8 }}>
        General questions families ask the counselor are saved here with personal details removed. Approved answers are given to the next family who asks something similar, instantly and for free. Check each one is accurate and has nothing personal in it.
      </p>
      <div className="tabs" role="tablist" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: 520 }}>
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {entries.length > 0 && (
        <ReviewBar
          left={left.length} doneCount={Object.keys(done).length} mode={mode} setMode={setMode}
          allLabel={tab === "pending" ? (n) => `Approve all ${n}` : undefined}
          allNote="Approves every answer left in this list. Any you edited are saved with your edits."
          onAll={tab === "pending" ? approveAll : undefined}
        />
      )}
      {shown.length === 0 && <p className="hint">{entries.length ? "✓ You've been through every answer in this list." : "Nothing here yet."}</p>}
      {mode === "one" && shown[0] && <OneHeader index={1} total={left.length} onSkip={() => setSkipped((k) => [...k.filter((x) => x !== shown[0]!.id), shown[0]!.id])} />}
      {shown.map((en) => {
        const d = done[en.id];
        if (d && d.label !== "Changes saved") return <DoneRow key={en.id} title={en.question} done={d} onUndo={() => void undo(en.id)} />;
        const edit = edits[en.id] ?? { question: en.question, answer: en.answer };
        const set = (patch: Partial<typeof edit>) => setEdits({ ...edits, [en.id]: { ...edit, ...patch } });
        const changed = !!edits[en.id];
        return (
          <section key={en.id} className="panel review">
            <div className="review-head">
              <StatusPill status={en.status === "approved" ? "ok" : en.status === "pending" ? "wait" : "off"} label={en.status === "approved" ? "✓ Approved" : en.status === "pending" ? "Waiting for review" : "Rejected"} />
              <span className="hint" style={{ fontSize: 12 }}>{en.state} · asked {new Date(en.created_at).toLocaleDateString()} · used {en.hits} {en.hits === 1 ? "time" : "times"}{en.reviewed_at && !d ? ` · last saved ${whenOf(en.reviewed_at)}` : ""}</span>
              {d && <span className="pill pill-ok" role="status">✓ Changes saved {timeOf(d.at)}</span>}
              {changed && <span className="unsaved">● Not saved yet</span>}
            </div>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`q-${en.id}`}>Question</label><input id={`q-${en.id}`} className="input" value={edit.question} onChange={(e) => set({ question: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`a-${en.id}`}>Answer</label><textarea id={`a-${en.id}`} className="input" value={edit.answer} onChange={(e) => set({ answer: e.target.value })} /></div>
            <div className="share-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {en.status !== "approved" && <button className="btn btn-inline" onClick={() => void decide(en, "approved")}>{mode === "one" ? "Approve and next" : "Approve"}</button>}
              {en.status === "approved" && <button className="btn btn-inline" disabled={!changed} onClick={() => void decide(en, "approved")}>{changed ? "Save changes" : "No changes to save"}</button>}
              {en.status !== "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(en, "rejected")}>{en.status === "approved" ? "Stop using" : "Reject"}</button>}
              {en.status === "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(en, "pending")}>Move back to review</button>}
            </div>
          </section>
        );
      })}
    </Page>
  );
}

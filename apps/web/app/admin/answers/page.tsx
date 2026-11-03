"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

interface Entry { id: string; state: string; question: string; answer: string; status: "pending" | "approved" | "rejected"; hits: number; created_at: string }
const TABS = [["pending", "Waiting for review"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export default function AnswerReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Entry["status"]>("pending");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [edits, setEdits] = useState<Record<string, { question: string; answer: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/answers");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.from("answer_bank").select("id, state, question, answer, status, hits, created_at").eq("status", tab).order("created_at", { ascending: false }).limit(100);
    if (e) setError(friendly(e));
    setEntries((data as Entry[]) ?? []);
  }, [sb, tab]);
  useEffect(() => { void load(); }, [load]);

  const decide = async (en: Entry, status: Entry["status"]) => {
    if (!sb) return;
    setError(null);
    const { data: s } = await sb.auth.getSession();
    const edit = edits[en.id] ?? { question: en.question, answer: en.answer };
    const { error: e } = await sb.from("answer_bank").update({ status, question: edit.question.trim(), answer: edit.answer.trim(), reviewed_by: s.session?.user.id, reviewed_at: new Date().toISOString() }).eq("id", en.id);
    if (e) return setError(friendly(e));
    void load();
  };

  const title = "Answer library review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        General questions families ask the counselor are saved here with personal details removed. Approved answers are given to the next family who asks something similar, instantly and for free. Check each one is accurate and has nothing personal in it.
      </p>
      <div className="tabs" role="tablist" style={{ gridTemplateColumns: "1fr 1fr 1fr", maxWidth: 520 }}>
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {entries.length === 0 && <p className="hint">Nothing here yet.</p>}
      {entries.map((en) => {
        const edit = edits[en.id] ?? { question: en.question, answer: en.answer };
        const set = (patch: Partial<typeof edit>) => setEdits({ ...edits, [en.id]: { ...edit, ...patch } });
        return (
          <section key={en.id} className="panel review">
            <span className="hint" style={{ fontSize: 12 }}>{en.state} · {new Date(en.created_at).toLocaleDateString()} · used {en.hits} {en.hits === 1 ? "time" : "times"}</span>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`q-${en.id}`}>Question</label><input id={`q-${en.id}`} className="input" value={edit.question} onChange={(e) => set({ question: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor={`a-${en.id}`}>Answer</label><textarea id={`a-${en.id}`} className="input" value={edit.answer} onChange={(e) => set({ answer: e.target.value })} /></div>
            <div className="share-row" style={{ display: "flex", gap: 10 }}>
              {en.status !== "approved" && <button className="btn btn-inline" onClick={() => void decide(en, "approved")}>Approve</button>}
              {en.status === "approved" && <button className="btn btn-inline" onClick={() => void decide(en, "approved")}>Save changes</button>}
              {en.status !== "rejected" && <button className="btn btn-ghost btn-inline" onClick={() => void decide(en, "rejected")}>{en.status === "approved" ? "Stop using" : "Reject"}</button>}
            </div>
          </section>
        );
      })}
    </Page>
  );
}

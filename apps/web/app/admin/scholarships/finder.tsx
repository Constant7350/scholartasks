"use client";

import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { FINDER_TOPICS } from "../../../lib/scholarship-finder-topics";

/**
 * "Find new awards": runs the AI finder on a topic, on every topic, or on one
 * page the team pastes (a community foundation's list, a club's page). New awards
 * land in Found by AI, hidden from families until they're checked.
 */
export function Finder({ onFound }: { onFound: () => Promise<void> | void }) {
  const sb = supabase();
  const [topic, setTopic] = useState(FINDER_TOPICS[0]!.id);
  const [page, setPage] = useState("");
  const [run, setRun] = useState<{ done: number; total: number; added: number; label: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);

  const call = async (body: { topic?: string; url?: string }) => {
    const { data } = await sb!.auth.getSession();
    const res = await fetch("/api/scholarships/find", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as { added?: number; error?: string };
    if (!res.ok) throw new Error(out.error ?? "The AI finder couldn't finish.");
    return out.added ?? 0;
  };
  const runList = async (items: { body: { topic?: string; url?: string }; label: string }[]) => {
    stop.current = false; setMsg(null);
    const tally = { done: 0, total: items.length, added: 0, label: items[0]?.label ?? "" };
    setRun({ ...tally });
    let failed = 0;
    for (const it of items) {
      if (stop.current) break;
      tally.label = it.label; setRun({ ...tally });
      try { tally.added += await call(it.body); } catch { failed++; }
      tally.done++; setRun({ ...tally });
      await onFound();
    }
    setRun(null);
    setMsg(`Found ${tally.added} new award${tally.added === 1 ? "" : "s"}${failed ? ` (${failed} search${failed === 1 ? "" : "es"} didn't finish; try again later)` : ""}. They're below. Tap “Check all now” to confirm them on their official sites.`);
  };

  if (!sb) return null;
  const pageOk = /^https:\/\/\S{4,}$/.test(page.trim());
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0 }}>Find new awards</h2>
      <p className="hint">The AI searches official sites (never aggregator sites) and adds awards we don&apos;t have yet. Families don&apos;t see them until the checker confirms each one. Each search costs about 2 to 5 cents. It also runs on its own every Tuesday, three topics a week.</p>
      {run ? (
        <div className="row" style={{ alignItems: "center" }}>
          <span><b>Searching {run.done + 1} of {run.total}: {run.label}…</b> {run.added} new so far. Keep this page open.</span>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={() => { stop.current = true; }}>Stop after this one</button>
        </div>
      ) : (
        <>
          <div className="row" style={{ alignItems: "end" }}>
            <div className="field" style={{ flex: "1 1 260px" }}>
              <label htmlFor="find-topic">Topic</label>
              <select id="find-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
                {FINDER_TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <button className="btn btn-inline" onClick={() => void runList([{ body: { topic }, label: FINDER_TOPICS.find((t) => t.id === topic)!.label }])}>🔎 Search this topic</button>
            <button className="btn btn-ghost btn-inline" onClick={() => void runList(FINDER_TOPICS.map((t) => ({ body: { topic: t.id }, label: t.label })))}>Search all {FINDER_TOPICS.length} topics (about ${Math.round(FINDER_TOPICS.length * 0.04)})</button>
          </div>
          <div className="row" style={{ alignItems: "end" }}>
            <div className="field" style={{ flex: "1 1 320px" }}>
              <label htmlFor="find-page">Or paste a page with a list of awards</label>
              <input id="find-page" className="input" placeholder="https://a-community-foundation.org/scholarships" value={page} onChange={(e) => setPage(e.target.value)} />
            </div>
            <button className="btn btn-inline" disabled={!pageOk} onClick={() => void runList([{ body: { url: page.trim() }, label: page.trim() }])}>Read this page</button>
          </div>
        </>
      )}
      {msg && <p className="note" role="status">{msg}</p>}
    </section>
  );
}

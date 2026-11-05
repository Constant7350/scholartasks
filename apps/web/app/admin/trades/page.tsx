"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { checkableFacts } from "@scholartasks/core";
import { friendly, supabase } from "../../../lib/supabase";
import { TRADES_PACK } from "../../../lib/trades";
import { NotConfigured, Page } from "../../ui";

interface Check {
  subject: string; title: string; url: string; checked_on: string | null; result: string; summary: string | null;
  sources: string[]; status: "ok" | "review" | "fixed" | "dismissed";
}

const FACTS = checkableFacts(TRADES_PACK);

/**
 * Team review of the monthly trades check: aid programs and Georgia license
 * rules the AI couldn't confirm on the official site. The trades list is part
 * of the app, so a fix means updating it (ask Claude in the project), then
 * marking the item fixed here.
 */
export default function TradeChecksPage() {
  const sb = supabase();
  const title = "Review trade facts";
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Check[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/trades");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.from("trade_checks").select("*").order("checked_on", { ascending: false });
    if (e) setError(friendly(e));
    setRows((data as Check[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.subject, r])), [rows]);
  const review = rows.filter((r) => r.status === "review");

  const mark = async (subject: string, status: "fixed" | "dismissed") => {
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    const { error: e } = await sb.from("trade_checks").update({ status, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("subject", subject);
    if (e) return setError(friendly(e));
    void load();
  };

  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint">
        Early each month the AI reads {FACTS.length} trade facts (aid programs and Georgia license rules) on their official sites.
        Anything it couldn&apos;t confirm shows here. To fix one, ask Claude in the ScholarTasks project to update the trades list, then press Fixed.
      </p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      <section className="panel">
        <h2>{review.length ? `${review.length} to review` : "Nothing to review"}</h2>
        {review.length === 0 && <p className="hint" style={{ margin: 0 }}>Every checked fact matched its official site.</p>}
        <ul className="items">
          {review.map((r) => {
            const fact = FACTS.find((f) => f.subject === r.subject);
            return (
              <li key={r.subject} style={{ display: "grid", gap: 6, justifyContent: "stretch" }}>
                <b>{r.title} <span className="pill">{r.result === "changed" ? "Looks changed" : "Couldn't confirm"}</span></b>
                <span>{r.summary}</span>
                {fact && <span className="hint">What the app says: {fact.claim}</span>}
                <span className="hint">
                  Checked {r.checked_on} · <a href={r.url} target="_blank" rel="noreferrer">Official page</a>
                  {r.sources.map((s, i) => <span key={s}> · <a href={s} target="_blank" rel="noreferrer">Source {i + 1}</a></span>)}
                </span>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-inline btn-sm" onClick={() => void mark(r.subject, "fixed")}>Fixed</button>
                  <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void mark(r.subject, "dismissed")}>Not a problem</button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <h2>All checked facts</h2>
        <ul className="items">
          {FACTS.map((f) => {
            const r = byKey.get(f.subject);
            return (
              <li key={f.subject}>
                <span>{f.title}</span>
                <span className="hint">{r?.checked_on ? `${r.checked_on}: ${r.status === "ok" ? "matches" : r.status}` : "Not checked yet"}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </Page>
  );
}

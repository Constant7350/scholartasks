"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OPENING_KINDS, OPENING_SAFETY_TIPS, OPENING_STATES, sortOpenings, type OpeningKind } from "@scholartasks/core";
import { supabase } from "../../lib/supabase";
import { STATE_NAMES, TRADES } from "../../lib/trades";
import { ageLabel, kindLabel, place, tradeName, type PublicOpening } from "../../lib/openings";
import { useCurrentStudent } from "../../lib/current-student";

/**
 * Openings that local companies posted and our team approved.
 * Home state first, then the rest of the country. Students apply the company's
 * way; nothing about the student is sent anywhere.
 * `trade` limits the list to one trade (used on each trade page).
 */
export function OpeningsList({ trade, compact = false }: { trade?: string; compact?: boolean }) {
  const sb = supabase();
  const [rows, setRows] = useState<PublicOpening[] | null>(null);
  const [error, setError] = useState(false);
  const [home, setHome] = useState("GA");
  const [current] = useCurrentStudent();
  const [tradeF, setTradeF] = useState(trade ?? "");
  const [kindF, setKindF] = useState<OpeningKind | "">("");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return setRows([]);
    let query = sb.from("public_openings").select("*").limit(500);
    if (trade) query = query.eq("trade_slug", trade);
    const { data, error: e } = await query;
    if (e) { setError(true); return setRows([]); }
    setRows((data as PublicOpening[]) ?? []);
  }, [sb, trade]);
  useEffect(() => { void load(); }, [load]);

  // Signed in: start from the student's home state. Everyone can change it.
  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return;
      const { data } = await sb.from("students").select("id, state");
      const list = (data as { id: string; state: string }[]) ?? [];
      const st = (list.find((x) => x.id === current) ?? list[0])?.state;
      if (st && (OPENING_STATES as readonly string[]).includes(st)) setHome(st);
    })();
  }, [sb, current]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((o) => !tradeF || o.trade_slug === tradeF)
      .filter((o) => !kindF || o.kind === kindF)
      .filter((o) => !term || `${o.title} ${o.company_name} ${o.city} ${o.description} ${tradeName(o.trade_slug) ?? ""}`.toLowerCase().includes(term));
  }, [rows, tradeF, kindF, q]);
  const { home: near, elsewhere } = useMemo(() => sortOpenings(filtered, home), [filtered, home]);
  const tradesWithOpenings = useMemo(() => {
    const have = new Set((rows ?? []).map((o) => o.trade_slug));
    return TRADES.filter((t) => have.has(t.slug)).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  if (rows === null) return <p className="hint">Loading openings…</p>;
  if (compact && rows.length === 0) {
    return <p className="hint">No local openings for this trade yet. <a href="/trades/openings">See all openings</a>, or if you hire for this trade, <a href="/trades/post">post one free</a>.</p>;
  }

  const homeName = STATE_NAMES[home] ?? home;
  const elsewhereShown = showAll || compact ? elsewhere : elsewhere.slice(0, 12);

  return (
    <div className="openings">
      {!compact && (
        <section className="panel">
          <div className="row">
            <label className="field"><span>Search</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company, city or skill" /></label>
            {!trade && (
              <label className="field"><span>Trade</span>
                <select className="input" value={tradeF} onChange={(e) => setTradeF(e.target.value)}>
                  <option value="">All trades</option>
                  {tradesWithOpenings.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                </select>
              </label>
            )}
            <label className="field"><span>Kind</span>
              <select className="input" value={kindF} onChange={(e) => setKindF(e.target.value as OpeningKind | "")}>
                <option value="">All kinds</option>
                {Object.entries(OPENING_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>Home state</span>
              <select className="input" value={home} onChange={(e) => setHome(e.target.value)}>
                {OPENING_STATES.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s}</option>)}
              </select>
            </label>
          </div>
        </section>
      )}

      {error && <p className="note note-info">Openings couldn&apos;t load right now. Please try again later.</p>}

      <h3>In {homeName} ({near.length})</h3>
      {near.length === 0
        ? <p className="hint">No openings in {homeName} match yet. New ones are added as companies post them, so check back.</p>
        : <ul className="opening-list">{near.map((o) => <OpeningCard key={o.id} o={o} />)}</ul>}

      <h3>Across the country ({elsewhere.length})</h3>
      {elsewhere.length === 0
        ? <p className="hint">Nothing outside {homeName} matches yet.</p>
        : <ul className="opening-list">{elsewhereShown.map((o) => <OpeningCard key={o.id} o={o} />)}</ul>}
      {!showAll && !compact && elsewhere.length > elsewhereShown.length && (
        <button className="btn btn-ghost" style={{ width: "auto", marginTop: 12 }} onClick={() => setShowAll(true)}>Show all {elsewhere.length}</button>
      )}

      <details className="panel" style={{ marginTop: 16 }}>
        <summary><b>Staying safe</b></summary>
        <ul>{OPENING_SAFETY_TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
      </details>
    </div>
  );
}

/** Counts a details view or an Apply press, once per listing per visit. Numbers only, nothing about the student. */
function countOnce(id: string, kind: "view" | "apply") {
  const key = `st-opening-${kind}-${id}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode: count anyway */ }
  void supabase()?.rpc("count_opening", { p_id: id, p_kind: kind });
}

function OpeningCard({ o }: { o: PublicOpening }) {
  const tn = tradeName(o.trade_slug);
  return (
    <li className={`opening-card${o.featured ? " opening-featured" : ""}`}>
      {o.featured && <span className="pill pill-soon opening-featured-tag" title="Featured listings show first. Our team checks them the same way as every listing.">Featured</span>}
      <h3>{o.title}</h3>
      <p><b>{o.company_website ? <a href={o.company_website} target="_blank" rel="noreferrer nofollow">{o.company_name}</a> : o.company_name}</b> · {place(o)}</p>
      <p className="trade-tags">
        <span className="pill">{kindLabel(o.kind)}</span>
        {tn && <a className="pill" href={`/trades/${o.trade_slug}`}>{tn}</a>}
        <span className="pill">{ageLabel(o.min_age)}</span>
        {o.registered_verified && <span className="pill pill-ok" title="Our team found this program on apprenticeship.gov">Registered Apprenticeship ✓</span>}
      </p>
      {(o.pay || o.schedule) && <p className="hint">{[o.pay, o.schedule].filter(Boolean).join(" · ")}</p>}
      <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) countOnce(o.id, "view"); }}>
        <summary>Details and how to apply</summary>
        <p className="pre">{o.description}</p>
        {o.requirements && <><p><b>What you need</b></p><p className="pre">{o.requirements}</p></>}
        <p><b>How to apply</b></p>
        <p className="pre">{o.how_to_apply}</p>
        <p className="opening-actions" style={{ marginTop: 8 }}>
          {o.apply_url && <a className="btn btn-inline btn-sm" href={o.apply_url} target="_blank" rel="noreferrer nofollow" onClick={() => countOnce(o.id, "apply")}>Apply on their site</a>}
          <ReportButton id={o.id} />
        </p>
        <p className="hint small">
          Shows until {new Date(`${o.show_until}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Checked by our review team. Never pay to apply.
          {o.min_age < 18 ? " Under 18? Talk it over with a parent first." : ""}
        </p>
      </details>
    </li>
  );
}

function ReportButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (state === "sent") return <span className="hint">Thanks. Our team will take a look.</span>;
  if (!open) return <button className="btn btn-inline btn-sm btn-ghost" onClick={() => setOpen(true)}>Report a problem</button>;
  const send = async () => {
    const sb = supabase();
    if (!sb || why.trim().length < 3) return;
    setState("sending");
    const { error } = await sb.rpc("report_opening", { p_id: id, p_reason: why });
    setState(error ? "error" : "sent");
  };
  return (
    <span style={{ display: "grid", gap: 6, width: "100%" }}>
      <textarea className="input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What's wrong? For example, they asked for money, or the job is gone." maxLength={1000} aria-label="What's wrong with this listing" />
      <span className="opening-actions">
        <button className="btn btn-inline btn-sm" disabled={state === "sending" || why.trim().length < 3} onClick={() => void send()}>Send report</button>
        <button className="btn btn-inline btn-sm btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        {state === "error" && <span className="note note-err">That didn&apos;t send. Please email support@scholartasks.com.</span>}
      </span>
    </span>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { OPENING_LAW_LINKS, openingReviewFlags } from "@scholartasks/core";
import { friendly, supabase } from "../../../lib/supabase";
import { ageLabel, kindLabel, place, tradeName, type TeamOpening } from "../../../lib/openings";
import { NotConfigured, Page } from "../../ui";
import { ReviewNav } from "../review-kit";
import "../../trades/trades.css";

interface Report { opening_id: string; reason: string; created_at: string }

/**
 * Team review of listings companies post on /trades/post. Nothing shows to
 * students until it is approved here. The company is emailed the result.
 */
export default function ReviewOpeningsPage() {
  const sb = supabase();
  const title = "Review local openings";
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<TeamOpening[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<"waiting" | "live" | "closed">("waiting");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/openings");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const [o, r] = await Promise.all([
      sb.from("local_openings").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("opening_reports").select("opening_id, reason, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    if (o.error) setError(/exist|schema cache/i.test(o.error.message) ? "Run database update 50 in Supabase first." : friendly(o.error));
    setRows((o.data as TeamOpening[]) ?? []);
    setReports((r.data as Report[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, action: "approve" | "reject" | "hide", note: string, verified: boolean) => {
    if (!sb) return;
    setError(null); setMsg(null);
    const { data: s } = await sb.auth.getSession();
    const res = await fetch("/api/openings/review", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
      body: JSON.stringify({ id, action, note, verified }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string; emailed?: boolean } | null;
    if (!res?.ok || !body?.ok) return setError(body?.error ?? "That didn't save. Please try again.");
    setMsg(`${action === "approve" ? "Approved" : action === "reject" ? "Turned down" : "Taken down"}.${body.emailed ? " The company was emailed." : ""}`);
    void load();
  };

  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  const today = new Date().toISOString().slice(0, 10);
  const waiting = rows.filter((o) => o.status === "pending" || o.status === "hidden" && o.reports > 0);
  const live = rows.filter((o) => o.status === "approved" && o.show_until >= today);
  const closed = rows.filter((o) => !waiting.includes(o) && !live.includes(o));
  const shown = tab === "waiting" ? waiting : tab === "live" ? live : closed;

  return (
    <Page title={title}>
      <ReviewNav />
      <p className="hint">
        Companies post apprenticeships, training and jobs on <a href="/trades/post">/trades/post</a> without an account. Nothing shows to students until you approve it here,
        and the company gets an email either way. Three reports from students or parents take a listing down until you look again.
      </p>
      <details className="panel">
        <summary><b>What to check before approving</b></summary>
        <ul>
          <li>The company is real: website, Google, or the Georgia Secretary of State business search (or the state where the work is).</li>
          <li>No fees, deposits or private details (Social Security or bank numbers) asked of students.</li>
          <li>Under 18: duties are allowed for that age (no hazardous jobs barred by law), and hours fit teen rules. Under 16 has tighter hours and often a work permit.</li>
          <li>Equal opportunity: nothing that limits who can apply by race, sex, religion, national origin, disability or age (a legal minimum age is fine).</li>
          <li>Registered Apprenticeship: look it up on apprenticeship.gov before ticking Verified.</li>
        </ul>
        <p className="hint small">{OPENING_LAW_LINKS.map((l, i) => <span key={l.url}>{i ? " · " : ""}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)}</p>
      </details>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}

      <div className="chips trade-chips">
        <button className={`chip${tab === "waiting" ? " chip-on" : ""}`} onClick={() => setTab("waiting")}>To review ({waiting.length})</button>
        <button className={`chip${tab === "live" ? " chip-on" : ""}`} onClick={() => setTab("live")}>Live ({live.length})</button>
        <button className={`chip${tab === "closed" ? " chip-on" : ""}`} onClick={() => setTab("closed")}>Turned down or ended ({closed.length})</button>
      </div>

      {shown.length === 0
        ? <p className="hint">{tab === "waiting" ? "✓ Nothing to review." : "None yet."}</p>
        : <ul className="opening-list">{shown.map((o) => <TeamCard key={o.id} o={o} reports={reports.filter((r) => r.opening_id === o.id)} onDecide={decide} />)}</ul>}
    </Page>
  );
}

function TeamCard({ o, reports, onDecide }: { o: TeamOpening; reports: Report[]; onDecide: (id: string, a: "approve" | "reject" | "hide", note: string, verified: boolean) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(o.registered_verified);
  const [busy, setBusy] = useState(false);
  const flags = openingReviewFlags(o);
  const go = async (a: "approve" | "reject" | "hide") => { setBusy(true); await onDecide(o.id, a, note, verified); setBusy(false); };
  return (
    <li className="opening-card">
      <h3>{o.title} <span className="pill">{o.status === "pending" ? "Waiting" : o.status === "approved" ? "Live" : o.status === "hidden" ? "Taken down" : "Turned down"}</span></h3>
      <p><b>{o.company_name}</b> · {place(o)}{o.zip ? ` ${o.zip}` : ""} · sent {new Date(o.created_at).toLocaleDateString()}</p>
      <p className="trade-tags">
        <span className="pill">{kindLabel(o.kind)}</span>
        {tradeName(o.trade_slug) && <span className="pill">{tradeName(o.trade_slug)}</span>}
        <span className="pill">{ageLabel(o.min_age)}</span>
        {o.registered_apprenticeship && <span className="pill">Says Registered{o.rapids_number ? `: ${o.rapids_number}` : ""}</span>}
      </p>
      <p className="hint">Contact (private): {o.contact_name} · <a href={`mailto:${o.contact_email}`}>{o.contact_email}</a>{o.contact_phone ? ` · ${o.contact_phone}` : ""}
        {o.company_website && <> · <a href={o.company_website} target="_blank" rel="noreferrer nofollow">Website</a></>}</p>
      {flags.length > 0 && <ul className="opening-flags">{flags.map((f) => <li key={f}>{f}</li>)}</ul>}
      {reports.length > 0 && (
        <div className="note note-err"><b>{reports.length} report{reports.length > 1 ? "s" : ""}:</b>
          <ul style={{ margin: "4px 0 0" }}>{reports.map((r) => <li key={r.created_at}>{r.reason}</li>)}</ul></div>
      )}
      <details>
        <summary>Full listing</summary>
        {(o.pay || o.schedule) && <p className="hint">{[o.pay, o.schedule].filter(Boolean).join(" · ")}</p>}
        <p className="pre">{o.description}</p>
        {o.requirements && <><p><b>What they need</b></p><p className="pre">{o.requirements}</p></>}
        <p><b>How to apply</b></p><p className="pre">{o.how_to_apply}</p>
        {o.apply_url && <p><a href={o.apply_url} target="_blank" rel="noreferrer nofollow">{o.apply_url}</a></p>}
        <p className="hint">Shows until {o.show_until}{o.review_note ? ` · Last note: ${o.review_note}` : ""}</p>
      </details>
      {o.registered_apprenticeship && (
        <label className="check"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> I found it on <a href="https://www.apprenticeship.gov/partner-finder" target="_blank" rel="noreferrer">apprenticeship.gov</a>: show the Registered badge</label>
      )}
      <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the company (needed to turn it down; they get it by email)" maxLength={2000} aria-label="Note to the company" />
      <span className="opening-actions">
        {o.status !== "approved" && <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void go("approve")}>{o.status === "hidden" ? "Put back up" : "Approve"}</button>}
        {o.status === "pending" && <button className="btn btn-inline btn-sm btn-ghost" disabled={busy || note.trim().length < 5} onClick={() => void go("reject")}>Turn down</button>}
        {o.status === "approved" && <button className="btn btn-inline btn-sm btn-ghost" disabled={busy} onClick={() => void go("hide")}>Take down</button>}
      </span>
    </li>
  );
}

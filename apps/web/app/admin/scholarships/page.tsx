"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { chunks, DoneRow, ReviewNav, timeOf, type Done } from "../review-kit";
import { Finder } from "./finder";

interface Sch {
  id: string; kind: string; name: string; sponsor: string; url: string; summary: string; how_to_apply: string | null;
  amount_text: string; amount_max: number | null; deadline: string | null; deadline_text: string | null; min_gpa: number | null;
  other_requirements: string | null; status: "pending" | "approved" | "retired" | "found"; last_checked: string | null; college: string | null;
  reviewed_by: string | null; found_from?: string | null;
  [k: string]: unknown;
}
interface Update { id: string; scholarship_id: string; summary: string; proposed: Record<string, unknown>; sources: string[]; status: string; created_at: string }

const TABS = [["updates", "Changes to review"], ["found", "Found by AI"], ["pending", "Not yet verified"], ["approved", "Verified"], ["retired", "Retired"]] as const;
type Tab = (typeof TABS)[number][0];
const EDIT_FIELDS = [
  ["url", "Official link"], ["amount_text", "Amount (as families see it)"], ["amount_max", "Largest amount in dollars"],
  ["deadline", "This year's deadline"], ["deadline_text", "Deadline in words"], ["min_gpa", "Minimum GPA"],
  ["summary", "Summary"], ["how_to_apply", "How to apply"], ["other_requirements", "Other requirements"],
] as const;
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "(empty)" : Array.isArray(v) ? v.join(", ") : String(v));

export default function ScholarshipReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("updates");
  const [all, setAll] = useState<Sch[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, Done & { tab: Tab; name: string }>>({});
  useEffect(() => setDone({}), [tab]);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/scholarships");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const [a, u] = await Promise.all([
      sb.from("scholarships").select("*").order("name"),
      sb.from("scholarship_updates").select("id, scholarship_id, summary, proposed, sources, status, created_at").eq("status", "pending").order("created_at"),
    ]);
    if (a.error) setError(friendly(a.error));
    setAll((a.data as Sch[]) ?? []);
    setUpdates((u.data as Update[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const byId = useMemo(() => new Map(all.map((s) => [s.id, s])), [all]);
  const list = useMemo(() => all.filter((s) => s.status === tab && (!q || `${s.name} ${s.sponsor} ${s.college ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [all, tab, q]);
  const counts = { updates: updates.length, found: all.filter((s) => s.status === "found").length, pending: all.filter((s) => s.status === "pending").length, approved: all.filter((s) => s.status === "approved").length, retired: all.filter((s) => s.status === "retired").length };
  const today = new Date().toISOString().slice(0, 10);

  const save = async (s: Sch, patch: Record<string, unknown>, note: string) => {
    if (!sb) return;
    setError(null); setMsg(null);
    const { data: ses } = await sb.auth.getSession();
    const { error: e } = await sb.from("scholarships").update({ ...patch, reviewed_by: ses.session?.user.id, reviewed_at: new Date().toISOString() }).eq("id", s.id);
    if (e) return setError(friendly(e));
    const st = (patch.status as string | undefined) ?? s.status;
    setDone((d) => ({ ...d, [s.id]: { label: st === "retired" ? "Retired" : st === "approved" ? (s.status === "approved" ? "Saved and marked checked" : "Verified") : "Back on the list", at: new Date(), ok: st !== "retired", tab, name: s.name } }));
    setMsg(note);
    void load();
  };
  const decide = async (u: Update, accept: boolean) => {
    if (!sb) return;
    setError(null); setMsg(null);
    const s = byId.get(u.scholarship_id);
    if (accept && s) {
      // Accepting a checked change also verifies the award (unless it's being retired).
      const { data: ses } = await sb.auth.getSession();
      const extra = (s.status === "pending" || s.status === "found") && u.proposed.status !== "retired" ? { status: "approved", reviewed_by: ses.session?.user.id, reviewed_at: new Date().toISOString() } : {};
      const { error: e } = await sb.from("scholarships").update({ ...extra, ...u.proposed, last_checked: today }).eq("id", s.id);
      if (e) return setError(friendly(e));
    }
    const { error: e2 } = await sb.from("scholarship_updates").update({ status: accept ? "accepted" : "dismissed" }).eq("id", u.id);
    if (e2) return setError(friendly(e2));
    setDone((d) => ({ ...d, [u.id]: { label: accept ? "Changes accepted" : "Dismissed", at: new Date(), ok: accept, tab: "updates", name: s?.name ?? "Scholarship" } }));
    setMsg(accept ? `Updated ${s?.name ?? "the scholarship"}.` : "Dismissed.");
    void load();
  };
  /** Asks the AI to check one award now. Returns "verified", "review" (something to look at) or "error". */
  const runCheck = async (s: Sch, token: string): Promise<{ kind: "verified" | "review" | "error"; text: string }> => {
    try {
      const res = await fetch("/api/scholarships/check", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: s.id }) });
      const out = (await res.json().catch(() => null)) as { update?: Update; verified?: boolean; summary?: string; error?: string } | null;
      if (res.ok && out?.verified) return { kind: "verified", text: `${s.name} checked: nothing changed, so it's verified.` };
      if (!res.ok || !out?.update) return { kind: "error", text: out?.error ?? "The checker couldn't finish." };
      return { kind: "review", text: `Found changes for ${s.name}. See "Changes to review".` };
    } catch {
      return { kind: "error", text: "The checker couldn't finish." };
    }
  };
  const aiCheck = async (s: Sch) => {
    if (!sb) return;
    setBusy(s.id); setError(null); setMsg(null);
    const { data: ses } = await sb.auth.getSession();
    const r = await runCheck(s, ses.session?.access_token ?? "");
    if (r.kind === "error") setError(r.text); else setMsg(r.text);
    setBusy(null);
    void load();
  };

  // "Check all now": the AI checks every award not yet verified, a few at a time, while this page is open.
  const [bulk, setBulk] = useState<{ done: number; total: number; verified: number; review: number; failed: number } | null>(null);
  const stopRef = useRef(false);
  const checkAll = async () => {
    if (!sb || bulk) return;
    setError(null); setMsg(null);
    stopRef.current = false;
    const waiting = new Set(updates.map((u) => u.scholarship_id));
    const queue = all.filter((s) => s.status === (tab === "found" ? "found" : "pending") && !waiting.has(s.id));
    const tally = { done: 0, total: queue.length, verified: 0, review: 0, failed: 0 };
    setBulk({ ...tally });
    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const s = queue.shift()!;
        const { data: ses } = await sb.auth.getSession();
        const r = await runCheck(s, ses.session?.access_token ?? "");
        tally.done++;
        if (r.kind === "verified") tally.verified++; else if (r.kind === "review") tally.review++; else tally.failed++;
        setBulk({ ...tally });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    setBulk(null);
    setMsg(`Checked ${tally.done}: ${tally.verified} verified automatically, ${tally.review} to review${tally.failed ? `, ${tally.failed} couldn't be checked (try again later)` : ""}.`);
    void load();
  };

  // "Accept all": two taps, so one stray tap can't change many awards.
  const [confirmAll, setConfirmAll] = useState(false);
  const acceptAll = async () => {
    if (!sb) return;
    if (!confirmAll) { setConfirmAll(true); return; }
    setConfirmAll(false); setError(null); setMsg(null);
    const { data: ses } = await sb.auth.getSession();
    const me = ses.session?.user.id ?? null;
    let n = 0;
    for (const u of updates) {
      const s = byId.get(u.scholarship_id);
      if (Object.keys(u.proposed).length && s) {
        // Accepting a checked change also counts as verifying the award (unless it's being retired).
        const extra = (s.status === "pending" || s.status === "found") && u.proposed.status !== "retired" ? { status: "approved", reviewed_by: me, reviewed_at: new Date().toISOString() } : {};
        const { error: e } = await sb.from("scholarships").update({ ...extra, ...u.proposed, last_checked: today }).eq("id", s.id);
        if (e) { setError(friendly(e)); break; }
      }
      const { error: e2 } = await sb.from("scholarship_updates").update({ status: Object.keys(u.proposed).length ? "accepted" : "dismissed" }).eq("id", u.id);
      if (e2) { setError(friendly(e2)); break; }
      n++;
    }
    setMsg(`Accepted ${n} change${n === 1 ? "" : "s"}.`);
    void load();
  };

  // "Verify all": marks every award still waiting as verified, without the AI reading each site.
  const [confirmVerify, setConfirmVerify] = useState(false);
  const verifyAll = async () => {
    if (!sb) return;
    if (!confirmVerify) return setConfirmVerify(true);
    setConfirmVerify(false); setError(null); setMsg(null);
    const { data: ses } = await sb.auth.getSession();
    const ids = list.map((x) => x.id);
    const at = new Date();
    for (const part of chunks(ids)) {
      const { error: e } = await sb.from("scholarships").update({ status: "approved", last_checked: today, reviewed_by: ses.session?.user.id, reviewed_at: at.toISOString() }).in("id", part);
      if (e) { setError(friendly(e)); break; }
    }
    setMsg(`Verified ${ids.length} award${ids.length === 1 ? "" : "s"}.`);
    void load();
  };

  const title = "Scholarship list review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <ReviewNav />
      <p className="hint" style={{ marginTop: -8 }}>
        Every scholarship and grant families see. Every Monday (and Thursdays too from September to March) the AI checker reads 25 official sites, oldest first. If an award is still offered and nothing changed, it&apos;s verified automatically. Anything that changed, or that the AI couldn&apos;t confirm, waits under &ldquo;Changes to review&rdquo;, and nothing changes for families until you accept it. Every Tuesday the AI finder also looks for new awards on official sites; they wait under &ldquo;Found by AI&rdquo;, hidden from families, until the checker confirms each one.
      </p>
      <div className="tabs" role="tablist" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label} <span className="sch-count">{counts[k]}</span></button>)}
      </div>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}

      {tab === "updates" && (
        <>
          {Object.entries(done).filter(([, d]) => d.tab === "updates").map(([id, d]) => <DoneRow key={id} title={d.name} done={d} />)}
          {updates.length === 0 && <p className="hint">✓ No changes waiting. The weekly check adds them here.</p>}
          {updates.length > 1 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <button className="btn btn-inline" onClick={() => void acceptAll()}>{confirmAll ? `Tap again to accept all ${updates.length}` : `Accept all ${updates.length}`}</button>
              {confirmAll && <button className="btn btn-ghost btn-inline" onClick={() => setConfirmAll(false)}>Cancel</button>}
              <span className="hint" style={{ fontSize: 13 }}>Or look at each one below.</span>
            </div>
          )}
          {updates.map((u) => {
            const s = byId.get(u.scholarship_id);
            return (
              <section key={u.id} className="panel review">
                <b>{s?.name ?? "Scholarship"}</b>
                <span className="hint" style={{ fontSize: 12 }}>Found {new Date(u.created_at).toLocaleDateString()}</span>
                <p style={{ margin: 0 }}>{u.summary}</p>
                {Object.keys(u.proposed).length > 0 && (
                  <table className="sch-diff"><tbody>
                    {Object.entries(u.proposed).map(([k, v]) => <tr key={k}><th>{k.replace(/_/g, " ")}</th><td className="sch-missing">{show(s?.[k])}</td><td>→</td><td className="sch-met">{show(v)}</td></tr>)}
                  </tbody></table>
                )}
                {u.sources.length > 0 && <p className="hint" style={{ margin: 0, fontSize: 13 }}>Sources: {u.sources.map((x, i) => <a key={x} href={x} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8 }}>{i + 1} ↗</a>)}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  {Object.keys(u.proposed).length > 0 && <button className="btn btn-inline" onClick={() => void decide(u, true)}>Accept changes</button>}
                  <button className="btn btn-ghost btn-inline" onClick={() => void decide(u, false)}>{Object.keys(u.proposed).length ? "Dismiss" : "OK"}</button>
                </div>
              </section>
            );
          })}
        </>
      )}

      {tab !== "updates" && (
        <>
          <div className="field" style={{ maxWidth: 360 }}><label htmlFor="sch-q">Search</label><input id="sch-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, organization or college" /></div>
          {tab === "found" && <Finder onFound={load} />}
          {(tab === "pending" || tab === "found") && counts[tab] > 0 && (
            <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {bulk ? (
                <>
                  <span><b>Checking {bulk.done} of {bulk.total}…</b> {bulk.verified} verified, {bulk.review} to review. Keep this page open.</span>
                  <button className="btn btn-ghost btn-inline btn-sm" onClick={() => { stopRef.current = true; }}>Stop</button>
                </>
              ) : (
                <>
                  {list.length > 1 && tab === "pending" && (
                    <>
                      <button className="btn btn-inline" onClick={() => void verifyAll()}>{confirmVerify ? `Tap again to verify all ${list.length}` : `✓ Verify all ${list.length}${q ? " shown" : ""}`}</button>
                      {confirmVerify && <button className="btn btn-ghost btn-inline" onClick={() => setConfirmVerify(false)}>Cancel</button>}
                      <span className="hint" style={{ fontSize: 13, flexBasis: "100%" }}>Verify all marks them checked without reading each site. Or let the AI read each site first:</span>
                    </>
                  )}
                  <button className="btn btn-inline" onClick={() => void checkAll()}>🤖 Check all {counts[tab]} now</button>
                  <span className="hint" style={{ fontSize: 13 }}>The AI reads each official site. Unchanged ones are verified for you. Takes about 20 minutes with this page open, and costs about ${Math.max(1, Math.round(counts[tab] * 0.005))} in AI use.</span>
                </>
              )}
            </div>
          )}
          {Object.entries(done).filter(([id, d]) => d.tab === tab && byId.get(id)?.status !== tab).map(([id, d]) => <DoneRow key={id} title={d.name} done={d} onUndo={undefined} />)}
          {list.length === 0 && <p className="hint">Nothing here.</p>}
          {list.map((s) => <Item key={s.id} s={s} busy={busy === s.id} saved={done[s.id]?.at} onSave={save} onCheck={aiCheck} today={today} />)}
          {tab === "pending" && <AddForm onAdded={load} />}
        </>
      )}
    </Page>
  );
}

function Item({ s, busy, saved, onSave, onCheck, today }: { s: Sch; busy: boolean; saved?: Date; today: string; onSave: (s: Sch, p: Record<string, unknown>, note: string) => Promise<void>; onCheck: (s: Sch) => Promise<void> }) {
  const [edit, setEdit] = useState<Record<string, string>>({});
  const val = (k: string) => edit[k] ?? (s[k] == null ? "" : String(s[k]));
  const patch = () => {
    const p: Record<string, unknown> = {};
    for (const [k] of EDIT_FIELDS) {
      if (!(k in edit)) continue;
      const v = edit[k]!.trim();
      p[k] = v === "" ? null : k === "amount_max" ? Number(v) : k === "min_gpa" ? Number(v) : v;
    }
    return p;
  };
  return (
    <details className="panel review">
      <summary>
        <b>{s.name}</b> <span className="hint" style={{ fontSize: 13 }}>· {s.kind === "grant" ? "Grant" : "Scholarship"} · {s.amount_text} · {s.deadline ?? s.deadline_text ?? "no deadline"} · checked {s.last_checked ?? "never"}{s.status === "approved" && !s.reviewed_by ? " · verified by AI" : ""}{s.found_from ? ` · ${s.found_from}` : ""}</span>
        {saved && <span className="pill pill-ok" role="status">✓ Saved {timeOf(saved)}</span>}
        {Object.keys(edit).length > 0 && <span className="unsaved"> ● Not saved yet</span>}
      </summary>
      <p className="hint" style={{ margin: "8px 0" }}>Given by {s.sponsor}{s.college ? ` · ${s.college}` : ""} · <a href={s.url} target="_blank" rel="noopener noreferrer">Official site ↗</a></p>
      {EDIT_FIELDS.map(([k, label]) => (
        <div key={k} className="field" style={{ margin: "0 0 8px" }}>
          <label htmlFor={`${k}-${s.id}`}>{label}</label>
          {k === "summary" || k === "how_to_apply" || k === "other_requirements"
            ? <textarea id={`${k}-${s.id}`} className="input" rows={2} value={val(k)} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
            : <input id={`${k}-${s.id}`} className="input" type={k === "deadline" ? "date" : "text"} value={val(k)} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-inline btn-sm" onClick={async () => { await onSave(s, { ...patch(), status: "approved", last_checked: today }, `${s.name} is verified.`); setEdit({}); }}>{s.status === "approved" ? "Save and mark checked" : "Verify"}</button>
        <button className="btn btn-ghost btn-inline btn-sm" disabled={busy} onClick={() => void onCheck(s)}>{busy ? "Checking the official site…" : "🤖 Check with AI"}</button>
        {s.status !== "retired"
          ? <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onSave(s, { status: "retired" }, `${s.name} retired. Families no longer see it.`)}>Retire</button>
          : <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onSave(s, { status: "pending" }, `${s.name} is back on the list.`)}>Bring back</button>}
      </div>
    </details>
  );
}

function AddForm({ onAdded }: { onAdded: () => void }) {
  const sb = supabase();
  const [f, setF] = useState({ name: "", sponsor: "", url: "", summary: "", amount_text: "" });
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    if (!sb) return;
    setErr(null);
    const { error } = await sb.from("scholarships").insert({ ...f, url: f.url.trim() });
    if (error) return setErr(friendly(error));
    setF({ name: "", sponsor: "", url: "", summary: "", amount_text: "" });
    onAdded();
  };
  return (
    <details className="panel" style={{ marginTop: 16 }}>
      <summary><b>Add a scholarship</b></summary>
      <p className="hint">Add the basics, then use &ldquo;Check with AI&rdquo; to fill in the deadline and rules from the official site.</p>
      {(["name", "sponsor", "url", "amount_text", "summary"] as const).map((k) => (
        <div key={k} className="field" style={{ margin: "0 0 8px" }}>
          <label htmlFor={`new-${k}`}>{{ name: "Name", sponsor: "Given by (organization)", url: "Official link (https://…)", amount_text: "Amount", summary: "Summary" }[k]}</label>
          <input id={`new-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      <button className="btn btn-inline" onClick={() => void add()}>Add</button>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </details>
  );
}

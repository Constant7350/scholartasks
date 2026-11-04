"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

interface Sch {
  id: string; kind: string; name: string; sponsor: string; url: string; summary: string; how_to_apply: string | null;
  amount_text: string; amount_max: number | null; deadline: string | null; deadline_text: string | null; min_gpa: number | null;
  other_requirements: string | null; status: "pending" | "approved" | "retired"; last_checked: string | null; college: string | null;
  [k: string]: unknown;
}
interface Update { id: string; scholarship_id: string; summary: string; proposed: Record<string, unknown>; sources: string[]; status: string; created_at: string }

const TABS = [["updates", "Changes to review"], ["pending", "Not yet verified"], ["approved", "Verified"], ["retired", "Retired"]] as const;
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
  const counts = { updates: updates.length, pending: all.filter((s) => s.status === "pending").length, approved: all.filter((s) => s.status === "approved").length, retired: all.filter((s) => s.status === "retired").length };
  const today = new Date().toISOString().slice(0, 10);

  const save = async (s: Sch, patch: Record<string, unknown>, note: string) => {
    if (!sb) return;
    setError(null); setMsg(null);
    const { data: ses } = await sb.auth.getSession();
    const { error: e } = await sb.from("scholarships").update({ ...patch, reviewed_by: ses.session?.user.id, reviewed_at: new Date().toISOString() }).eq("id", s.id);
    if (e) return setError(friendly(e));
    setMsg(note);
    void load();
  };
  const decide = async (u: Update, accept: boolean) => {
    if (!sb) return;
    setError(null); setMsg(null);
    const s = byId.get(u.scholarship_id);
    if (accept && s) {
      const { error: e } = await sb.from("scholarships").update({ ...u.proposed, last_checked: today }).eq("id", s.id);
      if (e) return setError(friendly(e));
    }
    const { error: e2 } = await sb.from("scholarship_updates").update({ status: accept ? "accepted" : "dismissed" }).eq("id", u.id);
    if (e2) return setError(friendly(e2));
    setMsg(accept ? `Updated ${s?.name ?? "the scholarship"}.` : "Dismissed.");
    void load();
  };
  const aiCheck = async (s: Sch) => {
    if (!sb) return;
    setBusy(s.id); setError(null); setMsg(null);
    try {
      const { data: ses } = await sb.auth.getSession();
      const res = await fetch("/api/scholarships/check", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ses.session?.access_token ?? ""}` }, body: JSON.stringify({ id: s.id }) });
      const out = (await res.json().catch(() => null)) as { update?: Update; error?: string } | null;
      if (!res.ok || !out?.update) throw new Error(out?.error ?? "The checker couldn't finish.");
      setMsg(Object.keys(out.update.proposed).length ? `Found changes for ${s.name}. See "Changes to review".` : `${s.name}: ${out.update.summary}`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The checker couldn't finish.");
    } finally {
      setBusy(null);
    }
  };

  const title = "Scholarship list review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        Every scholarship and grant families see. Every Monday (and Thursdays too from September to March) the AI checker reads 25 official sites, oldest first, and lists any changes under &ldquo;Changes to review&rdquo;. Nothing changes for families until you accept it. You can also check one now, or edit it yourself, and mark it verified.
      </p>
      <div className="tabs" role="tablist" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label} <span className="sch-count">{counts[k]}</span></button>)}
      </div>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}

      {tab === "updates" && (
        <>
          {updates.length === 0 && <p className="hint">No changes waiting. The weekly check adds them here.</p>}
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
          <div className="field" style={{ maxWidth: 360 }}><label htmlFor="sch-q">Search</label><input id="sch-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, sponsor or college" /></div>
          {list.length === 0 && <p className="hint">Nothing here.</p>}
          {list.map((s) => <Item key={s.id} s={s} busy={busy === s.id} onSave={save} onCheck={aiCheck} today={today} />)}
          {tab === "pending" && <AddForm onAdded={load} />}
        </>
      )}
    </Page>
  );
}

function Item({ s, busy, onSave, onCheck, today }: { s: Sch; busy: boolean; today: string; onSave: (s: Sch, p: Record<string, unknown>, note: string) => Promise<void>; onCheck: (s: Sch) => Promise<void> }) {
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
        <b>{s.name}</b> <span className="hint" style={{ fontSize: 13 }}>· {s.kind === "grant" ? "Grant" : "Scholarship"} · {s.amount_text} · {s.deadline ?? s.deadline_text ?? "no deadline"} · checked {s.last_checked ?? "never"}</span>
      </summary>
      <p className="hint" style={{ margin: "8px 0" }}>{s.sponsor}{s.college ? ` · ${s.college}` : ""} · <a href={s.url} target="_blank" rel="noopener noreferrer">Official site ↗</a></p>
      {EDIT_FIELDS.map(([k, label]) => (
        <div key={k} className="field" style={{ margin: "0 0 8px" }}>
          <label htmlFor={`${k}-${s.id}`}>{label}</label>
          {k === "summary" || k === "how_to_apply" || k === "other_requirements"
            ? <textarea id={`${k}-${s.id}`} className="input" rows={2} value={val(k)} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
            : <input id={`${k}-${s.id}`} className="input" type={k === "deadline" ? "date" : "text"} value={val(k)} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-inline btn-sm" onClick={() => void onSave(s, { ...patch(), status: "approved", last_checked: today }, `${s.name} is verified.`)}>{s.status === "approved" ? "Save and mark checked" : "Verify"}</button>
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
          <label htmlFor={`new-${k}`}>{{ name: "Name", sponsor: "Sponsor", url: "Official link (https://…)", amount_text: "Amount", summary: "Summary" }[k]}</label>
          <input id={`new-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      <button className="btn btn-inline" onClick={() => void add()}>Add</button>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </details>
  );
}

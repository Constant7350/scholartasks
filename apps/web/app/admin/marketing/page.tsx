"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { StatusPill, whenOf } from "../review-kit";
import { ALL_STEPS, AUDIENCE, BUSINESS, CALENDAR, CHANNELS, MESSAGES, PHASES, SOURCES, SUMMARY, type Step } from "./plan";

/**
 * Team-only marketing plan and business plan, with steps the team ticks off.
 * The words live in ./plan.ts; progress lives in the marketing_steps table (database update 38).
 */
type Status = "todo" | "doing" | "done" | "skip";
interface Saved { status: Status; note: string | null; updated_at: string }
type Numbers = Record<"families" | "families_30d" | "students" | "paying_families" | "schools" | "school_students" | "ai_users_7d", number>;

const TABS = [
  ["steps", "Steps to follow"],
  ["audience", "Who we're for"],
  ["message", "What we say"],
  ["channels", "Where we market"],
  ["business", "Business plan"],
] as const;
type Tab = (typeof TABS)[number][0];

const LABEL: Record<Status, string> = { todo: "To do", doing: "Doing", done: "Done", skip: "Skipped" };

export default function MarketingPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  const [nums, setNums] = useState<Numbers | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>("steps");
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    try { const t = localStorage.getItem("st-marketing-tab"); if (TABS.some(([k]) => k === t)) setTabState(t as Tab); } catch { /* private mode */ }
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem("st-marketing-tab", t); } catch { /* private mode */ }
  };

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/marketing");
    const a = await sb.rpc("is_app_admin");
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [steps, n] = await Promise.all([
      sb.from("marketing_steps").select("step_id, status, note, updated_at"),
      sb.rpc("marketing_numbers"),
    ]);
    if (steps.error) {
      if (/marketing_steps/.test(steps.error.message)) setNeedsUpdate(true); else setError(friendly(steps.error));
    } else {
      const m: Record<string, Saved> = {};
      for (const r of steps.data ?? []) m[r.step_id] = { status: r.status, note: r.note, updated_at: r.updated_at };
      setSaved(m);
    }
    if (!n.error) setNums(n.data as Numbers);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Marketing and business plan"><NotConfigured /></Page>;
  if (admin === undefined) return <Page title="Marketing and business plan"><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title="Marketing and business plan"><p className="note note-err">This page is for the ScholarTasks team.</p></Page>;

  const save = async (id: string, status: Status, note: string | null) => {
    setError(null);
    const before = saved[id];
    setSaved((m) => ({ ...m, [id]: { status, note, updated_at: new Date().toISOString() } }));
    const { error: e } = await sb.rpc("save_marketing_step", { p_step: id, p_status: status, p_note: note ?? "" });
    if (e) {
      setError(/save_marketing_step/.test(e.message) ? "Run database update 38 in Supabase first, then your ticks will be saved." : friendly(e));
      setSaved((m) => { const c = { ...m }; if (before) c[id] = before; else delete c[id]; return c; });
    }
  };

  const statusOf = (id: string): Status => saved[id]?.status ?? "todo";
  const finished = ALL_STEPS.filter((s) => ["done", "skip"].includes(statusOf(s.id))).length;
  const next = ALL_STEPS.find((s) => !["done", "skip"].includes(statusOf(s.id)));

  return (
    <Page title="Marketing and business plan">
      <p className="hint">{SUMMARY.oneLine} Follow the steps in order, tick them off, and check the numbers each month.</p>
      {needsUpdate && <p className="note" role="status">Run <b>database update 38</b> in Supabase so the team's ticks and notes are saved. You can read the whole plan now.</p>}
      {error && <p className="note note-err" role="alert">{error}</p>}

      <section className="panel">
        <h2>Our numbers today</h2>
        <div className="mk-stats">
          <Stat label="Families" value={nums?.families} sub={nums ? `${nums.families_30d} new in 30 days` : undefined} />
          <Stat label="Paying families" value={nums?.paying_families} />
          <Stat label="Students" value={nums?.students} />
          <Stat label="Schools" value={nums?.schools} sub={nums ? `${nums.school_students} students connected` : undefined} />
          <Stat label="Used AI this week" value={nums?.ai_users_7d} />
        </div>
        <div className="bars" style={{ marginTop: 14 }}>
          <div className="bar-row bar-strong">
            <span className="bar-label">Plan progress</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(finished / ALL_STEPS.length) * 100}%` }} /></span>
            <span className="bar-value">{finished} of {ALL_STEPS.length} steps</span>
          </div>
        </div>
        {next && <p style={{ margin: "12px 0 0" }}><b>Next step:</b> {next.title} <span className="hint">({next.who}, {next.when})</span></p>}
      </section>

      <nav className="review-nav" aria-label="Plan sections">
        {TABS.map(([k, label]) => (
          <a key={k} href={`#${k}`} aria-current={tab === k ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(k); }}>{label}</a>
        ))}
      </nav>

      {tab === "steps" && (
        <>
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show finished steps
          </label>
          {PHASES.map((p) => {
            const done = p.steps.filter((s) => ["done", "skip"].includes(statusOf(s.id))).length;
            const shown = p.steps.filter((s) => showDone || !["done", "skip"].includes(statusOf(s.id)));
            return (
              <section key={p.id} className="panel">
                <h2>{p.name} <span className="hint" style={{ fontWeight: 400 }}>· {p.dates}</span></h2>
                <p className="hint" style={{ marginTop: -4 }}><b>Goal:</b> {p.goal} · {done} of {p.steps.length} done</p>
                {shown.length === 0 && <p className="hint">✓ Every step here is finished.</p>}
                {shown.map((s) => <StepRow key={s.id} step={s} saved={saved[s.id]} onSave={(st, note) => void save(s.id, st, note)} />)}
              </section>
            );
          })}
        </>
      )}

      {tab === "audience" && (
        <>
          <section className="panel">
            <h2>Why families need this</h2>
            <ul className="mk-list">{SUMMARY.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <p style={{ marginBottom: 0 }}><b>Our promise:</b> {SUMMARY.promise}</p>
          </section>
          {AUDIENCE.map((a) => (
            <section key={a.who} className="panel">
              <h2>{a.icon} {a.who}</h2>
              <p>{a.detail}</p>
              <p><b>Where to find them:</b> {a.where}</p>
              <p style={{ marginBottom: 0 }}><b>What they want:</b> {a.want}</p>
            </section>
          ))}
        </>
      )}

      {tab === "message" && (
        <section className="panel">
          <h2>Seven things we say everywhere</h2>
          <p className="hint">Use the same words on the website, in the stores, in posts and at parent nights. Say "Fund", not "Pay", in headings, and never use a real child's name (the sample student is Emma).</p>
          <ol className="mk-list">{MESSAGES.map((m) => <li key={m.title}><b>{m.title}.</b> {m.text}</li>)}</ol>
        </section>
      )}

      {tab === "channels" && (
        <>
          <section className="panel">
            <h2>Where we market, best first</h2>
            <p className="hint">Start at the top. Cheap, trusted channels first; paid ads only once we know what a paying family is worth.</p>
            <ol className="mk-list">{CHANNELS.map((c) => <li key={c.name}><b>{c.name}</b> <span className="pill">{c.cost} cost</span><br />{c.why}</li>)}</ol>
          </section>
          <section className="panel">
            <h2>When families are listening</h2>
            <ul className="mk-list">{CALENDAR.map((c) => <li key={c.months}><b>{c.months}:</b> {c.focus}</li>)}</ul>
          </section>
        </>
      )}

      {tab === "business" && (
        <>
          <section className="panel">
            <h2>How ScholarTasks makes money</h2>
            <p className="hint">Prices are not final until the real running cost is measured.</p>
            <ul className="mk-list">{BUSINESS.model.map((m) => <li key={m.name}><b>{m.name}:</b> {m.text}</li>)}</ul>
          </section>
          <section className="panel">
            <h2>Costs and break-even</h2>
            <ul className="mk-list">{BUSINESS.costs.map((c) => <li key={c}>{c}</li>)}</ul>
          </section>
          <section className="panel">
            <h2>Opening more states</h2>
            <ul className="mk-list">{BUSINESS.expansion.map((e) => <li key={e}>{e}</li>)}</ul>
          </section>
          <section className="panel">
            <h2>Goals</h2>
            <div className="mk-table-wrap">
              <table className="mk-table">
                <thead><tr><th>By</th><th>Families</th><th>Paying</th><th>Schools</th></tr></thead>
                <tbody>{BUSINESS.goals.map((g) => <tr key={g.by}><td>{g.by}</td><td>{g.families.toLocaleString()}</td><td>{g.paying}</td><td>{g.schools}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>Why we win</h2>
            <ul className="mk-list">{BUSINESS.edges.map((e) => <li key={e}>{e}</li>)}</ul>
            <h2 style={{ marginTop: 16 }}>What to close next</h2>
            <ul className="mk-list">{BUSINESS.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
          </section>
          <section className="panel">
            <h2>Risks and what we do about them</h2>
            <ul className="mk-list">{BUSINESS.risks.map((r) => <li key={r.risk}><b>{r.risk}.</b> {r.plan}</li>)}</ul>
          </section>
          <section className="panel">
            <h2>Sources</h2>
            <ul className="mk-list">{SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul>
          </section>
        </>
      )}
    </Page>
  );
}

function Stat({ label, value, sub }: { label: string; value?: number; sub?: string }) {
  return (
    <div className="mk-stat">
      <span className="mk-stat-value">{value == null ? "–" : value.toLocaleString()}</span>
      <span className="mk-stat-label">{label}</span>
      {sub && <span className="hint">{sub}</span>}
    </div>
  );
}

function StepRow({ step, saved, onSave }: { step: Step; saved?: Saved; onSave: (s: Status, note: string | null) => void }) {
  const status = saved?.status ?? "todo";
  const [note, setNote] = useState(saved?.note ?? "");
  useEffect(() => setNote(saved?.note ?? ""), [saved?.note]);
  const pill = status === "done" ? "ok" : status === "doing" ? "wait" : "off";
  return (
    <div className={`mk-step ${status === "done" || status === "skip" ? "mk-step-done" : ""}`}>
      <div className="mk-step-head">
        <b>{status === "done" ? "✓ " : ""}{step.title}</b>
        <StatusPill status={pill} label={LABEL[status]} />
      </div>
      <p className="hint" style={{ margin: "4px 0" }}>{step.who} · {step.when}{step.claude ? " · Claude can do this: just ask" : ""}</p>
      <p style={{ margin: "4px 0 8px" }}>{step.how}</p>
      <div className="share-row" style={{ alignItems: "center" }}>
        {(["todo", "doing", "done"] as Status[]).map((s) => (
          <button key={s} className={`btn btn-inline btn-sm ${status === s ? "" : "btn-ghost"}`} aria-pressed={status === s} onClick={() => onSave(s, note || null)}>{LABEL[s]}</button>
        ))}
        <button className={`btn btn-inline btn-sm ${status === "skip" ? "" : "btn-ghost"}`} aria-pressed={status === "skip"} onClick={() => onSave("skip", note || null)}>Skip</button>
        <input
          className="input input-sm" style={{ flex: "1 1 180px", minWidth: 0 }} placeholder="Note (saved when you click away)" maxLength={1000}
          value={note} onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if ((saved?.note ?? "") !== note) onSave(status, note || null); }}
          aria-label={`Note for ${step.title}`}
        />
      </div>
      {saved && <p className="hint" style={{ margin: "6px 0 0", fontSize: 12 }}>Updated {whenOf(saved.updated_at)}</p>}
    </div>
  );
}

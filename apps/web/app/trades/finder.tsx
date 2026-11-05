"use client";

import { useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { STATE_NAMES, dollars, tradeBySlug } from "../../lib/trades";

interface College { id: number; name: string; city: string | null; state: string; url: string | null; ownership: number; tuition_in: number | null; tuition_out: number | null; degree: number | null }
interface Row { college_id: number; cip: string; level: number; grads: number; earn_1yr: number | null; online: boolean; college: College }
interface School { college: College; grads: number; levels: Set<number>; earn: number | null; online: boolean }

const KIND: Record<number, string> = { 1: "Public", 2: "Private nonprofit", 3: "For-profit" };
const LEVEL: Record<number, string> = { 1: "Certificate", 2: "Associate degree" };

function combine(rows: Row[]): School[] {
  const by = new Map<number, School>();
  for (const r of rows) {
    const s = by.get(r.college_id) ?? { college: r.college, grads: 0, levels: new Set<number>(), earn: null, online: true };
    s.grads += r.grads ?? 0;
    s.levels.add(r.level);
    if (r.earn_1yr != null) s.earn = Math.max(s.earn ?? 0, r.earn_1yr);
    s.online = s.online && r.online;
    by.set(r.college_id, s);
  }
  return [...by.values()].sort((a, b) => b.grads - a.grads);
}

/**
 * Where to train: schools that teach this trade, in the chosen state first
 * and then across the U.S. (federal College Scorecard data: every school
 * that takes federal student aid). Works without signing in.
 */
export function TrainingFinder({ slug }: { slug: string }) {
  const sb = supabase();
  const t = tradeBySlug(slug)!;
  const [home, setHome] = useState("GA");
  const [state, setState] = useState("GA");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicOnly, setPublicOnly] = useState(false);
  const [all, setAll] = useState(false);

  // A signed-in student's home state decides the starting state and the HOPE note.
  useEffect(() => {
    if (!sb) return;
    void sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: st } = await sb.from("students").select("state").limit(1);
      const s = (st as { state: string }[] | null)?.[0]?.state;
      if (s) { setHome(s); setState(s); }
    });
  }, [sb]);

  useEffect(() => {
    if (!sb || t.cips.length === 0) return;
    let stale = false;
    setRows(null); setError(null);
    void sb.rpc("programs_for", { p_cips: t.cips, p_levels: [1, 2], p_state: state, p_online: false, p_limit: 250 }).then(({ data, error: e }) => {
      if (stale) return;
      if (e) return setError(friendly(e));
      setRows((data as Row[]) ?? []);
    });
    return () => { stale = true; };
  }, [sb, t.cips, state]);

  const schools = useMemo(() => combine(rows ?? []).filter((s) => !publicOnly || s.college.ownership === 1), [rows, publicOnly]);
  const inState = schools.filter((s) => s.college.state === state);
  const elsewhere = schools.filter((s) => s.college.state !== state);
  const stateName = STATE_NAMES[state] ?? state;

  if (t.cips.length === 0) {
    return (
      <section className="panel">
        <h2>Where to train</h2>
        <p className="hint">This trade is learned through apprenticeships, not schools. Use the apprenticeship links below to find programs in Georgia or any other state.</p>
      </section>
    );
  }

  const list = (items: School[], limit: number) => (
    <ol className="items trade-schools">
      {items.slice(0, limit).map((s) => {
        const c = s.college;
        const away = c.state !== home;
        return (
          <li key={c.id}>
            <div className="item-main">
              <b>{c.url ? <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`} target="_blank" rel="noreferrer">{c.name}</a> : c.name}</b>
              <span className="hint">{c.city ? `${c.city}, ` : ""}{c.state} · {KIND[c.ownership] ?? ""} · {[...s.levels].sort().map((l) => LEVEL[l]).filter(Boolean).join(" and ")}{s.grads ? ` · about ${s.grads} graduates a year` : ""}</span>
              <span className="hint">
                Tuition: {away ? `${dollars(c.tuition_out)} a year out of state` : `${dollars(c.tuition_in)} a year in state`}
                {s.earn ? ` · graduates earn about ${dollars(s.earn)} a year after` : ""}
              </span>
              <span className="trade-tags">
                {c.ownership === 3 && <span className="pill pill-soon">For-profit: compare cost and job results</span>}
                {away && home === "GA" && <span className="pill pill-late">HOPE does not pay here</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );

  return (
    <section className="panel" id="where">
      <h2>Where to train</h2>
      <p className="hint">Schools that teach this trade (certificates and two-year degrees), from federal College Scorecard data. Georgia shows first, but you can look anywhere.</p>
      <div className="trade-filters">
        <label className="check">State{" "}
          <select id="finder-state" value={state} onChange={(e) => setState(e.target.value)}>
            {Object.entries(STATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="check"><input id="finder-public" type="checkbox" checked={publicOnly} onChange={(e) => setPublicOnly(e.target.checked)} /> Public colleges only</label>
      </div>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {!rows && !error && <p className="hint">Loading schools…</p>}
      {rows && (
        <>
          <h3>In {stateName} ({inState.length})</h3>
          {inState.length ? list(inState, all ? 100 : 12) : <p className="hint">No schools in {stateName} report this program. Look at other states below, or at apprenticeships.</p>}
          {inState.length > 12 && !all && <button className="btn-link" onClick={() => setAll(true)}>Show all {inState.length}</button>}
          <h3>Across the U.S.: the biggest programs</h3>
          {home === "GA" && <p className="hint">Training outside Georgia: HOPE money only works at Georgia schools, and out-of-state tuition is usually 2 to 4 times higher. Pell Grants and most trade scholarships work anywhere.</p>}
          {elsewhere.length ? list(elsewhere, 15) : <p className="hint">No other schools found.</p>}
        </>
      )}
      {t.thin_in_georgia && <p className="hint">{t.thin_in_georgia}</p>}
    </section>
  );
}

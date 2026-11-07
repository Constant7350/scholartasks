"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMPARE_CRITERIA, DEFAULT_IMPORTANCE, FIELDS, combinePrograms, compareColleges, estimateCost, findFields, ordinal, placeAmong, rankPrograms,
  type CompareKey, type CostInput, type Importance, type Place, type StudyField,
  faithLabel,
} from "@scholartasks/core";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { PageTabs } from "../../icon-tabs";
import { COLLEGE_PAGES } from "../../page-groups";
import { pickStudent, useCurrentStudent } from "../../../lib/current-student";
import { OWNERSHIP, costInput, money, pct, toFacts, type CollegeRow, type CostStudent } from "../../../lib/colleges";
import { STATE_NAMES } from "../../../lib/trades";
import { CollegePicker } from "../college-picker";

interface Student extends CostStudent { first_name: string }
interface ProgRow { college_id: number; grads: number; earn_1yr: number | null; earn_4yr: number | null; debt: number | null; colleges: { state: string; grad_rate: number | null; sat_avg: number | null } }
interface Peer { id: number; state: string; degree: number | null; grad_rate: number | null; earnings: number | null; median_debt: number | null }

/** Reads every row of a query, 1,000 at a time. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    const rows = (data as T[]) ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const MAX = 6;
const QUICK = ["marine-biology", "veterinarian", "nursing", "pre-med", "engineering", "computer-science", "business", "education"];
const LEVELS: [Importance, string][] = [[0, "Skip"], [1, "A little"], [2, "Some"], [3, "A lot"]];
const SAVED = "compare-importance";

/**
 * Compare a few colleges side by side and rank them 1st, 2nd, 3rd... on what
 * matters to this family: strength in the major, cost, graduation, pay, debt
 * and chance of getting in. The family sets how much each one counts.
 */
export default function ComparePage() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [ctx, setCtx] = useState<CostInput>({ homeState: "GA", incomeBand: null, statePrograms: [], pack: null });
  const [picked, setPicked] = useState<CollegeRow[]>([]);
  const [fromLink, setFromLink] = useState(false);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [field, setField] = useState<StudyField | null>(null);
  const [groupIx, setGroupIx] = useState(0);
  const [pool, setPool] = useState<ProgRow[] | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importance, setImportance] = useState<Record<CompareKey, Importance>>(DEFAULT_IMPORTANCE);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace(`/signin?next=${encodeURIComponent("/colleges/compare" + window.location.search)}`);
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("*").order("first_name"),
    ]);
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    setIsParent(m.some((r) => r.role === "parent"));
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (own ?? pickStudent(list, list[0]?.id)));
    const p = new URLSearchParams(window.location.search);
    const f = FIELDS.find((x) => x.id === p.get("field"));
    if (f) { setField(f); setQuery(f.label); }
    const ids = (p.get("ids") ?? "").split(",").map(Number).filter((n) => n > 0).slice(0, MAX);
    if (ids.length) {
      setFromLink(true);
      const { data } = await sb.from("colleges").select("*").in("id", ids);
      const rows = (data as CollegeRow[]) ?? [];
      setPicked(ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is CollegeRow => !!r));
    }
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED) ?? "null");
      if (saved && typeof saved === "object") setImportance({ ...DEFAULT_IMPORTANCE, ...saved });
    } catch { /* keep the defaults */ }
    setReady(true);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const mayUseIncome = isParent || !!student?.permissions?.see_income_and_costs;
  const home = student?.state ?? "GA";

  // Start with the colleges already on the student's list.
  useEffect(() => {
    if (!sb || !student) return;
    void costInput(sb, student, mayUseIncome).then(setCtx);
    if (fromLink) return;
    void (async () => {
      const { data } = await sb.from("student_colleges").select("college_id").eq("student_id", student.id).not("college_id", "is", null).limit(MAX);
      const ids = ((data as { college_id: number }[]) ?? []).map((r) => r.college_id);
      if (!ids.length) { setPicked([]); return; }
      const { data: cs } = await sb.from("colleges").select("*").in("id", ids);
      setPicked(((cs as CollegeRow[]) ?? []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
    })();
  }, [sb, student, mayUseIncome, fromLink]);

  const group = field ? field.groups[Math.min(groupIx, field.groups.length - 1)] ?? null : null;
  const pickedIds = picked.map((c) => c.id).join(",");

  // Every college in the U.S. with this major, so each one gets a place in
  // its state and nationwide (online-only programs left out, like Search by major).
  useEffect(() => {
    if (!sb || !group) { setPool(null); return; }
    let stale = false;
    setBusy(true); setError(null);
    readAll<ProgRow>((f, t) => sb.from("college_programs").select("college_id, grads, earn_1yr, earn_4yr, debt, colleges!inner(state, grad_rate, sat_avg)")
      .in("cip", group.cips).in("level", group.levels).eq("online", false).order("college_id").range(f, t))
      .then((rows) => { if (!stale) { setBusy(false); setPool(rows); } })
      .catch((e) => { if (!stale) { setBusy(false); setError(friendly(e)); } });
    return () => { stale = true; };
  }, [sb, group]);

  // Every college of the same kind (four-year, two-year, certificate), for
  // state and nationwide places on graduation, pay and debt.
  const kinds = [...new Set(picked.map((c) => c.degree ?? 0))].sort().join(",");
  useEffect(() => {
    if (!sb || !kinds) { setPeers([]); return; }
    let stale = false;
    readAll<Peer>((f, t) => sb.from("colleges").select("id, state, degree, grad_rate, earnings, median_debt").in("degree", kinds.split(",").map(Number)).order("id").range(f, t))
      .then((rows) => { if (!stale) setPeers(rows); }).catch(() => { /* places are extra; the table still works */ });
    return () => { stale = true; };
  }, [sb, kinds]);

  const setLevel = (k: CompareKey, v: Importance) => {
    const next = { ...importance, [k]: v };
    setImportance(next);
    try { localStorage.setItem(SAVED, JSON.stringify(next)); } catch { /* fine */ }
  };

  const table = useMemo(() => {
    const ranked = pool ? rankPrograms(combinePrograms(pool).map((c) => {
      const college = c.rows[0]!.colleges;
      return { ...c, state: college.state, gradRate: college.grad_rate, satAvg: college.sat_avg };
    }), home) : [];
    const majorScore = new Map(ranked.map((r) => [r.p.collegeId, r]));
    const majorAll = ranked.map((r) => ({ id: r.p.collegeId, state: r.p.state, value: r.score }));
    const peerOf = (c: CollegeRow, k: "grad_rate" | "earnings" | "median_debt") =>
      peers.filter((p) => (p.degree ?? 0) === (c.degree ?? 0)).map((p) => ({ id: p.id, state: p.state, value: p[k] == null ? null : Number(p[k]) }));
    const places = new Map(picked.map((c) => [c.id, {
      major: placeAmong(majorAll, c.id),
      finish: placeAmong(peerOf(c, "grad_rate"), c.id),
      pay: placeAmong(peerOf(c, "earnings"), c.id),
      debt: placeAmong(peerOf(c, "median_debt"), c.id, false),
    } as Partial<Record<CompareKey, { state: Place; nation: Place } | null>>]));
    const costs = new Map(picked.map((c) => [c.id, estimateCost(toFacts(c), ctx)]));
    const rows = compareColleges(picked.map((c) => ({
      id: c.id,
      major: group ? majorScore.get(c.id)?.score ?? null : null,
      cost: costs.get(c.id)?.estimate ?? null,
      finish: c.grad_rate, pay: c.earnings, debt: c.median_debt, admit: c.admit_rate, satAvg: c.sat_avg,
    })), field ? importance : { ...importance, major: 0 }, student?.sat ?? null);
    return { rows: new Map(rows.map((r) => [r.id, r])), costs, places, majorScore, majorPool: ranked.length };
  }, [pool, peers, picked, home, ctx, group, field, importance, student]);

  if (!sb) return <Page title="Compare colleges"><NotConfigured /></Page>;
  if (!ready) return <Page title="Compare colleges"><p className="hint">Loading…</p></Page>;

  const choose = (f: StudyField | null) => { setField(f); setGroupIx(0); setQuery(f?.label ?? ""); };
  const matches = query.trim() && (!field || query !== field.label) ? findFields(query).slice(0, 6) : [];
  const add = (c: CollegeRow | null) => {
    if (!c) return;
    setTyped("");
    if (picked.some((x) => x.id === c.id) || picked.length >= MAX) return;
    setPicked([...picked, c]);
  };
  const remove = (id: number) => setPicked(picked.filter((c) => c.id !== id));
  const shareLink = typeof window !== "undefined" && picked.length
    ? `${window.location.origin}/colleges/compare?ids=${picked.map((c) => c.id).join(",")}${field ? `&field=${field.id}` : ""}` : "";

  const order = [...picked].sort((a, b) => (table.rows.get(a.id)?.overallRank ?? 99) - (table.rows.get(b.id)?.overallRank ?? 99));
  const criteria = COMPARE_CRITERIA.filter((c) => c.key !== "major" || field);

  const value = (k: CompareKey, c: CollegeRow) => {
    switch (k) {
      case "major": {
        const p = table.majorScore.get(c.id);
        return p ? <>{p.score} out of 100<br /><span className="hint">{p.p.grads.toLocaleString()} graduates a year</span></> : <span className="hint">{pool ? "Not offered at this level" : ""}</span>;
      }
      case "cost": {
        const e = table.costs.get(c.id);
        return e?.estimate != null ? <>{money(e.estimate)} a year<br /><span className="hint">4 years {money(e.fourYears)}</span></> : <span className="hint">No price data</span>;
      }
      case "finish": return c.grad_rate != null ? `${pct(c.grad_rate)} graduate` : <span className="hint">No data</span>;
      case "pay": return c.earnings != null ? `${money(c.earnings)} a year` : <span className="hint">No data</span>;
      case "debt": return c.median_debt != null ? money(c.median_debt) : <span className="hint">No data</span>;
      case "fit": return c.admit_rate != null ? <>{pct(c.admit_rate)} admitted{c.sat_avg ? <><br /><span className="hint">SAT average {c.sat_avg}</span></> : null}</> : <span className="hint">Open admission or no data</span>;
    }
  };

  return (
    <Page title="Compare colleges">
      <PageTabs label="College pages" here="/colleges/compare" tabs={COLLEGE_PAGES} />
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint">Put up to {MAX} colleges side by side. Each one gets a place (1st, 2nd, 3rd...) on strength in the major, cost for your family, graduation, pay after, debt and chance of getting in, plus an overall place that uses what matters most to you.</p>

      <section className="panel">
        <h2>Colleges to compare</h2>
        {picked.length === 0 && <p className="hint" style={{ marginTop: 0 }}>Add colleges below, or add them to your <a href="/plan">college list</a> and they show up here.</p>}
        <div className="chips" style={{ justifyContent: "flex-start" }}>
          {picked.map((c) => (
            <span key={c.id} className="chip chip-on">{c.name} <button type="button" className="chip-x" aria-label={`Remove ${c.name}`} onClick={() => remove(c.id)}>×</button></span>
          ))}
        </div>
        {picked.length < MAX ? (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="add-college">Add a college</label>
            <CollegePicker sb={sb} id="add-college" value={typed} onChange={(name, c) => { setTyped(name); add(c); }} />
          </div>
        ) : <p className="hint">That&apos;s {MAX}, the most that fit side by side. Remove one to add another.</p>}
      </section>

      <section className="panel">
        <label htmlFor="cmp-major">Major (for &quot;Strength in the major&quot;)</label>
        <input id="cmp-major" className="input" placeholder="e.g. biology, nursing, engineering" value={query} autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); choose(matches[0]); } }} />
        {matches.length > 0 && (
          <ul className="picker-list major-picks" role="listbox">
            {matches.map((f) => <li key={f.id}><button type="button" className="picker-item" onClick={() => choose(f)}><b>{f.label}</b></button></li>)}
          </ul>
        )}
        <div className="chips" style={{ justifyContent: "flex-start", marginTop: 12 }}>
          {QUICK.map((id) => FIELDS.find((f) => f.id === id)).filter((f): f is StudyField => !!f).map((f) => (
            <button key={f.id} type="button" className={`chip${field?.id === f.id ? " chip-on" : ""}`} aria-pressed={field?.id === f.id} onClick={() => choose(f)}>{f.label}</button>
          ))}
          {field && <button type="button" className="chip" onClick={() => choose(null)}>No major yet</button>}
        </div>
        {field && field.groups.length > 1 && (
          <div className="chips" style={{ justifyContent: "flex-start", marginTop: 8 }}>
            {field.groups.map((g, k) => <button key={g.title} type="button" className={`chip${k === groupIx ? " chip-on" : ""}`} aria-pressed={k === groupIx} onClick={() => setGroupIx(k)}>{g.title}</button>)}
          </div>
        )}
      </section>

      <details className="panel">
        <summary><b>What matters most to you?</b> <span className="hint">(changes the overall place)</span></summary>
        <ul className="items importance">
          {criteria.map((c) => (
            <li key={c.key}>
              <div className="item-main"><b>{c.label}</b><span className="hint">{c.help}</span></div>
              <div className="chips" role="radiogroup" aria-label={c.label}>
                {LEVELS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={importance[c.key] === v} className={`chip chip-sm${importance[c.key] === v ? " chip-on" : ""}`} onClick={() => setLevel(c.key, v)}>{l}</button>)}
              </div>
            </li>
          ))}
        </ul>
      </details>

      {error && <p className="note note-err" role="alert">{error}</p>}
      {busy && <p className="hint">Scoring the major…</p>}

      {picked.length > 0 && (
        <section className="panel">
          <h2>How they rank</h2>
          <div className="compare-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Criterion</span></th>
                  {order.map((c) => (
                    <th key={c.id} scope="col">
                      {c.url ? <a href={c.url} target="_blank" rel="noreferrer noopener">{c.name}</a> : c.name}
                      <span className="hint">{c.city ? `${c.city}, ` : ""}{c.state} · {OWNERSHIP[c.ownership]}{faithLabel(c.religious_affiliation) ? ` · ${faithLabel(c.religious_affiliation)}` : ""}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="compare-overall">
                  <th scope="row">Overall for you</th>
                  {order.map((c) => {
                    const r = table.rows.get(c.id);
                    return <td key={c.id}>{r?.overallRank ? <><span className={`rank rank-${Math.min(r.overallRank, 4)}`}>{ordinal(r.overallRank)}</span> <b>{r.overall}</b><span className="hint"> / 100</span></> : <span className="hint">Not enough data</span>}</td>;
                  })}
                </tr>
                {criteria.map((k) => (
                  <tr key={k.key} className={importance[k.key] ? "" : "compare-off"}>
                    <th scope="row">{k.label}{!importance[k.key] && <span className="hint"> (skipped)</span>}</th>
                    {order.map((c) => {
                      const r = table.rows.get(c.id);
                      const rank = r?.ranks[k.key];
                      return (
                        <td key={c.id}>
                          {rank ? <span className={`rank rank-${Math.min(rank, 4)}`}>{ordinal(rank)}</span> : null} {value(k.key, c)}
                          {(() => {
                            const pl = table.places.get(c.id)?.[k.key];
                            return pl ? (
                              <span className="compare-places">
                                <span>{ordinal(pl.state.at)} of {pl.state.of.toLocaleString()} in {STATE_NAMES[c.state] ?? c.state}</span>
                                <span>{ordinal(pl.nation.at)} of {pl.nation.of.toLocaleString()} nationwide</span>
                              </span>
                            ) : null;
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {picked.length === 1 && <p className="hint">Add another college to see who comes out ahead.</p>}
          {field && group && pool && (
            <p className="hint">Strength in the major ({group.title}): the program score out of 100 (see <a href={`/majors?field=${field.id}`}>Search by major</a>), placed among all {table.majorPool.toLocaleString()} colleges in the U.S. that teach it, in the college&apos;s own state first, then nationwide.</p>
          )}
          {!field && <p className="hint">Pick a major above to add &quot;Strength in the major&quot;.</p>}
          {!table.costs.size || ctx.incomeBand ? null : <p className="hint">{mayUseIncome ? <>Add your income range on the <a href="/scholarships">Scholarships</a> page for prices that fit your family.</> : "Prices are full price; your parent can share estimates for your family."}</p>}
          <p className="hint">The colored badge is the place among the colleges you&apos;re comparing (ties share a place). Under it: the place among every college of the same kind (four-year, two-year or certificate) in that college&apos;s state, then nationwide. Cost and chance of getting in depend on your family, so they&apos;re only placed among these colleges. Pay and debt are for all of a college&apos;s students (U.S. Department of Education College Scorecard). This is advice to help you compare; the final choice is your family&apos;s.</p>
          {shareLink && <p><button className="btn btn-ghost btn-inline btn-sm" onClick={() => void navigator.clipboard?.writeText(shareLink)}>Copy a link to this comparison</button></p>}
        </section>
      )}
    </Page>
  );
}

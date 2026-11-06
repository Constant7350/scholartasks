"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEGREES, EARNINGS_SOURCE, FIELDS, HIGH_SCHOOL_PAY, INCOME_LABELS, SCORE_EXPLAINED, SCORE_WEIGHTS,
  CHURCH_FAMILIES, SCHOOL_TYPES, careerYears, combinePrograms, estimateCost, faithLabel, fieldFromMajor, findFields, fitsSchoolType, rankPrograms, sortCareers,
  type SchoolType,
  type CostEstimate, type CostInput, type FieldGroup, type StudyField,
} from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { OWNERSHIP, costInput, money, pct, toFacts, type CollegeRow, type CostStudent } from "../../lib/colleges";
import { STATE_NAMES } from "../../lib/trades";
import { packFor } from "../../lib/state-packs";
import acmJson from "../../../../packs/regions/ACM.json";

const ACM_MEMBERS: string[] = acmJson.members;

interface Student extends CostStudent { first_name: string; match_profile?: { college_type?: SchoolType; church?: string | null } | null }
interface ProgRow { college_id: number; cip: string; level: number; grads: number; earn_1yr: number | null; earn_4yr: number | null; debt: number | null; online: boolean; college: CollegeRow }
interface NationalRow { cip: string; level: number; programs: number; grads: number; earn_1yr: number | null; earn_4yr: number | null; debt: number | null }
interface Hit { college: CollegeRow; grads: number; earn1: number | null; earn4: number | null; debt: number | null; online: boolean; score: number; cost: CostEstimate; parts: Record<string, number | null> }

const QUICK = ["marine-biology", "veterinarian", "nursing", "pre-med", "engineering", "computer-science", "business", "education", "animal-science", "trades"];
const NET_BANDS = ["$0–30k", "$30–48k", "$48–75k", "$75–110k", "$110k+"];
const BAND_OF: Record<string, number | null> = { under_30k: 0, "30_60k": 1, "60_110k": 3, "110_200k": 4, over_200k: 4, prefer_not: null };

/** A horizontal bar for simple charts. */
function Bar({ value, max, label, sub, strong }: { value: number | null; max: number; label: string; sub?: string; strong?: boolean }) {
  const w = value == null || max <= 0 ? 0 : Math.max(2, Math.round((value / max) * 100));
  return (
    <div className={`bar-row${strong ? " bar-strong" : ""}`}>
      <span className="bar-label">{label}</span>
      <span className="bar-track"><span className="bar-fill" style={{ width: `${w}%` }} /></span>
      <span className="bar-value">{value == null ? "no data" : money(value)}{sub ? <span className="hint"> {sub}</span> : null}</span>
    </div>
  );
}

/**
 * Search colleges by what you want to study: careers and pay for that field,
 * how long each degree takes, then the strongest programs in your state first
 * and nationwide, each with a yearly price for your family.
 */
export default function MajorsPage() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [ctx, setCtx] = useState<CostInput>({ homeState: "GA", incomeBand: null, statePrograms: [], pack: null });
  const [query, setQuery] = useState("");
  const [others, setOthers] = useState<{ cip: string; title: string }[]>([]);
  const [field, setField] = useState<StudyField | null>(null);
  const [groupIx, setGroupIx] = useState(0);
  const [careerSort, setCareerSort] = useState<"fast" | "pay">("pay");
  const [type, setType] = useState<SchoolType>("any");
  const [church, setChurch] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [rows, setRows] = useState<ProgRow[] | null>(null);
  const [national, setNational] = useState<NationalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onList, setOnList] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [twoYear, setTwoYear] = useState<CollegeRow[]>([]);
  const [allHome, setAllHome] = useState(false);
  const [featured, setFeatured] = useState<CollegeRow[]>([]);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/majors");
    setSignedIn(true);
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
    // Open a field from the link (?field=nursing or ?q=marine biology).
    const p = new URLSearchParams(window.location.search);
    const f = FIELDS.find((x) => x.id === p.get("field")) ?? (p.get("q") ? findFields(p.get("q")!)[0] : undefined);
    if (f) { setField(f); setQuery(f.label); }
    setReady(true);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const mayUseIncome = isParent || !!student?.permissions?.see_income_and_costs;
  const home = student?.state ?? "GA";
  const homeName = STATE_NAMES[home] ?? "your state";
  const acm = !!packFor(home)?.regions.includes("ACM");

  // Start from the kind of college this student picked on Find colleges (public, private, Christian).
  useEffect(() => {
    setType(student?.match_profile?.college_type ?? "any");
    setChurch(student?.match_profile?.church ?? null);
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sb || !student) return;
    void costInput(sb, student, mayUseIncome).then(setCtx);
    void sb.from("student_colleges").select("college_id").eq("student_id", student.id).then(({ data }) =>
      setOnList(new Set(((data as { college_id: number | null }[]) ?? []).map((r) => r.college_id).filter((x): x is number => x != null))));
  }, [sb, student, mayUseIncome]);

  // Other federal major names that match what was typed.
  useEffect(() => {
    if (!sb || query.trim().length < 3 || (field && query === field.label)) { setOthers([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.rpc("search_majors", { p_query: query.trim(), p_limit: 6 });
      setOthers(((data as { cip: string; title: string }[]) ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [sb, query, field]);

  const group: FieldGroup | null = field ? field.groups[Math.min(groupIx, field.groups.length - 1)] ?? null : null;

  useEffect(() => {
    if (!sb || !field) return;
    const cips = [...new Set(field.groups.flatMap((g) => g.cips))];
    void sb.from("field_earnings").select("*").in("cip", cips).then(({ data }) => setNational((data as NationalRow[]) ?? []));
  }, [sb, field]);

  useEffect(() => {
    if (!sb || !group) return;
    let stale = false;
    setBusy(true); setError(null); setRows(null); setOpen(null); setAllHome(false);
    void sb.rpc("programs_for", { p_cips: group.cips, p_levels: group.levels, p_state: home, p_online: online, p_limit: 250 }).then(({ data, error: e }) => {
      if (stale) return;
      setBusy(false);
      if (e) return setError(friendly(e));
      setRows((data as ProgRow[]) ?? []);
    });
    return () => { stale = true; };
  }, [sb, group, home, online]);

  // Colleges known to have this path inside a broader major (the federal data can't show it).
  useEffect(() => {
    const ids = field?.featured?.map((f) => f.id) ?? [];
    if (!sb || !ids.length) { setFeatured([]); return; }
    void sb.from("colleges").select("*").in("id", ids).then(({ data }) => setFeatured((data as CollegeRow[]) ?? []));
  }, [sb, field]);

  // Public two-year colleges in the home state, for "start there, then transfer".
  useEffect(() => {
    if (!sb || !field) return;
    void sb.from("colleges").select("*").eq("state", home).eq("degree", 2).eq("ownership", 1).not("cost_attendance", "is", null)
      .order("avg_net_price", { ascending: true, nullsFirst: false }).limit(40)
      .then(({ data }) => setTwoYear((data as CollegeRow[]) ?? []));
  }, [sb, field, home]);

  const ranked = useMemo(() => {
    if (!rows) return { home: [] as Hit[], homeTotal: 0, nation: [] as Hit[] };
    const colleges = new Map(rows.map((r) => [r.college_id, r.college]));
    const combined = combinePrograms(rows).map((c) => {
      const college = colleges.get(c.collegeId)!;
      return { ...c, state: college.state, gradRate: college.grad_rate, satAvg: college.sat_avg, college, online: c.rows.every((r) => r.online) };
    }).filter((c) => fitsSchoolType({ id: c.college.id, ownership: c.college.ownership, religiousAffiliation: c.college.religious_affiliation }, type, church));
    const hits: Hit[] = rankPrograms(combined, home).map(({ p, score, parts }) => ({
      college: p.college, grads: p.grads, earn1: p.earn1, earn4: p.earn4, debt: p.debt, online: p.online, score, parts: parts as unknown as Record<string, number | null>,
      cost: estimateCost(toFacts(p.college), ctx),
    }));
    const inHome = hits.filter((h) => h.college.state === home);
    return { home: allHome ? inHome : inHome.slice(0, 12), homeTotal: inHome.length, nation: hits.slice(0, 20) };
  }, [rows, type, church, home, ctx, allHome]);

  if (!sb) return <Page title="Search by major"><NotConfigured /></Page>;
  if (!ready || !signedIn) return <Page title="Search by major"><p className="hint">Loading…</p></Page>;

  const choose = (f: StudyField) => { setField(f); setGroupIx(0); setQuery(f.label); setOthers([]); };
  const matches = query.trim() && (!field || query !== field.label) ? findFields(query).slice(0, 6) : [];

  const add = async (c: CollegeRow) => {
    if (!student) return;
    setError(null);
    const mayChange = isParent || !!student.permissions?.change_plan_without_approval;
    const { error: e } = await sb.from("student_colleges").insert({ student_id: student.id, name: c.name, college_id: c.id, plan: "RD", approved: mayChange });
    if (e) return setError(friendly(e));
    setOnList(new Set([...onList, c.id]));
  };

  const careers = field ? sortCareers(field.careers as string[], careerSort) : [];
  const maxPay = Math.max(...careers.map((c) => c.pay), HIGH_SCHOOL_PAY);

  // What this field's graduates earn at each degree level (national middle).
  const byLevel = DEGREES.map((d) => {
    const cips = field ? new Set(field.groups.flatMap((g) => g.cips)) : new Set<string>();
    const rs = national.filter((n) => n.level === d.level && cips.has(n.cip));
    const w = rs.reduce((n, r) => n + (r.earn_4yr ?? r.earn_1yr ? r.grads : 0), 0);
    const pay = w ? Math.round(rs.reduce((n, r) => n + ((r.earn_4yr ?? r.earn_1yr) ?? 0) * (r.earn_4yr ?? r.earn_1yr ? r.grads : 0), 0) / w) : null;
    return { d, pay, programs: rs.reduce((n, r) => n + r.programs, 0) };
  });

  // Vet, medical, law and other graduate schools charge their own tuition; the
  // federal prices are for undergraduates, so don't show them as this program's cost.
  const isGrad = !!group && group.levels.every((l) => l >= 5);
  const signed = (n: number | null) => (n != null && n < 0 ? `−${money(-n)}` : money(n));

  const list = (hits: Hit[], title: string, empty: string) => (
    <section className="panel">
      <h2>{title}</h2>
      {hits.length === 0 ? <p className="hint" style={{ margin: 0 }}>{empty}</p> : (
        <ol className="items college-results major-results">
          {hits.map((h, i) => {
            const c = h.college;
            const isOpen = open === `${title}-${c.id}`;
            const band = ctx.incomeBand ? BAND_OF[ctx.incomeBand] : null;
            const net = c.net_price ?? [];
            const maxNet = Math.max(...net.map((x) => x ?? 0), c.cost_attendance ?? 0);
            return (
              <li key={`${title}-${c.id}`}>
                <div className="item-main">
                  <b>{i + 1}. {c.name}</b>
                  <span className="hint">{c.city ? `${c.city}, ` : ""}{c.state} · {OWNERSHIP[c.ownership]}{faithLabel(c.religious_affiliation) ? ` · ${faithLabel(c.religious_affiliation)}` : ""}{h.online ? " · Online" : ""}{c.size ? ` · ${c.size.toLocaleString()} students` : ""}</span>
                  <span className="hint">
                    {h.grads.toLocaleString()} {h.grads === 1 ? "graduate" : "graduates"} a year in this major{c.grad_rate != null ? ` · ${pct(c.grad_rate)} of students finish` : ""}
                  </span>
                  <span className="hint">
                    This major&apos;s graduates earn {h.earn4 != null ? <b>{money(h.earn4)}</b> : h.earn1 != null ? <b>{money(h.earn1)}</b> : "—"}{h.earn4 != null ? " after 4 years" : h.earn1 != null ? " after 1 year" : ""}
                    {h.debt != null ? <> · typical loans {money(h.debt)}</> : null}
                  </span>
                  {isGrad ? (
                    <span className="hint">Graduate school tuition isn&apos;t in the federal data. Check the school&apos;s own {group?.title.toLowerCase().includes("vet") ? "DVM" : "program"} tuition page; graduates typically borrow {money(h.debt)}.</span>
                  ) : <span className="college-price">
                    {h.cost.estimate != null
                      ? <><b>About {money(h.cost.estimate)} a year</b> <span className="hint">({h.cost.basis === "typical" ? "typical for your income" : h.cost.basis === "state_award" ? "after HOPE/Zell" : "full price"}; full price {money(h.cost.sticker)})</span></>
                      : <span className="hint">No price data</span>}
                  </span>}
                  {isOpen && !isGrad && (
                    <div className="cost-chart">
                      <h3>What families pay per year, by income</h3>
                      <p className="hint" style={{ marginTop: 0 }}>After typical grants and scholarships, before loans (federal data, {c.ownership === 1 ? "in-state students" : "all students"}).</p>
                      {NET_BANDS.map((b, k) => <Bar key={b} label={b} value={net[k] ?? null} max={maxNet} strong={band === k} sub={band === k ? "← your family" : undefined} />)}
                      <Bar label="Full price" value={c.cost_attendance} max={maxNet} sub="before any aid" />
                      {c.ownership === 1 && c.tuition_in != null && c.tuition_out != null && c.tuition_out !== c.tuition_in && (
                        <>
                          <h3>Tuition: in-state vs out-of-state</h3>
                          <Bar label="In-state" value={c.tuition_in} max={c.tuition_out} strong={c.state === home} />
                          <Bar label="Out-of-state" value={c.tuition_out} max={c.tuition_out} strong={c.state !== home} />
                          {c.state !== home && acm && ACM_MEMBERS.includes(c.state) && <p className="hint">{homeName} students may get in-state tuition here through the <a href="https://www.sreb.org/academic-common-market" target="_blank" rel="noreferrer noopener">Academic Common Market</a> if this major isn&apos;t offered in {homeName}.</p>}
                        </>
                      )}
                      <h3>Our estimate for your family</h3>
                      <table className="cost-lines"><tbody>
                        {h.cost.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">{signed(l.amount)}</td></tr>)}
                        <tr className="cost-total"><td>Per year</td><td className="num">{money(h.cost.estimate)}</td></tr>
                        <tr><td>Four years</td><td className="num">{money(h.cost.fourYears)}</td></tr>
                      </tbody></table>
                      {h.cost.notes.map((n) => <p key={n} className="hint">{n}</p>)}
                      <p className="hint">Program score {h.score} out of 100: {Object.entries(h.parts).filter(([, v]) => v != null).map(([k, v]) => `${({ size: "program size", finish: "graduation rate", pay: "pay", debt: "debt vs pay", academics: "academics" } as Record<string, string>)[k]} ${Math.round(v! * 100)}`).join(", ")}.</p>
                    </div>
                  )}
                </div>
                <div className="item-actions">
                  <span className="pill" title="Program score out of 100 (see How we rank)">Score {h.score}</span>
                  {!isGrad && <button className="btn btn-ghost btn-inline btn-sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : `${title}-${c.id}`)}>{isOpen ? "Hide costs" : "Costs"}</button>}
                  {student && (onList.has(c.id)
                    ? <span className="pill pill-ok">On your list ✓</span>
                    : <button className="btn btn-inline btn-sm" onClick={() => void add(c)}>+ Add</button>)}
                  {c.price_calc_url && <a className="btn btn-ghost btn-inline btn-sm" href={c.price_calc_url} target="_blank" rel="noreferrer noopener">Price calculator</a>}
                  {c.url && <a className="btn btn-ghost btn-inline btn-sm" href={c.url} target="_blank" rel="noreferrer noopener">Website</a>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );

  // Two years at a community or state college, then two at the university.
  const transfer = () => {
    if (isGrad || !group?.levels.includes(3)) return null;
    const target = ranked.home.find((h) => h.cost.estimate != null && h.college.degree !== 2) ?? ranked.nation.find((h) => h.cost.estimate != null && h.college.state === home);
    const starts = twoYear.map((c) => ({ c, est: estimateCost(toFacts(c), ctx) })).filter((x) => x.est.estimate != null)
      .sort((a, b) => a.est.estimate! - b.est.estimate!).slice(0, 3);
    const ga = home === "GA";
    const facts = (
      <ul>
        <li>Getting in is often easier as a transfer. {ga ? <>At UGA in fall 2026 about 2 in 3 transfer applicants were admitted, compared with about 3 in 10 first-year applicants (<a href="https://admissions.uga.edu/wp-content/uploads/2026/07/FastFacts_2026_WEB.pdf" target="_blank" rel="noreferrer noopener">UGA Fast Facts</a>). UGA considers transfers with 30 to 59 college credit hours and a 3.30 GPA, or 60+ hours and a 3.00 (<a href="https://admissions.uga.edu/apply/transfer-applicants/transfer-criteria/" target="_blank" rel="noreferrer noopener">UGA transfer criteria</a>). SAT/ACT and high school grades don&apos;t count; every college grade does.</> : "Check each university's transfer page for the GPA and credit hours it wants."}</li>
        {ga && <li>Core classes taken at any University System of Georgia college transfer in full to another one (<a href="https://www.kennesaw.edu/registrar/transfer/usg-core-curriculum-transfer-agreement.php" target="_blank" rel="noreferrer noopener">USG core transfer agreement</a>), and 38 general education classes at Georgia&apos;s technical colleges transfer to every public college and university in the state (<a href="https://www.usg.edu/active-articulations/tcsg/" target="_blank" rel="noreferrer noopener">TCSG to USG transfer list</a>).</li>}
        {ga && field?.id === "engineering" && <li>Engineering: Georgia Tech&apos;s <a href="https://admission.gatech.edu/transfer/repp-pathway" target="_blank" rel="noreferrer noopener">Regents&apos; Engineering Pathway</a> lets you take two years at a partner college, then finish at Tech.</li>}
        {ga && <li>HOPE and Zell pay at two-year colleges too, and your HOPE college GPA carries over.</li>}
        <li>Plan ahead: take the classes your major needs before you transfer, keep your grades high, and ask the university&apos;s transfer office early. Nursing, engineering and other programs with strict course orders need extra care.</li>
        <li>You can transfer to a university in any state, not just {homeName}.</li>
      </ul>
    );
    return (
      <section className="panel">
        <h2>Save money: start at a two-year college, then transfer</h2>
        <p className="hint" style={{ marginTop: 0 }}>Many students take their first two years of core classes at a community, state or technical college, then finish the bachelor&apos;s degree at a university. The diploma is the same.</p>
        {target && starts[0] && (() => {
          const four = target.cost.estimate! * 4;
          const split = starts[0].est.estimate! * 2 + target.cost.estimate! * 2;
          return (
            <>
              <div className="bars">
                <Bar label={`4 years at ${target.college.name}`} value={four} max={four} />
                <Bar label={`2 years at ${starts[0].c.name}, then 2 at ${target.college.name}`} value={split} max={four} strong />
              </div>
              {four > split && <p><b>You could save about {money(four - split)}.</b> <span className="hint">Estimates for your family, before loans.</span></p>}
              <p className="hint">Lowest-cost public two-year colleges in {homeName} for your family: {starts.map((x, k) => <span key={x.c.id}>{k ? ", " : ""}{x.c.url ? <a href={x.c.url} target="_blank" rel="noreferrer noopener">{x.c.name}</a> : x.c.name} ({money(x.est.estimate)} a year)</span>)}.</p>
            </>
          );
        })()}
        {facts}
      </section>
    );
  };

  const costChart = (hits: Hit[]) => {
    const shown = hits.filter((h) => h.cost.estimate != null).slice(0, 10);
    if (!shown.length) return null;
    const max = Math.max(...shown.map((h) => h.cost.sticker ?? h.cost.estimate ?? 0));
    return (
      <section className="panel">
        <h2>Compare yearly cost</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {ctx.incomeBand && ctx.incomeBand !== "prefer_not" ? `What families earning ${INCOME_LABELS[ctx.incomeBand]} typically pay` : "Full price"} at the top {shown.length} colleges above, cheapest first. The light bar is the full price.
        </p>
        <div className="bars">
          {[...shown].sort((a, b) => a.cost.estimate! - b.cost.estimate!).map((h) => (
            <div className="bar-row" key={h.college.id}>
              <span className="bar-label">{h.college.name}{h.college.state !== home ? ` (${h.college.state})` : ""}</span>
              <span className="bar-track">
                <span className="bar-fill bar-ghost" style={{ width: `${Math.round(((h.cost.sticker ?? 0) / max) * 100)}%` }} />
                <span className="bar-fill" style={{ width: `${Math.max(2, Math.round((h.cost.estimate! / max) * 100))}%` }} />
              </span>
              <span className="bar-value">{money(h.cost.estimate)}<span className="hint"> · 4 yrs {money(h.cost.fourYears)}</span></span>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <Page title="Search colleges by major">
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint">Type what you want to study, like marine biology, vet or nurse. You&apos;ll see what that career pays, how many years of school it takes, and the strongest programs in {homeName} first, then across the country, with a yearly price for your family. Not sure yet? Take the <a href="/career-quiz">career quiz</a>.</p>

      <section className="panel">
        <label htmlFor="major-q">What do you want to study?</label>
        <input id="major-q" className="input" placeholder="e.g. marine biology, veterinarian, nursing" value={query} autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); choose(matches[0]); } }} />
        {(matches.length > 0 || others.length > 0) && (
          <ul className="picker-list major-picks" role="listbox">
            {matches.map((f) => <li key={f.id}><button type="button" className="picker-item" onClick={() => choose(f)}><b>{f.label}</b></button></li>)}
            {others.filter((o) => !matches.some((f) => f.groups.some((g) => g.cips.length === 1 && g.cips[0] === o.cip))).map((o) => (
              <li key={o.cip}><button type="button" className="picker-item" onClick={() => choose(fieldFromMajor(o.cip, o.title))}>{o.title} <span className="hint">(federal major name)</span></button></li>
            ))}
          </ul>
        )}
        {query.trim().length >= 3 && !matches.length && !others.length && (!field || query !== field.label) && <p className="hint">No major by that name yet. Try a shorter word, like &quot;bio&quot; or &quot;health&quot;.</p>}
        <div className="chips" style={{ justifyContent: "flex-start", marginTop: 12 }}>
          {QUICK.map((id) => FIELDS.find((f) => f.id === id)!).map((f) => (
            <button key={f.id} type="button" className={`chip${field?.id === f.id ? " chip-on" : ""}`} aria-pressed={field?.id === f.id} onClick={() => choose(f)}>{f.label}</button>
          ))}
        </div>
      </section>

      {field && (
        <>
          {careers.length > 0 && (
            <section className="panel">
              <h2>Careers and pay</h2>
              <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
                <button role="tab" aria-selected={careerSort === "pay"} onClick={() => setCareerSort("pay")}>Earn the most</button>
                <button role="tab" aria-selected={careerSort === "fast"} onClick={() => setCareerSort("fast")}>Get a job fastest</button>
              </div>
              <div className="bars">
                {careers.map((c) => (
                  <div key={c.name} className="career">
                    <Bar label={c.name} value={c.pay} max={maxPay} sub="a year" />
                    <p className="hint career-sub">
                      {c.education} · {careerYears(c)} of school after high school · jobs {c.growth > 0 ? `growing ${c.growth}%` : c.growth < 0 ? `shrinking ${Math.abs(c.growth)}%` : "holding steady"} by 2035 · <a href={c.url} target="_blank" rel="noreferrer noopener">more</a>
                    </p>
                  </div>
                ))}
                <Bar label="All workers with only high school" value={HIGH_SCHOOL_PAY} max={maxPay} sub="for comparison" />
              </div>
              <p className="hint">Median pay: half earn more, half less. Beginners earn less. From the U.S. Bureau of Labor Statistics, May 2025.</p>
            </section>
          )}

          <section className="panel">
            <h2>How long it takes and what it pays</h2>
            <ul className="items degree-list">
              {byLevel.filter(({ d, pay }) => pay != null || d.level <= 3).map(({ d, pay }) => (
                <li key={d.level}>
                  <div className="item-main">
                    <b>{d.name}</b>
                    <span className="hint">{d.years} of school after high school</span>
                    <span>This field&apos;s graduates earn* <b>{pay != null ? money(pay) : "—"}</b>{d.typicalPay ? <span className="hint"> · all workers with this degree {money(d.typicalPay)}</span> : null}</span>
                  </div>
                </li>
              ))}
            </ul>
            <details style={{ marginTop: 10 }}>
              <summary>What each degree means</summary>
              <ul>{DEGREES.map((d) => <li key={d.level}><b>{d.name}:</b> {d.plain}</li>)}</ul>
            </details>
            <p className="hint">*Middle pay of graduates of these majors across the country, about 4 years after finishing (U.S. Department of Education). All workers: full-time workers 25 and older, by highest degree (<a href={EARNINGS_SOURCE} target="_blank" rel="noreferrer noopener">Bureau of Labor Statistics, 2025</a>).</p>
            {field.note && <p className="note">{field.note}</p>}
          </section>

          <section className="panel quiz">
            {field.groups.length > 1 && (
              <fieldset className="quiz-q">
                <legend>Which list?</legend>
                <div className="chips" style={{ justifyContent: "flex-start" }}>
                  {field.groups.map((g, k) => <button key={g.title} type="button" className={`chip${k === groupIx ? " chip-on" : ""}`} aria-pressed={k === groupIx} onClick={() => setGroupIx(k)}>{g.title}</button>)}
                </div>
              </fieldset>
            )}
            {group?.hint && <p className="hint">{group.hint}</p>}
            <fieldset className="quiz-q">
              <legend>What kind of college?</legend>
              <div className="chips" style={{ justifyContent: "flex-start" }}>
                {SCHOOL_TYPES.map(([v, l]) => (
                  <button key={v} type="button" className={`chip${type === v ? " chip-on" : ""}`} aria-pressed={type === v} onClick={() => setType(v)}>{v === "christian" ? "Christian colleges" : v === "military" ? "Military colleges" : l}</button>
                ))}
              </div>
              {type === "christian" && (
                <select className="input" style={{ maxWidth: 360, marginTop: 8 }} aria-label="Church family" value={church ?? ""} onChange={(e) => setChurch(e.target.value || null)}>
                  <option value="">Any Christian college</option>
                  {CHURCH_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              )}
            </fieldset>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Include online-only programs</label>
            {!ctx.incomeBand && <p className="hint" style={{ margin: "6px 0 0" }}>{mayUseIncome ? <>Add your income range on the <a href="/scholarships">Scholarships</a> page for prices that fit your family.</> : "Prices shown are full price; your parent can share estimates for your family."}</p>}
          </section>

          {error && <p className="note note-err" role="alert">{error}</p>}
          {busy && <p className="hint">Finding colleges…</p>}

          {field?.featured && featured.length > 0 && (
            <section className="panel">
              <h2>Colleges with a {field.label.toLowerCase()} track</h2>
              <p className="hint">Federal data lists some {field.label.toLowerCase()} programs under a broader major like Biology, so they can rank lower in the lists below. These colleges offer this path; check their page for details.</p>
              <ul className="items">
                {[...featured].sort((a, b) => Number(b.state === home) - Number(a.state === home) || a.name.localeCompare(b.name)).map((c) => {
                  const f = field.featured!.find((x) => x.id === c.id);
                  return (
                    <li key={c.id}>
                      <b>{c.name}</b> <span className="hint">({c.city}, {c.state})</span><br />
                      <span>{f?.note}</span>{" "}
                      {f?.url && <a href={f.url} target="_blank" rel="noreferrer">See the program</a>}
                      {student && (onList.has(c.id)
                        ? <span className="pill pill-ok" style={{ marginLeft: 8 }}>On the list</span>
                        : <button className="btn btn-ghost btn-inline btn-sm" style={{ marginLeft: 8 }} onClick={() => void add(c)}>Add to college list</button>)}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {rows && group && (
            <>
              {list(ranked.home, `Best in ${homeName}: ${group.title}`, `No college in ${homeName} reports this major at this level. See the nationwide list below.`)}
              {ranked.homeTotal > 12 && (
                <p style={{ margin: "-6px 0 16px" }}>
                  <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setAllHome(!allHome)}>
                    {allHome ? `Show the top 12 in ${homeName}` : `Show all ${ranked.homeTotal} colleges in ${homeName}`}
                  </button>
                </p>
              )}
              {list(ranked.nation, `Best nationwide: ${group.title}`, "No colleges found. Try another list or include online programs.")}
              {transfer()}
              {!isGrad && costChart([...ranked.home.slice(0, 5), ...ranked.nation.filter((h) => !ranked.home.some((x) => x.college.id === h.college.id)).slice(0, 5)])}
            </>
          )}

          <section className="panel">
            <h2>How we rank</h2>
            <p className="hint" style={{ marginTop: 0 }}>We don&apos;t copy magazine rankings. Each college&apos;s program gets a score out of 100 from federal data, compared with every other college that teaches it:</p>
            <ul>
              {(Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]).map((k) => <li key={k}>{SCORE_EXPLAINED[k]} ({Math.round(SCORE_WEIGHTS[k] * 100)}%)</li>)}
            </ul>
            <p className="hint">Things the federal data can&apos;t show, so check them yourself: {field.checks?.length ? "" : "class sizes, internships and the campus feel."}</p>
            {field.checks?.length ? <ul>{field.checks.map((c) => <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer noopener">{c.label}</a></li>)}</ul> : null}
            {acm && <p className="hint">{homeName} students: the <a href="https://www.sreb.org/academic-common-market" target="_blank" rel="noreferrer noopener">Academic Common Market</a> can give in-state tuition at some out-of-state public colleges in member states for majors {homeName} doesn&apos;t offer.</p>}
            <p className="hint">This is advice to help you compare. The final choice is your family&apos;s. Data: U.S. Department of Education College Scorecard{rows?.[0]?.college?.data_year ? ` (fetched ${rows[0].college.data_year})` : ""} and U.S. Bureau of Labor Statistics.</p>
          </section>
        </>
      )}
      {!field && (
        <p className="hint">Not sure yet? Try the <a href="/colleges">five-question college match</a> or ask the <a href="/counselor">AI counselor</a> about careers you might like.</p>
      )}
    </Page>
  );
}

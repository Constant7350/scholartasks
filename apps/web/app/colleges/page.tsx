"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHURCH_FAMILIES, INTERESTS, MILITARY_COLLEGE_IDS, SERVICE_ACADEMIES, militaryLabel, INTEREST_PROGRAMS, SCHOOL_TYPES, SOUTHEAST, faithCodes, faithLabel, collegeFit, estimateCost, fitRecord, type CourseGrade, matchScore, sizeOf, type CostInput, type Fit, type MatchAnswers, type MatchProfile } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { SpaceSwitch, myPicks, savePick, useSpace } from "../../lib/parent-space";
import { OWNERSHIP, costInput, money, pct, toFacts, type CollegeRow, type CostStudent } from "../../lib/colleges";
import { STATE_NAMES } from "../../lib/trades";

interface Student extends CostStudent { first_name: string; match_profile: MatchProfile | null }

const FIT: Record<Fit, { label: string; cls: string; hint: string }> = {
  likely: { label: "Likely", cls: "pill-ok", hint: "Your grades, rigor and scores are above most admitted students'." },
  match: { label: "Match", cls: "", hint: "Your grades, rigor and scores are close to most admitted students'." },
  reach: { label: "Reach", cls: "pill-soon", hint: "Very selective, or your grades or scores are below most admitted students'." },
  unknown: { label: "Open", cls: "", hint: "Not enough data to say." },
};
const BUDGETS = [
  { v: "", label: "Any price" }, { v: "10000", label: "Up to $10,000 a year" }, { v: "20000", label: "Up to $20,000 a year" },
  { v: "30000", label: "Up to $30,000 a year" }, { v: "45000", label: "Up to $45,000 a year" },
];

/** Five quick questions, then colleges that fit, with reach/match/likely and a yearly price. */
export default function CollegesPage() {
  const sb = supabase();
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [ctx, setCtx] = useState<CostInput | null>(null);
  const [record, setRecord] = useState<{ gpa: number | null; rigor: number }>({ gpa: null, rigor: 0 });
  const [answers, setAnswers] = useState<MatchAnswers>({ where: "region", size: "any", type: "any", interests: [], budget: null });
  const [results, setResults] = useState<CollegeRow[] | null>(null);
  const [onList, setOnList] = useState<Set<number>>(new Set());
  const [onMine, setOnMine] = useState<Set<number>>(new Set());
  const [space, setSpace] = useSpace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/colleges");
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
    const probe = await sb.from("colleges").select("id").limit(1);
    setOffline(!!probe.error || !(probe.data?.length));
    setReady(true);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const mayUseIncome = isParent || !!student?.permissions?.see_income_and_costs;
  // A parent in their own space: saves go to the parent's list and the student's answers are left alone.
  const mine = isParent && space === "parent";

  useEffect(() => {
    if (!sb || !student) return;
    const mp = student.match_profile ?? {};
    setAnswers((a) => ({ ...a, interests: (mp.interests ?? []).filter((i) => INTEREST_PROGRAMS[i]), type: mp.college_type ?? "any", church: mp.church ?? null }));
    void costInput(sb, student, mayUseIncome).then(setCtx);
    void sb.from("course_grades").select("course, grade, level, core, grade_level, term").eq("student_id", student.id).then(({ data }) =>
      setRecord(fitRecord(((data as { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }[]) ?? [])
        .map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level })))));
    void sb.from("student_colleges").select("college_id").eq("student_id", student.id).then(({ data }) =>
      setOnList(new Set(((data as { college_id: number | null }[]) ?? []).map((r) => r.college_id).filter((x): x is number => x != null))));
    if (isParent) void myPicks(sb, student.id, "college").then((rows) => setOnMine(new Set(rows.map((r) => Number(r.item_key)))));
    setResults(null);
  }, [sb, student, mayUseIncome, isParent]);

  const ranked = useMemo(() => {
    if (!results || !student || !ctx) return [];
    const military = answers.type === "military";
    const a = military ? { ...answers, where: "anywhere" as const, size: "any" as const, interests: [] } : answers;
    return results.map((r) => {
      const facts = toFacts(r);
      const cost = estimateCost(facts, ctx);
      // Service academies charge no tuition: show them as free.
      if (SERVICE_ACADEMIES.some((x) => x.id === r.id)) { cost.estimate = 0; cost.basis = "sticker"; }
      const score = matchScore(facts, a, student.state, cost.estimate);
      return { r, cost, score, fit: collegeFit(facts, { sat: student.sat, act: student.act, gpa: record.gpa, rigor: record.rigor }) };
    }).filter((x) => x.score != null)
      .sort((x, y) => (military ? Number(y.r.state === student.state) - Number(x.r.state === student.state) : 0) || y.score! - x.score!).slice(0, 40);
  }, [results, student, ctx, answers, record]);

  if (!sb) return <Page title="Find colleges"><NotConfigured /></Page>;
  if (!ready) return <Page title="Find colleges"><p className="hint">Loading…</p></Page>;
  if (offline) return <Page title="Find colleges"><div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>The college list is switching on. Check back shortly.</p></div></Page>;
  if (!student) return <Page title="Find colleges"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const search = async () => {
    setBusy(true); setError(null);
    const states = answers.where === "home" ? [student.state] : answers.where === "region" ? [...new Set([student.state, ...SOUTHEAST])] : null;
    const ownership = answers.type === "public" ? [1] : answers.type === "private" || answers.type === "christian" ? [2] : [1, 2];
    const programs = [...new Set(answers.interests.flatMap((i) => INTEREST_PROGRAMS[i] ?? []))];
    const faith = answers.type === "christian" ? faithCodes(answers.church) : null;
    // Military: the service academies and military colleges, in every state (only 15, so no other filters but price).
    const { data, error: e } = answers.type === "military"
      ? await sb.from("colleges").select("*").in("id", MILITARY_COLLEGE_IDS)
      : await sb.rpc("match_colleges", { p_states: states, p_ownership: ownership, p_programs: programs, p_limit: 400, ...(faith ? { p_faith: faith } : {}) });
    setBusy(false);
    if (e) return setError(friendly(e));
    setResults((data as CollegeRow[]) ?? []);
    // Remember the kind of college (public, private, Christian) for this student's other searches and the AI counselor.
    // Not from a parent's own space: a parent looking around shouldn't change the student's answers.
    if (mine) return;
    const mp = student.match_profile ?? {};
    const church = answers.type === "christian" ? answers.church ?? null : null;
    if ((mp.college_type ?? "any") !== answers.type || (mp.church ?? null) !== church) {
      const next = { ...mp, college_type: answers.type, church };
      const r = await sb.rpc("set_match_profile", { p_student: student.id, p_profile: next });
      // Kept in place (no re-render) so the results on screen stay put.
      if (!r.error) student.match_profile = next;
    }
  };

  const add = async (c: CollegeRow) => {
    setError(null);
    const mayChange = isParent || !!student.permissions?.change_plan_without_approval;
    const { error: e } = await sb.from("student_colleges").insert({ student_id: student.id, name: c.name, college_id: c.id, plan: "RD", approved: mayChange });
    if (e) return setError(friendly(e));
    setOnList(new Set([...onList, c.id]));
  };
  const saveMine = async (c: CollegeRow) => {
    setError(null);
    const { error: e } = await savePick(sb, { student_id: student.id, kind: "college", item_key: String(c.id), name: c.name });
    if (e) return setError(friendly(e));
    setOnMine(new Set([...onMine, c.id]));
  };

  const set = <K extends keyof MatchAnswers>(k: K, v: MatchAnswers[K]) => { setAnswers({ ...answers, [k]: v }); };
  const pick = (name: string, opts: [string, string][], k: "where" | "size" | "type") => (
    <fieldset className="quiz-q">
      <legend>{name}</legend>
      <div className="chips">
        {opts.map(([v, label]) => (
          <button key={v} type="button" className={`chip${answers[k] === v ? " chip-on" : ""}`} aria-pressed={answers[k] === v} onClick={() => set(k, v as never)}>{label}</button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <Page title={mine ? "Find colleges" : isParent ? `Find colleges for ${student.first_name}` : "Find colleges"}>
      {isParent && <SpaceSwitch space={space} onChange={setSpace} name={student.first_name} />}
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {mine
        ? <p className="hint">Answer five quick questions. Prices and Reach, Match or Likely use {student.first_name}&apos;s grades and scores. Tap Save to keep a college on your own list, where you can add a note and share it with {student.first_name} later.</p>
        : <p className="hint">Answer five quick questions. We look through every four-year college in the federal College Scorecard and show a yearly price for your family. Tap Add to put a college on your list. Know what you want to study? <a href="/majors">Search colleges by major</a>.</p>}

      <section className="panel quiz">
        {pick("1. Where?", [["home", STATE_NAMES[student.state] ?? "My state"], ["region", "The Southeast"], ["anywhere", "Anywhere in the U.S."]], "where")}
        {pick("2. How big?", [["small", "Small (under 5,000)"], ["medium", "Medium"], ["large", "Large (15,000+)"], ["any", "No preference"]], "size")}
        {pick("3. What kind of college?", SCHOOL_TYPES.map(([v, l]) => [v, v === "christian" ? "Christian colleges" : v === "military" ? "Military academies and colleges" : v === "private" ? "Private colleges" : v === "public" ? "Public colleges" : "Any"] as [string, string]), "type")}
        {answers.type === "christian" && (
          <fieldset className="quiz-q">
            <legend>Church family <span className="hint">(optional)</span></legend>
            <select className="input" style={{ maxWidth: 360 }} value={answers.church ?? ""} onChange={(e) => set("church", e.target.value || null)}>
              <option value="">Any Christian college</option>
              {CHURCH_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </fieldset>
        )}
        {answers.type === "military" && (
          <p className="hint" style={{ margin: "0 0 12px" }}>Shows the five service academies (free, with service after) and the senior and junior military colleges in every state, yours first. Nominations, ROTC and enlisting: see <a href="/military">Military paths</a>.</p>
        )}
        <fieldset className="quiz-q">
          <legend>4. What do you want to study? <span className="hint">(pick any)</span></legend>
          <div className="chips">
            {INTERESTS.filter((i) => INTEREST_PROGRAMS[i]).map((i) => {
              const on = answers.interests.includes(i);
              return <button key={i} type="button" className={`chip${on ? " chip-on" : ""}`} aria-pressed={on}
                onClick={() => set("interests", on ? answers.interests.filter((x) => x !== i) : [...answers.interests, i])}>{i}</button>;
            })}
          </div>
        </fieldset>
        <fieldset className="quiz-q">
          <legend>5. Price per year after typical aid</legend>
          <select className="input" style={{ maxWidth: 260 }} value={answers.budget ?? ""} onChange={(e) => set("budget", e.target.value ? Number(e.target.value) : null)}>
            {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
          </select>
          {!ctx?.incomeBand && <p className="hint" style={{ margin: "6px 0 0" }}>{mayUseIncome ? <>Add your income range on the <a href="/scholarships">Scholarships</a> page for prices that fit your family.</> : "Prices shown are full price; your parent can share estimates for your family."}</p>}
        </fieldset>
        <button className="btn btn-inline" disabled={busy} onClick={() => void search()}>{busy ? "Finding…" : results ? "Update matches" : "Show my matches"}</button>
      </section>

      {error && <p className="note note-err" role="alert">{error}</p>}

      {results && (
        <section className="panel">
          <h2>{ranked.length ? `${ranked.length} colleges that fit` : "No colleges fit every answer"}</h2>
          {!ranked.length && <p className="hint">Try a bigger area, a higher price, or fewer subjects.{answers.where === "home" && answers.type !== "any" ? " Choose The Southeast or Anywhere in the U.S. to see more " + (answers.type === "christian" ? "Christian" : answers.type) + " colleges." : ""}</p>}
          <p className="hint" style={{ marginTop: 0 }}>Reach, Match and Likely weigh your grades (unweighted GPA{record.gpa != null ? ` ${record.gpa.toFixed(2)}` : ""}), your AP, IB and dual enrollment classes ({record.rigor}), your SAT or ACT, and each college&apos;s admit rate. They&apos;re a rough guide, not a prediction.</p>
          <ul className="items college-results">
            {ranked.map(({ r, cost, fit }) => (
              <li key={r.id}>
                <div className="item-main">
                  <b>{r.name}</b>
                  <span className="hint">{r.city ? `${r.city}, ` : ""}{r.state} · {OWNERSHIP[r.ownership]}{faithLabel(r.religious_affiliation) ? ` · ${faithLabel(r.religious_affiliation)}` : ""}{militaryLabel(r.id) ? ` · ${militaryLabel(r.id)}` : ""} · {sizeOf(r.size) ?? "size unknown"}{r.size ? ` (${r.size.toLocaleString()} students)` : ""}</span>
                  <span className="hint">Admits {pct(r.admit_rate)} · Graduates {pct(r.grad_rate)} · Earnings after 10 years {money(r.earnings)}</span>
                  <span className="college-price">
                    {SERVICE_ACADEMIES.some((x) => x.id === r.id) ? <><b>No tuition</b> <span className="hint">(housing, food and a monthly stipend paid; about 5 years of service after graduation)</span></> : cost.estimate != null ? <><b>About {money(cost.estimate)} a year</b> <span className="hint">({cost.basis === "typical" ? "typical for your income" : cost.basis === "state_award" ? "after HOPE/Zell" : "full price"}; full price {money(cost.sticker)})</span></> : <span className="hint">No price data</span>}
                  </span>
                </div>
                <div className="item-actions">
                  <span className={`pill ${FIT[fit].cls}`} title={FIT[fit].hint}>{FIT[fit].label}</span>
                  {mine ? (
                    <>
                      {onList.has(r.id) && <span className="pill">On {student.first_name}&apos;s plan</span>}
                      {onMine.has(r.id)
                        ? <a className="pill pill-ok" href="/parent">In my list ✓</a>
                        : <button className="btn btn-inline btn-sm" onClick={() => void saveMine(r)}>☆ Save to my list</button>}
                    </>
                  ) : onList.has(r.id)
                    ? <span className="pill pill-ok">On your list ✓</span>
                    : <button className="btn btn-inline btn-sm" onClick={() => void add(r)}>+ Add</button>}
                  {r.url && <a className="btn btn-ghost btn-inline btn-sm" href={r.url} target="_blank" rel="noreferrer noopener">Website</a>}
                </div>
              </li>
            ))}
          </ul>
          <p className="hint">Data: U.S. Department of Education College Scorecard{results[0]?.data_year ? `, fetched ${results[0].data_year}` : ""}. Check each college&apos;s own net price calculator before you decide.</p>
        </section>
      )}
    </Page>
  );
}

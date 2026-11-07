"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APPLICATION_STATUS, buildScorecard, GROUPS, summarizeApplications, type ApplicationStatus, INTERESTS, matchScholarship, normalizeProfile,
  primaryGpa, type CourseGrade, type IncomeBand, type MatchProfile, type MatchResult, type Scholarship,
} from "@scholartasks/core";
import { PLAIN_GPA, meritNames, packFor, stateName } from "../../lib/state-packs";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import type { Choice, Row } from "./types";
import { SpaceSwitch, myPicks, savePick, useSpace } from "../../lib/parent-space";


interface Student {
  id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null;
  income_band: IncomeBand | null; permissions: Record<string, boolean>; weight_rigor?: number; weight_honors?: number;
  match_profile: MatchProfile | null;
}
interface AppRow { student_id: string; scholarship_id: string; status: ApplicationStatus; amount_won: number | null }
interface GradeRow { student_id: string; course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }

const TABS = [
  ["match", "Good matches"], ["maybe", "Maybe"], ["later", "Coming up"], ["no", "Not a fit now"], ["saved", "Saved"],
] as const;
type Tab = (typeof TABS)[number][0];
const INCOME: [IncomeBand, string][] = [
  ["under_30k", "Under $30,000"], ["30_60k", "$30,000 to $60,000"], ["60_110k", "$60,000 to $110,000"],
  ["110_200k", "$110,000 to $200,000"], ["over_200k", "Over $200,000"], ["prefer_not", "Prefer not to say"],
];
const dateText = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function ScholarshipsPage() {
  const sb = supabase();
  const [role, setRole] = useState<"parent" | "student" | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [list, setList] = useState<Row[] | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [colleges, setColleges] = useState<{ student_id: string; name: string }[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [space, setSpace] = useSpace();
  const [onMine, setOnMine] = useState<Set<string>>(new Set());
  useEffect(() => setTab(null), [current]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/scholarships");
    const [mem, st, gr, sc, ch, cl, ap] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("*").order("first_name"),
      sb.from("course_grades").select("student_id, term, course, grade, level, core, grade_level"),
      sb.from("scholarships").select("*").order("name"),
      sb.from("scholarship_choices").select("id, student_id, scholarship_id, choice, task_id, done_steps, essay_draft"),
      sb.from("student_colleges").select("student_id, name"),
      sb.from("scholarship_applications").select("student_id, scholarship_id, status, amount_won"),
    ]);
    const m = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const r = m.some((x) => x.role === "parent") ? "parent" : m.some((x) => x.role === "student") ? "student" : null;
    setRole(r);
    const sts = (st.data as Student[]) ?? [];
    setStudents(sts);
    setCurrent((c) => c ?? m.find((x) => x.role === "student")?.student_id ?? pickStudent(sts, sts[0]?.id));
    setGrades((gr.data as GradeRow[]) ?? []);
    setList((sc.data as Row[]) ?? []);
    setChoices((ch.data as Choice[]) ?? []);
    setColleges((cl.data as { student_id: string; name: string }[]) ?? []);
    setApps((ap.data as AppRow[]) ?? []);
    if (sc.error) setError(friendly(sc.error));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current) ?? null;
  const seesIncome = role === "parent" || !!student?.permissions?.see_income_and_costs;
  // A parent in their own space saves to their own list, not the student's deadlines.
  const inMySpace = role === "parent" && space === "parent";
  useEffect(() => {
    if (!sb || !student || role !== "parent") return;
    void myPicks(sb, student.id, "scholarship").then((rows) => setOnMine(new Set(rows.map((r) => r.item_key))));
  }, [sb, student, role]);
  const saveMine = async (s: Row) => {
    if (!sb || !student) return;
    setError(null);
    const { error: e } = await savePick(sb, { student_id: student.id, kind: "scholarship", item_key: s.id, name: s.name });
    if (e) return setError(friendly(e));
    setOnMine(new Set([...onMine, s.id]));
  };

  const results = useMemo(() => {
    if (!student || !list) return [];
    // "HOPE GPA" rules belong to Georgia awards, so only Georgia students get one.
    const formula = student.state === "GA" ? primaryGpa(packFor("GA"))?.formula ?? PLAIN_GPA : PLAIN_GPA;
    const mine: CourseGrade[] = grades.filter((g) => g.student_id === student.id)
      .map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level }));
    const card = formula ? buildScorecard(mine, { currentGrade: student.grade_level, formula, target: 3, schoolWeights: { rigor: student.weight_rigor ?? 1, honors: student.weight_honors ?? 0.5 } }) : null;
    const who = {
      gradeLevel: student.grade_level, state: student.state,
      hopeGpa: student.state === "GA" ? card?.stateGpa ?? null : null, unweightedGpa: card?.overallGpa ?? null, weightedGpa: card?.schoolGpa ?? null,
      sat: student.sat, act: student.act, incomeBand: seesIncome ? student.income_band : null, profile: student.match_profile ?? {},
      colleges: colleges.filter((c) => c.student_id === student.id).map((c) => c.name),
    };
    return list.filter((s) => s.status === "approved" || s.status === "pending").map((s) => ({ s, r: matchScholarship(s, who) }))
      .sort((a, b) => (a.s.deadline ?? "9999").localeCompare(b.s.deadline ?? "9999") || (b.s.amount_max ?? 0) - (a.s.amount_max ?? 0));
  }, [student, list, grades, seesIncome, colleges]);

  const mine = choices.filter((c) => c.student_id === current);
  const choiceOf = (id: string) => mine.find((c) => c.scholarship_id === id);
  const groups = useMemo(() => {
    const g: Record<Tab, { s: Row; r: MatchResult }[]> = { match: [], maybe: [], later: [], no: [], saved: [] };
    for (const x of results) {
      const c = choiceOf(x.s.id);
      if (c?.choice === "added") g.saved.push(x);
      else if (c?.choice !== "hidden") g[x.r.status].push(x);
    }
    // Closest first: the fewest things left to check, then the most rules already met.
    g.maybe.sort((a, b) => a.r.unknown.length - b.r.unknown.length || b.r.met.length - a.r.met.length);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, choices, current]);
  const hidden = results.filter((x) => choiceOf(x.s.id)?.choice === "hidden");
  const shownTab: Tab = tab ?? (groups.match.length ? "match" : groups.maybe.length ? "maybe" : "later");

  const myApps = apps.filter((a) => a.student_id === current);
  const appOf = (id: string) => myApps.find((a) => a.scholarship_id === id);
  const sum = summarizeApplications(myApps);
  const applyLink = (id: string) => `/scholarships/apply?id=${id}${student ? `&student=${student.id}` : ""}`;

  const addToDeadlines = async (s: Row, due: string, thenApply = false) => {
    if (!sb || !student) return;
    setError(null);
    const { data: t, error: e } = await sb.from("tasks").insert({
      student_id: student.id, title: s.name, kind: s.kind === "grant" ? "aid" : "scholarship", due_on: due || null, url: s.url, amount: s.amount_max,
    }).select("id").single();
    if (e) return setError(friendly(e));
    const { error: e2 } = await sb.from("scholarship_choices").upsert({ student_id: student.id, scholarship_id: s.id, choice: "added", task_id: (t as { id: string }).id }, { onConflict: "student_id,scholarship_id" });
    if (e2) return setError(friendly(e2));
    if (thenApply) return window.location.assign(applyLink(s.id));
    void load();
  };
  const hide = async (s: Row) => {
    if (!sb || !student) return;
    const { error: e } = await sb.from("scholarship_choices").upsert({ student_id: student.id, scholarship_id: s.id, choice: "hidden" }, { onConflict: "student_id,scholarship_id" });
    if (e) return setError(friendly(e));
    void load();
  };
  const unhide = async (c: Choice) => {
    if (!sb) return;
    const { error: e } = await sb.from("scholarship_choices").delete().eq("id", c.id);
    if (e) return setError(friendly(e));
    void load();
  };

  const title = "Scholarships and grants";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (!list) return <Page title={title}><p className="hint">Loading…</p></Page>;

  return (
    <Page title={title}>
      {role === "parent" && student && <SpaceSwitch space={space} onChange={setSpace} name={student.first_name} />}
      <p className="hint" style={{ marginTop: -8 }}>
        {student && student.state !== "GA" ? `National scholarships and grants (${stateName(student.state)} state awards like ${meritNames(packFor(student.state))} are on the Grades and Financial aid pages)` : "Georgia and national scholarships and grants"}, checked against {student ? `${student.first_name}'s` : "your student's"} grades, test scores and answers below. A &ldquo;Maybe&rdquo; tells you what to check. Always confirm the details on the official site before applying.
      </p>
      {role === "parent" && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => { setCurrent(s.id); setTab(null); }}>{s.first_name}</button>)}
        </div>
      )}
      {!student && <p className="note note-info">Add a student on the <a href="/family">Family</a> page to see matches.</p>}
      {error && <p className="note note-err" role="alert">{error}</p>}

      {student && (
        <>
          <ProfileCard key={student.id} student={student} isParent={role === "parent"} seesIncome={seesIncome} onSaved={load} />
          {myApps.length > 0 && (
            <p className="note note-info" style={{ marginTop: 12 }}>
              <b>My applications:</b> {[sum.gettingReady && `${sum.gettingReady} getting ready`, sum.sent && `${sum.sent} sent`, sum.won && `${sum.won} won${sum.totalWon ? ` ($${sum.totalWon.toLocaleString()})` : ""}`, sum.notWon && `${sum.notWon} not this time`].filter(Boolean).join(" · ")}.{" "}
              <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setTab("saved")}>See them</button>
            </p>
          )}
          <div className="tabs sch-tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={shownTab === k} onClick={() => setTab(k)}>
                {label} <span className="sch-count">{groups[k].length}</span>
              </button>
            ))}
          </div>
          {shownTab === "later" && <p className="hint">These open in a later grade. What to work on now is listed on each one.</p>}
          {shownTab === "no" && <p className="hint">Something on these doesn&apos;t fit right now. If an answer above changes, they may move up.</p>}
          {groups[shownTab].length === 0 && <p className="hint">Nothing here right now.</p>}
          {groups[shownTab].map(({ s, r }) => (
            <ScholarshipCard key={s.id} s={s} r={r} choice={choiceOf(s.id)} app={appOf(s.id)} applyHref={applyLink(s.id)} onAdd={addToDeadlines} onHide={hide}
              mine={inMySpace ? { saved: onMine.has(s.id), name: student.first_name, onSave: saveMine } : undefined} />
          ))}
          {hidden.length > 0 && (
            <details className="rescue-more" style={{ marginTop: 16 }}>
              <summary>Hidden ({hidden.length})</summary>
              <ul className="gaps">
                {hidden.map(({ s }) => <li key={s.id}>{s.name} <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void unhide(choiceOf(s.id)!)}>Show again</button></li>)}
              </ul>
            </details>
          )}
          <p className="hint" style={{ marginTop: 20, fontSize: 13 }}>
            ScholarTasks gives advice only. Rules and deadlines change every year, so check the official site. Scholarships marked &ldquo;Not yet verified&rdquo; are still being checked by our team.
          </p>
        </>
      )}
    </Page>
  );
}

function ScholarshipCard({ s, r, choice, app, applyHref, onAdd, onHide, mine }: {
  s: Row; r: MatchResult; choice?: Choice; app?: AppRow; applyHref: string; onAdd: (s: Row, due: string, thenApply?: boolean) => Promise<void>; onHide: (s: Row) => Promise<void>;
  /** Set when a parent is in their own space: saving goes to the parent's own list. */
  mine?: { saved: boolean; name: string; onSave: (s: Row) => Promise<void> };
}) {
  const [due, setDue] = useState(s.deadline ?? "");
  const [adding, setAdding] = useState(false);
  return (
    <section className="panel sch-card">
      <div className="score-head">
        <div>
          <h2 style={{ margin: 0 }}>{s.name}</h2>
          <span className="hint" style={{ fontSize: 13 }}>{s.kind === "grant" ? "Grant · " : ""}From {s.sponsor}{s.college ? "" : s.scope !== "US" ? ` · ${s.scope}` : " · National"}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <b className="sch-amount">{s.amount_text}</b>
          {s.school_id && <div><span className="pill pill-ok">From your school</span></div>}
          {s.status === "pending" && <div><span className="pill pill-soon">Not yet verified</span></div>}
          {app && <div><span className={`pill ${app.status === "won" ? "pill-ok" : app.status === "getting_ready" ? "pill-soon" : ""}`}>{APPLICATION_STATUS[app.status]}</span></div>}
        </div>
      </div>
      <p style={{ margin: "10px 0" }}>{s.summary}</p>
      <p className="hint" style={{ margin: "0 0 8px" }}>
        <b>Deadline:</b> {s.deadline ? dateText(s.deadline) : s.deadline_text ?? "Check the official site"}
        {s.automatic && <> · <b>No separate application</b></>}
      </p>
      <ul className="sch-reasons">
        {r.met.map((m) => <li key={m} className="sch-met">✓ {m}</li>)}
        {r.unknown.map((m) => <li key={m} className="sch-unknown">? {m}</li>)}
        {r.check.map((m) => <li key={m} className="sch-unknown">Also check: {m}</li>)}
        {r.missing.map((m) => <li key={m} className="sch-missing">{r.status === "later" ? "→ Work on: " : "✗ "}{m}</li>)}
      </ul>
      {s.how_to_apply && <p className="hint" style={{ margin: "8px 0" }}><b>How to apply:</b> {s.how_to_apply}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <a className="btn btn-ghost btn-inline btn-sm" href={s.url} target="_blank" rel="noopener noreferrer">Official site ↗</a>
        {mine ? (
          <>
            {choice?.choice === "added" && <span className="pill">On {mine.name}&apos;s deadlines</span>}
            {mine.saved
              ? <a className="pill pill-ok" href="/parent">In my list ✓</a>
              : <button className="btn btn-inline btn-sm" onClick={() => void mine.onSave(s)}>☆ Save to my list</button>}
          </>
        ) : choice?.choice === "added" ? (
          <span className="pill pill-ok">On your deadlines ✓ <a href="/plan">See plan</a></span>
        ) : s.automatic ? null : adding ? (
          <>
            <label className="hint" htmlFor={`due-${s.id}`} style={{ margin: 0 }}>Due</label>
            <input id={`due-${s.id}`} type="date" className="input" style={{ width: 170 }} value={due} onChange={(e) => setDue(e.target.value)} />
            <button className="btn btn-inline btn-sm" onClick={() => void onAdd(s, due)}>Save</button>
          </>
        ) : (
          <>
            <button className="btn btn-inline btn-sm" onClick={() => void onAdd(s, s.deadline ?? "", true)}>{s.school_id ? "Apply in the app" : "Start my application"}</button>
            <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setAdding(true)}>Add to my deadlines</button>
          </>
        )}
        {!choice && !mine && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onHide(s)}>Not for us</button>}
      </div>
      {choice?.choice === "added" && !mine && (
        <a className="btn btn-inline btn-sm link-btn" style={{ marginTop: 10 }} href={applyHref}>
          📝 {!app ? (s.school_id ? "Apply in the app" : "Start my application") : app.status === "getting_ready" ? "Keep working on my application" : "Open my application"}
        </a>
      )}
    </section>
  );
}

function ProfileCard({ student, isParent, seesIncome, onSaved }: { student: Student; isParent: boolean; seesIncome: boolean; onSaved: () => void }) {
  const sb = supabase();
  const p0 = normalizeProfile(student.match_profile ?? {});
  const [p, setP] = useState<MatchProfile>(p0);
  const [income, setIncome] = useState<IncomeBand | "">(student.income_band ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const answered = !!(p0.plan || p0.citizen || p0.interests?.length);
  const toggle = (k: "interests" | "groups", v: string) => {
    const cur = p[k] ?? [];
    setP({ ...p, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v], ...(k === "groups" ? { groups_answered: true } : {}) });
    setSaved(false);
  };
  const save = async () => {
    if (!sb) return;
    setErr(null);
    const { error } = await sb.rpc("set_match_profile", { p_student: student.id, p_profile: p });
    if (error) return setErr(friendly(error));
    if (isParent && income && income !== student.income_band) {
      const r = await sb.rpc("set_income_band", { p_student: student.id, p_band: income });
      if (r.error) return setErr(friendly(r.error));
    }
    setSaved(true);
    onSaved();
  };
  const one = (k: "plan" | "citizen" | "sex", v: string) => { setP({ ...p, [k]: v }); setSaved(false); };

  return (
    <details className="panel sch-profile" open={!answered}>
      <summary><b>Questions that improve {student.first_name}&apos;s matches</b> <span className="hint">({answered ? "answered, tap to change" : "about 1 minute"})</span></summary>
      <div className="checkin-q">
        <p className="checkin-label">What is {student.first_name} interested in? Pick any.</p>
        <div className="chips">{INTERESTS.map((i) => <button key={i} type="button" className={`chip ${(p.interests ?? []).includes(i) ? "chip-on" : ""}`} aria-pressed={(p.interests ?? []).includes(i)} onClick={() => toggle("interests", i)}>{i}</button>)}</div>
      </div>
      <div className="checkin-q">
        <p className="checkin-label">After high school, the plan is…</p>
        <div className="chips">
          {([["four_year", "A four-year college"], ["technical", "A technical college"], ["unsure", "Not sure yet"]] as const).map(([v, l]) => <button key={v} type="button" className={`chip ${p.plan === v ? "chip-on" : ""}`} aria-pressed={p.plan === v} onClick={() => one("plan", v)}>{l}</button>)}
        </div>
      </div>
      <div className="checkin-q">
        <p className="checkin-label">Is {student.first_name} a U.S. citizen or permanent resident? Many scholarships require it.</p>
        <div className="chips">
          {([["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] as const).map(([v, l]) => <button key={v} type="button" className={`chip ${p.citizen === v ? "chip-on" : ""}`} aria-pressed={p.citizen === v} onClick={() => one("citizen", v)}>{l}</button>)}
        </div>
      </div>
      <div className="checkin-q">
        <p className="checkin-label">Optional: is {student.first_name} female or male? A few scholarships are only for women or only for men.</p>
        <div className="chips">
          {([["female", "Female"], ["male", "Male"], ["prefer_not", "Prefer not to say"]] as const).map(([v, l]) => <button key={v} type="button" className={`chip ${p.sex === v ? "chip-on" : ""}`} aria-pressed={p.sex === v} onClick={() => one("sex", v)}>{l}</button>)}
        </div>
      </div>
      <div className="checkin-q">
        <p className="checkin-label">Optional: some scholarships are for specific groups. Pick any that apply, or skip this.</p>
        <div className="chips">
          {GROUPS.map((g) => <button key={g} type="button" className={`chip ${(p.groups ?? []).includes(g) ? "chip-on" : ""}`} aria-pressed={(p.groups ?? []).includes(g)} onClick={() => toggle("groups", g)}>{g}</button>)}
          <button type="button" className={`chip ${p.groups_answered && !(p.groups ?? []).length ? "chip-on" : ""}`} onClick={() => { setP({ ...p, groups: [], groups_answered: true }); setSaved(false); }}>None of these / prefer not to say</button>
        </div>
        <p className="hint" style={{ fontSize: 12, margin: "6px 0 0" }}>Only used to match scholarships. Never shared.</p>
      </div>
      {isParent && (
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="sch-income">Family income range (for need-based awards; your student can&apos;t see this unless you allow it)</label>
          <select id="sch-income" className="input" value={income} onChange={(e) => { setIncome(e.target.value as IncomeBand); setSaved(false); }}>
            <option value="">Choose…</option>
            {INCOME.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}
      {!isParent && !seesIncome && <p className="hint" style={{ fontSize: 13 }}>Need-based awards show as &ldquo;Maybe&rdquo;. A parent can check family income for those.</p>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <button className="btn btn-inline" onClick={() => void save()}>Save answers</button>
        {saved && <span className="hint" role="status">Saved. Matches updated.</span>}
        {err && <span className="note note-err" role="alert">{err}</span>}
      </div>
    </details>
  );
}

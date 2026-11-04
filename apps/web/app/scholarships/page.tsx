"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildScorecard, GROUPS, INTERESTS, matchScholarship, normalizeProfile,
  type CourseGrade, type IncomeBand, type MatchProfile, type MatchResult, type Scholarship, type StatePack,
} from "@scholartasks/core";
import gaPack from "../../../../packs/states/GA.json";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { ReportAi } from "../report-ai";

const GA = gaPack as unknown as StatePack;

interface Student {
  id: string; first_name: string; grade_level: number; state: string; sat: number | null; act: number | null;
  income_band: IncomeBand | null; permissions: Record<string, boolean>; weight_rigor?: number; weight_honors?: number;
  match_profile: MatchProfile | null;
}
interface Row extends Scholarship {
  kind: "scholarship" | "grant";
  sponsor: string; url: string; summary: string; how_to_apply: string | null; amount_text: string; amount_max: number | null;
  deadline_text: string | null; automatic: boolean; status: "pending" | "approved" | "retired"; last_checked: string | null;
}
interface Choice { id: string; student_id: string; scholarship_id: string; choice: "added" | "hidden"; task_id: string | null; done_steps?: number[]; essay_draft?: string | null }
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
  const [tab, setTab] = useState<Tab | null>(null);
  useEffect(() => setTab(null), [current]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/scholarships");
    const [mem, st, gr, sc, ch, cl] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("*").order("first_name"),
      sb.from("course_grades").select("student_id, term, course, grade, level, core, grade_level"),
      sb.from("scholarships").select("*").order("name"),
      sb.from("scholarship_choices").select("id, student_id, scholarship_id, choice, task_id, done_steps, essay_draft"),
      sb.from("student_colleges").select("student_id, name"),
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
    if (sc.error) setError(friendly(sc.error));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current) ?? null;
  const seesIncome = role === "parent" || !!student?.permissions?.see_income_and_costs;

  const results = useMemo(() => {
    if (!student || !list) return [];
    const hope = GA.programs.find((p) => p.rules.gpa_formula);
    const formula = hope?.rules.gpa_formula ? GA.gpa_formulas[hope.rules.gpa_formula] : undefined;
    const mine: CourseGrade[] = grades.filter((g) => g.student_id === student.id)
      .map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level }));
    const card = formula ? buildScorecard(mine, { currentGrade: student.grade_level, formula, target: 3, schoolWeights: { rigor: student.weight_rigor ?? 1, honors: student.weight_honors ?? 0.5 } }) : null;
    const who = {
      gradeLevel: student.grade_level, state: student.state,
      hopeGpa: card?.stateGpa ?? null, unweightedGpa: card?.overallGpa ?? null, weightedGpa: card?.schoolGpa ?? null,
      sat: student.sat, act: student.act, incomeBand: seesIncome ? student.income_band : null, profile: student.match_profile ?? {},
      colleges: colleges.filter((c) => c.student_id === student.id).map((c) => c.name),
    };
    return list.filter((s) => s.status !== "retired").map((s) => ({ s, r: matchScholarship(s, who) }))
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

  const addToDeadlines = async (s: Row, due: string) => {
    if (!sb || !student) return;
    setError(null);
    const { data: t, error: e } = await sb.from("tasks").insert({
      student_id: student.id, title: s.name, kind: s.kind === "grant" ? "aid" : "scholarship", due_on: due || null, url: s.url, amount: s.amount_max,
    }).select("id").single();
    if (e) return setError(friendly(e));
    const { error: e2 } = await sb.from("scholarship_choices").upsert({ student_id: student.id, scholarship_id: s.id, choice: "added", task_id: (t as { id: string }).id }, { onConflict: "student_id,scholarship_id" });
    if (e2) return setError(friendly(e2));
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
      <p className="hint" style={{ marginTop: -8 }}>
        Georgia and national scholarships and grants, checked against {student ? `${student.first_name}'s` : "your student's"} grades, test scores and answers below. A &ldquo;Maybe&rdquo; tells you what to check. Always confirm the details on the official site before applying.
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
            <ScholarshipCard key={s.id} s={s} r={r} choice={choiceOf(s.id)} onAdd={addToDeadlines} onHide={hide} />
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

function ScholarshipCard({ s, r, choice, onAdd, onHide }: {
  s: Row; r: MatchResult; choice?: Choice; onAdd: (s: Row, due: string) => Promise<void>; onHide: (s: Row) => Promise<void>;
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
          {s.status === "pending" && <div><span className="pill pill-soon">Not yet verified</span></div>}
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
        {choice?.choice === "added" ? (
          <span className="pill pill-ok">On your deadlines ✓ <a href="/plan">See plan</a></span>
        ) : s.automatic ? null : adding ? (
          <>
            <label className="hint" htmlFor={`due-${s.id}`} style={{ margin: 0 }}>Due</label>
            <input id={`due-${s.id}`} type="date" className="input" style={{ width: 170 }} value={due} onChange={(e) => setDue(e.target.value)} />
            <button className="btn btn-inline btn-sm" onClick={() => void onAdd(s, due)}>Save</button>
          </>
        ) : (
          <button className="btn btn-inline btn-sm" onClick={() => setAdding(true)}>Add to my deadlines</button>
        )}
        {!choice && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onHide(s)}>Not for us</button>}
      </div>
      {choice?.choice === "added" && <ApplyHelp s={s} choice={choice} />}
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

interface Steps { steps: { title: string; detail: string }[]; essay_prompts: string[]; sources: string[] }
interface Feedback { strengths: string[]; improve: string[]; answers_prompt: string; word_count_note: string; next_step: string; words: number }

/** "Get ready to apply": the checklist for one saved award, plus the essay coach. */
function ApplyHelp({ s, choice }: { s: Row; choice: Choice }) {
  const sb = supabase();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Steps | null>(null);
  const [done, setDone] = useState<number[]>(choice.done_steps ?? []);
  const [draft, setDraft] = useState(choice.essay_draft ?? "");
  const [prompt, setPrompt] = useState("");
  const [limit, setLimit] = useState("");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<"steps" | "essay" | "save" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async <T,>(path: string, body: object): Promise<T> => {
    const { data } = await sb!.auth.getSession();
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
    return out as T;
  };
  const loadSteps = async () => {
    setOpen(true); setMsg(null);
    if (steps || !sb) return;
    const { data } = await sb.from("scholarship_steps").select("steps, essay_prompts, sources").eq("scholarship_id", s.id).maybeSingle();
    if (data) { setSteps(data as Steps); setPrompt((data as Steps).essay_prompts[0] ?? ""); }
  };
  const makeSteps = async () => {
    setBusy("steps"); setMsg(null);
    try { const out = await call<Steps>("/api/scholarships/steps", { studentId: choice.student_id, scholarshipId: s.id }); setSteps(out); setPrompt(out.essay_prompts[0] ?? ""); }
    catch (e) { setMsg((e as Error).message); }
    setBusy(null);
  };
  const toggle = async (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    const { error } = await sb!.from("scholarship_choices").update({ done_steps: next }).eq("id", choice.id);
    if (error) setMsg(friendly(error));
  };
  const saveDraft = async () => {
    setBusy("save"); setMsg(null);
    const { error } = await sb!.from("scholarship_choices").update({ essay_draft: draft.slice(0, 12000) || null }).eq("id", choice.id);
    setMsg(error ? friendly(error) : "Draft saved.");
    setBusy(null);
  };
  const coach = async () => {
    setBusy("essay"); setMsg(null); setFb(null);
    try {
      await sb!.from("scholarship_choices").update({ essay_draft: draft.slice(0, 12000) || null }).eq("id", choice.id);
      setFb(await call<Feedback>("/api/scholarships/essay", { studentId: choice.student_id, scholarshipId: s.id, prompt, limit, draft }));
    } catch (e) { setMsg((e as Error).message); }
    setBusy(null);
  };
  const words = draft.split(/\s+/).filter(Boolean).length;

  if (!open) return <button className="btn btn-inline btn-sm" style={{ marginTop: 10 }} onClick={() => void loadSteps()}>📝 Get ready to apply</button>;
  return (
    <div className="sch-apply">
      <h3 style={{ margin: "14px 0 6px" }}>Get ready to apply</h3>
      {!steps ? (
        <p className="hint">
          We can read the official page and make a step-by-step checklist (uses 1 AI use; free after the first family asks).{" "}
          <button className="btn btn-inline btn-sm" disabled={busy === "steps"} onClick={() => void makeSteps()}>{busy === "steps" ? "Reading the official page…" : "Make my checklist"}</button>
        </p>
      ) : (
        <>
          <p className="hint" style={{ margin: "0 0 6px" }}>{done.filter((i) => i < steps.steps.length).length} of {steps.steps.length} done. Always confirm on the <a href={s.url} target="_blank" rel="noopener noreferrer">official site</a>.</p>
          <ol className="sch-steps">
            {steps.steps.map((x, i) => (
              <li key={i}>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={done.includes(i)} onChange={() => void toggle(i)} style={{ marginTop: 4 }} />
                  <span><b style={done.includes(i) ? { textDecoration: "line-through" } : undefined}>{x.title}</b><br /><span className="hint">{x.detail}</span></span>
                </label>
              </li>
            ))}
          </ol>
        </>
      )}
      <h3 style={{ margin: "14px 0 6px" }}>Essay coach</h3>
      <p className="hint" style={{ margin: "0 0 8px" }}>Write your own essay here. The coach gives feedback (1 AI use each time), but it won&apos;t write it for you: the people who award it want your own words.</p>
      {steps && steps.essay_prompts.length > 1 ? (
        <select className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Essay prompt">
          {steps.essay_prompts.map((p) => <option key={p} value={p}>{p.length > 120 ? p.slice(0, 117) + "…" : p}</option>)}
        </select>
      ) : (
        <textarea className="input" rows={2} placeholder="Essay prompt (copy it from the official site)" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      )}
      <input className="input" style={{ marginTop: 6, maxWidth: 260 }} placeholder="Length limit, e.g. 500 words" value={limit} onChange={(e) => setLimit(e.target.value)} />
      <textarea className="input" rows={10} style={{ marginTop: 6 }} placeholder="Your draft" value={draft} maxLength={12000} onChange={(e) => setDraft(e.target.value)} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <span className="hint">{words} words</span>
        <button className="btn btn-ghost btn-inline btn-sm" disabled={busy !== null} onClick={() => void saveDraft()}>Save draft</button>
        <button className="btn btn-inline btn-sm" disabled={busy !== null || words < 8} onClick={() => void coach()}>{busy === "essay" ? "Reading your draft…" : "Get feedback"}</button>
      </div>
      {msg && <p className="hint" role="status">{msg}</p>}
      {fb && (
        <div className="panel" style={{ marginTop: 10 }}>
          {fb.answers_prompt !== "no prompt" && <p style={{ margin: "0 0 6px" }}><b>Answers the prompt:</b> {fb.answers_prompt}</p>}
          <p style={{ margin: "0 0 4px" }}><b>What works</b></p>
          <ul>{fb.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
          <p style={{ margin: "0 0 4px" }}><b>To make it stronger</b></p>
          <ul>{fb.improve.map((x) => <li key={x}>{x}</li>)}</ul>
          {fb.word_count_note && <p className="hint">{fb.word_count_note}</p>}
          <p style={{ margin: 0 }}><b>Next step:</b> {fb.next_step}</p>
          <ReportAi feature="essay coach" text={[...fb.strengths, ...fb.improve, fb.next_step].join("\n")} />
        </div>
      )}
    </div>
  );
}

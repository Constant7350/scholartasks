"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AID_STAGES,
  AidGuide,
  AidStep,
  aidCycleFor,
  aidProgress,
  aidSteps,
  deadlineAppliesTo,
  documentsFor,
  fafsaContributors,
  fillCycle,
  type HouseholdAnswers,
} from "@scholartasks/core";
import { aidOfficeFor, meritNames, packFor, stateName } from "../../lib/state-packs";
import guideJson from "../../../../packs/federal/aid-guide.json";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import "./aid.css";
import "../trades/trades.css";
import { TradeAidList } from "../trades/aid-list";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";

const GUIDE = AidGuide.parse(guideJson);
const TYPE: Record<string, string> = { merit: "Grades and scores", need: "Based on need", merit_and_need: "Grades and need", grant: "Grant", tuition_discount: "Lower tuition" };

interface Student { id: string; first_name: string; grade_level: number; state: string }
interface College { id: string; student_id: string; name: string; status: string }
interface Task { id: string; student_id: string; title: string; kind: string; due_on: string | null; status: string; deadline_id: string | null; college_id: string | null }
interface Progress { step_id: string; status: "done" | "skipped"; cycle: string; student_id: string }
interface Household { student_id: string; answers: HouseholdAnswers; docs_found: string[] }

const WHO: Record<AidStep["who"], string> = { student: "👩‍🎓 Student", parent: "👪 Parent", family: "🤝 Together" };
const todayIso = () => new Date().toLocaleDateString("en-CA");
const nice = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T12:00:00") - Date.parse(todayIso() + "T12:00:00")) / 86_400_000);
const missingTables = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? ""));

const PARENTS: [NonNullable<HouseholdAnswers["parents"]>, string][] = [
  ["married", "Married to each other"],
  ["unmarried_together", "Not married, living together"],
  ["divorced_separated", "Divorced or separated"],
  ["remarried", "Divorced, and the parent remarried"],
  ["single_widowed", "Single parent, or widowed"],
];
const FLAGS: [keyof HouseholdAnswers, string][] = [
  ["student_worked", "The student had a job in {tax_year}"],
  ["investments", "We have investments, a 529 plan, or property other than our home"],
  ["business_or_farm", "We own a business or farm"],
  ["self_employed", "A parent is self-employed or does gig work"],
  ["child_support", "We received child support in {tax_year}"],
  ["parent_no_ssn", "A contributing parent has no Social Security number"],
];

export default function AidPage() {
  const sb = supabase();
  const [me, setMe] = useState<{ id: string; role: "parent" | "student" | null } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [colleges, setColleges] = useState<College[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/aid");
    const uid = s.session.user.id;
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", uid),
      sb.from("students").select("id, first_name, grade_level, state").order("first_name"),
    ]);
    const rows = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
    const asStudent = rows.find((r) => r.role === "student");
    const role = rows.some((r) => r.role === "parent") ? "parent" : asStudent ? "student" : null;
    setMe({ id: uid, role });
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (role === "student" ? asStudent?.student_id ?? null : pickStudent(list, list.find((x) => x.grade_level >= 11)?.id ?? list[0]?.id)));
    const [pr, hh, col, tk] = await Promise.all([
      sb.from("aid_progress").select("student_id, cycle, step_id, status"),
      sb.from("aid_households").select("student_id, answers, docs_found"),
      sb.from("student_colleges").select("id, student_id, name, status").order("name"),
      sb.from("tasks").select("id, student_id, title, kind, due_on, status, deadline_id, college_id").eq("kind", "aid"),
    ]);
    if (missingTables(pr.error) || missingTables(hh.error)) return setOffline(true);
    setOffline(false);
    setProgress((pr.data as Progress[]) ?? []);
    setHouseholds((hh.data as Household[]) ?? []);
    setColleges((col.data as College[]) ?? []);
    setTasks((tk.data as Task[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current);
  const pack = packFor(student?.state);
  // The pack JSON is imported raw, so parse it to fill in defaults (e.g. empty watch_out lists).
  const STEPS = useMemo(() => aidSteps(GUIDE, AidStep.array().parse(pack?.aid_steps ?? [])), [pack]);
  const cycle = student ? aidCycleFor(GUIDE, student.grade_level, todayIso()) : undefined;
  const cycleId = cycle?.id ?? "later";
  const mine = progress.filter((p) => p.student_id === current && p.cycle === cycleId);
  const statusOf = (id: string) => mine.find((p) => p.step_id === id)?.status;
  const summary = aidProgress(STEPS, mine);
  const house = households.find((h) => h.student_id === current);
  const answers: HouseholdAnswers = house?.answers ?? {};
  const docs = useMemo(() => documentsFor(GUIDE, answers, cycle), [answers, cycle]);
  const who = fafsaContributors(answers);
  const isParent = me?.role === "parent";
  const myColleges = colleges.filter((c) => c.student_id === current && !["denied", "withdrawn"].includes(c.status));
  const myAidTasks = tasks.filter((t) => t.student_id === current);
  const packDates = student && pack ? pack.deadlines.filter((d) => d.form !== "GSFAPP" && deadlineAppliesTo(d, student.grade_level, todayIso()) && daysUntil(d.date) >= -365) : [];

  if (!sb) return <Page title="Financial aid forms"><NotConfigured /></Page>;
  if (!me) return <Page title="Financial aid forms"><p className="hint">Loading…</p></Page>;

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) setError(friendly(e));
    await load();
    return !e;
  };
  const setStep = (id: string, status: "done" | "skipped" | null) =>
    run(() => status
      ? sb.from("aid_progress").upsert({ student_id: current, cycle: cycleId, step_id: id, status, updated_at: new Date().toISOString() }, { onConflict: "student_id,cycle,step_id" })
      : sb.from("aid_progress").delete().eq("student_id", current!).eq("cycle", cycleId).eq("step_id", id));
  const saveHouse = (patch: Partial<Household>) =>
    run(() => sb.from("aid_households").upsert({ student_id: current, answers, docs_found: house?.docs_found ?? [], ...patch, updated_at: new Date().toISOString() }, { onConflict: "student_id" }));
  const setAnswer = (k: keyof HouseholdAnswers, v: unknown) => {
    const next = { ...answers, [k]: v } as Record<string, unknown>;
    if (v === undefined || v === "") delete next[k];
    if (k === "parents" && !["married", "remarried"].includes(String(v))) delete next.filed_jointly;
    return saveHouse({ answers: next as HouseholdAnswers });
  };
  const toggleDoc = (id: string) => {
    const found = house?.docs_found ?? [];
    return saveHouse({ docs_found: found.includes(id) ? found.filter((x) => x !== id) : [...found, id] });
  };

  if (offline)
    return (
      <Page title="Financial aid forms">
        <div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>The financial aid checklist is switching on. Check back shortly.</p></div>
      </Page>
    );

  if (!me.role || !student)
    return (
      <Page title="Financial aid forms">
        <div className="panel family-card">
          <div>
            <h2>Add your student first</h2>
            <p className="hint" style={{ margin: 0 }}>The FAFSA checklist follows your student's graduation year. Add them, then come back.</p>
          </div>
          <a className="btn btn-inline link-btn" href="/family">Add a student</a>
        </div>
      </Page>
    );

  const early = student.grade_level < 11;
  const found = house?.docs_found ?? [];
  const ask = (s: AidStep) => `/counselor?ask=${encodeURIComponent(`Help me with this financial aid step for ${student.first_name}: "${fillCycle(s.title, cycle)}". What should we do, and what are the common mistakes?`)}`;

  return (
    <Page title={isParent ? `${student.first_name}'s financial aid forms` : "My financial aid forms"}>
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {error && <p className="note note-err" role="alert">{error}</p>}

      <section className="panel aid-summary">
        <div>
          <p className="eyebrow">{cycle ? `${cycle.id} FAFSA · class of ${cycle.for_class_of}` : "FAFSA"}</p>
          <h2>{summary.left === 0 ? "All done 🎉" : `${summary.done} of ${summary.total - summary.skipped} steps done`}</h2>
          <div className="aid-bar" aria-hidden="true"><span style={{ width: `${Math.round((100 * (summary.done + summary.skipped)) / summary.total)}%` }} /></div>
          {cycle && (
            <p className="hint" style={{ margin: "10px 0 0" }}>
              {daysUntil(cycle.opens) > 0 ? `Opens ${nice(cycle.opens)}${cycle.opens_expected ? " (usual date)" : ""}` : `Open since ${nice(cycle.opens)}`}
              {" · "}uses {cycle.tax_year} taxes · federal deadline {nice(cycle.federal_deadline)}. File early: {pack?.name ?? "most states"} and most colleges hand out money first come, first served.
            </p>
          )}
        </div>
        {summary.next && (
          <button className="btn btn-inline" onClick={() => { setOpen(summary.next!.id); document.getElementById(`step-${summary.next!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
            Next: {fillCycle(summary.next.title, cycle)}
          </button>
        )}
      </section>

      <p className="note note-info aid-safe">
        🔒 ScholarTasks helps you get ready, but you file on the official sites. We never ask for or keep any of these: {GUIDE.never_store.join("; ")}.
      </p>

      {early && (
        <section className="panel">
          <h2>It's early, and that's good</h2>
          <p className="hint" style={{ margin: 0 }}>
            {student.first_name} files the FAFSA in the fall of senior year{cycle ? ` (the ${cycle.id} form, using ${cycle.tax_year} taxes)` : ""}. For now, get a rough idea of aid with the{" "}
            <a href="https://studentaid.gov/aid-estimator/" target="_blank" rel="noreferrer noopener">Federal Student Aid Estimator</a>, keep grades up for {meritNames(pack)}, and read the steps below so nothing is a surprise.
          </p>
        </section>
      )}

      <section className="panel">
        <h2>Who fills in the FAFSA</h2>
        <ul className="aid-people">{who.people.map((p) => <li key={p}>{p}</li>)}</ul>
        {who.note && <p className="hint" style={{ margin: "8px 0 0" }}>{who.note} <a href="https://studentaid.gov/apply-for-aid/fafsa/filling-out/parent-info" target="_blank" rel="noreferrer noopener">Check the official rules</a>.</p>}
        <details className="aid-house" open={!answers.parents}>
          <summary>{answers.parents ? "Change household answers" : "Answer 6 quick questions"}</summary>
          {!isParent && <p className="note note-info">A parent answers these. You can see them and check off documents.</p>}
          <fieldset disabled={!isParent} className="aid-fields">
            <div className="field">
              <label htmlFor="h-parents">The student's parents are…</label>
              <select id="h-parents" className="input" value={answers.parents ?? ""} onChange={(e) => setAnswer("parents", e.target.value || undefined)}>
                <option value="">Choose one</option>
                {PARENTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {(answers.parents === "married" || answers.parents === "remarried") && (
              <div className="field">
                <label htmlFor="h-joint">Did they file one joint {cycle?.tax_year ?? ""} tax return?</label>
                <select id="h-joint" className="input" value={answers.filed_jointly === undefined ? "" : String(answers.filed_jointly)} onChange={(e) => setAnswer("filed_jointly", e.target.value === "" ? undefined : e.target.value === "true")}>
                  <option value="">Choose one</option>
                  <option value="true">Yes, filed jointly</option>
                  <option value="false">No, filed separately</option>
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="h-filed">Did the contributing parent(s) file a {cycle?.tax_year ?? ""} federal tax return?</label>
              <select id="h-filed" className="input" value={answers.parent_filed_taxes ?? ""} onChange={(e) => setAnswer("parent_filed_taxes", e.target.value || undefined)}>
                <option value="">Choose one</option>
                <option value="yes">Yes</option>
                <option value="not_yet">Not yet</option>
                <option value="no">No, not required to</option>
              </select>
            </div>
            {FLAGS.map(([k, label]) => (
              <label key={k} className="aid-flag">
                <input type="checkbox" checked={answers[k] === true} onChange={(e) => setAnswer(k, e.target.checked || undefined)} />
                {fillCycle(label, cycle)}
              </label>
            ))}
          </fieldset>
        </details>
      </section>

      <section className="panel">
        <h2>Documents to have ready</h2>
        <p className="hint">{found.filter((id) => docs.some((d) => d.id === id)).length} of {docs.length} found. Check each one when it's in hand. Keep the papers at home; don't upload them here.</p>
        <ul className="items">
          {docs.map((d) => (
            <li key={d.id} className={found.includes(d.id) ? "is-done" : ""}>
              <label className="item-main item-check">
                <input type="checkbox" checked={found.includes(d.id)} onChange={() => toggleDoc(d.id)} />
                <span><b>{d.text}</b>{d.hint && <span className="hint">{d.hint}</span>}</span>
              </label>
              <span className="pill">{WHO[d.who]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Aid dates and reminders</h2>
        <p className="hint">Add the dates you want email reminders for. Each college's own "priority date" for aid is usually on its financial aid page and is much earlier than the federal deadline.</p>
        <ul className="items">
          {packDates.map((d) => {
            const added = myAidTasks.some((t) => t.deadline_id === d.id);
            return (
              <li key={d.id}>
                <div className="item-main"><b>{d.title}</b><span className="hint">{d.kind === "opens" ? "Opens" : "Due"} {nice(d.date)}</span></div>
                <div className="item-actions">
                  {added ? <span className="pill pill-ok">On your plan</span> : daysUntil(d.date) < 0 ? <span className="pill pill-ok">Open now</span> : (
                    <button className="btn btn-ghost btn-inline btn-sm" onClick={() => run(() => sb.from("tasks").insert({ student_id: student.id, title: d.title, kind: "aid", due_on: d.date, deadline_id: d.id, url: d.where }))}>Remind me</button>
                  )}
                </div>
              </li>
            );
          })}
          {myColleges.map((c) => {
            const t = myAidTasks.find((x) => x.college_id === c.id);
            return (
              <li key={c.id}>
                <div className="item-main"><b>{c.name}: financial aid priority date</b><span className="hint">{t?.due_on ? `Due ${nice(t.due_on)}` : "Check the college's financial aid page"}</span></div>
                <div className="item-actions">
                  {t ? (
                    <>
                      <span className="pill pill-ok">Reminders on</span>
                      <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${c.name} aid date`} onClick={() => run(() => sb.from("tasks").delete().eq("id", t.id))}>Remove</button>
                    </>
                  ) : (
                    <>
                      <input type="date" className="input input-sm" aria-label={`${c.name} aid priority date`} value={dates[c.id] ?? ""} onChange={(e) => setDates({ ...dates, [c.id]: e.target.value })} />
                      <button className="btn btn-inline btn-sm" disabled={!dates[c.id]} onClick={() => run(() => sb.from("tasks").insert({ student_id: student.id, college_id: c.id, title: `${c.name}: financial aid priority date`, kind: "aid", due_on: dates[c.id] }))}>Add</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {myColleges.length === 0 && <p className="hint" style={{ margin: "10px 0 0" }}>Add colleges on your <a href="/plan">college plan</a> to track each one's aid date here.</p>}
      </section>

      {AID_STAGES.map((stage) => {
        const steps = STEPS.filter((s) => s.stage === stage.id);
        return (
          <section key={stage.id} className="panel">
            <h2>{stage.title}</h2>
            <ol className="aid-steps">
              {steps.map((s) => {
                const st = statusOf(s.id);
                return (
                  <li key={s.id} id={`step-${s.id}`} className={`aid-step ${st ? "is-" + st : ""}`}>
                    <details open={open === s.id} onToggle={(e) => { const o = (e.target as HTMLDetailsElement).open; if (o) setOpen(s.id); else if (open === s.id) setOpen(null); }}>
                      <summary>
                        <span className="aid-check" aria-hidden="true">{st === "done" ? "✓" : st === "skipped" ? "–" : ""}</span>
                        <span className="aid-title">
                          <b>{fillCycle(s.title, cycle)}</b>
                          <span className="hint">{WHO[s.who]}{s.minutes ? ` · about ${s.minutes} min` : ""}{st === "skipped" ? " · doesn't apply" : ""}</span>
                        </span>
                      </summary>
                      <div className="aid-body">
                        <p>{fillCycle(s.summary, cycle)}</p>
                        <ol>{s.how.map((h) => <li key={h}>{fillCycle(h, cycle)}</li>)}</ol>
                        {s.watch_out.map((w) => <p key={w} className="note aid-watch">⚠️ {fillCycle(w, cycle)}</p>)}
                        <div className="item-actions" style={{ marginTop: 12 }}>
                          {s.link && <a className="btn btn-inline btn-sm link-btn" href={s.link.url} target="_blank" rel="noreferrer noopener">{s.link.label} ↗</a>}
                          {st === "done" ? (
                            <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setStep(s.id, null)}>Mark not done</button>
                          ) : (
                            <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setStep(s.id, "done")}>✓ Mark done</button>
                          )}
                          {s.optional && st !== "skipped" && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setStep(s.id, "skipped")}>Doesn't apply to us</button>}
                          {st === "skipped" && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setStep(s.id, null)}>It applies after all</button>}
                          <a className="aid-ask" href={ask(s)}>🤖 Ask the AI counselor (1 AI use)</a>
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <section className="panel" id="state-aid">
        <h2>{stateName(student.state)} state aid</h2>
        {pack ? (
          <>
            <p className="hint">Every {pack.name} program in ScholarTasks. Most come from the FAFSA; any extra state form is in the steps above. These only pay at {pack.name} colleges, so out-of-state schools need other aid.</p>
            <ul className="items">
              {pack.programs.map((p) => (
                <li key={p.id}>
                  <div className="item-main">
                    <b>{p.name} <span className="pill">{TYPE[p.type] ?? p.type}</span></b>
                    <span>{p.summary}</span>
                    <span className="hint">{p.award.summary} · <a href={p.source_url} target="_blank" rel="noreferrer noopener">Official page</a></span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="hint" style={{ fontSize: 12 }}>Draft details, being checked with the <a href={pack.agency.url} target="_blank" rel="noreferrer noopener">{pack.agency.name}</a>.</p>
          </>
        ) : (() => {
          const office = aidOfficeFor(student.state);
          return (
            <p className="hint">
              ScholarTasks doesn&apos;t have {stateName(student.state)}&apos;s state aid rules yet. The FAFSA steps above still count for state grants. Check the{" "}
              <a href={office.url} target="_blank" rel="noreferrer noopener">{office.name}</a>{office.programs.length ? ` (programs such as ${office.programs.join(", ")})` : ""} for state deadlines.
            </p>
          );
        })()}
      </section>
      <section className="panel" id="trades">
        <h2>Paying for trade school or a short program</h2>
        <p className="hint">
          For a technical college, apprenticeship or trade school. The FAFSA above still matters: it unlocks the Pell Grant and {student.state === "GA" ? "the HOPE Grant" : "state grants"}.
          See every trade on the <a href="/trades">Trades page</a>.
        </p>
        <TradeAidList homeState={student.state} />
      </section>
      <p className="hint" style={{ fontSize: 13 }}>
        Draft guide, being checked against StudentAid.gov and the {pack?.agency.name ?? "state aid offices"}. Always follow the official sites if anything differs.
      </p>
    </Page>
  );
}

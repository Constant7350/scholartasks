"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { CATEGORIES, LIMITS, RECOGNITION, checkup, descriptionTips, gradeText, hoursPerYear, type Activity, type BragSheet, type Recommender, type ServiceEntry } from "./shared";
import { Brag, Checkup, Recommenders, ServiceLog } from "./beyond";

interface Student { id: string; first_name: string; grade_level: number }

const GRADES = [9, 10, 11, 12];
const blank = (kind: Activity["kind"]) => ({
  id: "", kind, category: kind === "honor" ? "other" : "club", position: "", organization: "", description: "",
  grades: [] as number[], hours: "", weeks: "", recognition: "school", ongoing: true,
});
type Draft = ReturnType<typeof blank>;

const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? ""));

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`hint ${n > max ? "note-err" : ""}`} style={{ marginLeft: 6 }}>{n}/{max}</span>;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button type="button" className="btn btn-ghost btn-inline btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* no clipboard */ }
    }}>{done ? "Copied ✓" : "Copy"}</button>
  );
}

/**
 * Activities, honors and awards, entered once in Common App format and
 * printed as a resume. Students keep their own list; parents can help.
 */
export default function ActivitiesPage() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [rows, setRows] = useState<Activity[]>([]);
  const [tab, setTab] = useState<Activity["kind"]>("activity");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [offline, setOffline] = useState(false);
  const [service, setService] = useState<ServiceEntry[]>([]);
  const [recs, setRecs] = useState<Recommender[]>([]);
  const [brags, setBrags] = useState<BragSheet[]>([]);
  // The service log, recommenders and brag sheet switch on with database update 32.
  const [beyondOn, setBeyondOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/activities");
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, grade_level").order("first_name"),
    ]);
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    const list = (st.data as Student[]) ?? [];
    setIsParent(m.some((r) => r.role === "parent"));
    setStudents(list);
    setCurrent((c) => c ?? (own ?? pickStudent(list, list[0]?.id)));
    const { data, error: e } = await sb.from("student_activities").select("*").order("sort_order").order("created_at");
    if (missingTable(e)) { setOffline(true); setReady(true); return; }
    setOffline(false);
    setRows((data as Activity[]) ?? []);
    const [sv, rc, bg] = await Promise.all([
      sb.from("service_hours").select("id, student_id, served_on, hours, organization, note").order("served_on", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("recommenders").select("id, student_id, name, role, subject, status, asked_on, notes").order("created_at"),
      sb.from("brag_sheets").select("student_id, answers, updated_at"),
    ]);
    setBeyondOn(!sv.error && !rc.error && !bg.error);
    setService((sv.data as ServiceEntry[]) ?? []);
    setRecs((rc.data as Recommender[]) ?? []);
    setBrags((bg.data as BragSheet[]) ?? []);
    setReady(true);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  // Links like /activities#recs land on the right section once it has loaded.
  useEffect(() => {
    if (!ready || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ready]);

  if (!sb) return <Page title="Activities and resume"><NotConfigured /></Page>;
  if (!ready) return <Page title="Activities and resume"><p className="hint">Loading…</p></Page>;
  if (offline)
    return <Page title="Activities and resume"><div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>Activities are switching on. Check back shortly.</p></div></Page>;
  const student = students.find((s) => s.id === current);
  if (!student)
    return <Page title="Activities and resume"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const mine = rows.filter((r) => r.student_id === student.id);
  const myService = service.filter((r) => r.student_id === student.id);
  const myRecs = recs.filter((r) => r.student_id === student.id);
  const myBrag = brags.find((b) => b.student_id === student.id) ?? null;
  const list = mine.filter((r) => r.kind === tab);
  const activities = mine.filter((r) => r.kind === "activity");
  const honors = mine.filter((r) => r.kind === "honor");
  const totalHours = activities.reduce((n, a) => n + hoursPerYear(a), 0);
  const isHonor = tab === "honor";
  const cap = isHonor ? LIMITS.honors : LIMITS.activities;

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await fn();
    if (e) { setError(friendly(e)); return false; }
    await load();
    return true;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const row = {
      student_id: student.id, kind: draft.kind, category: draft.category, position: draft.position.trim(),
      organization: draft.organization.trim() || null, description: draft.description.trim() || null,
      grades: draft.grades, ongoing: draft.ongoing,
      hours_per_week: draft.kind === "activity" && draft.hours ? Number(draft.hours) : null,
      weeks_per_year: draft.kind === "activity" && draft.weeks ? Number(draft.weeks) : null,
      recognition: draft.kind === "honor" ? draft.recognition : null,
    };
    const ok = draft.id
      ? await run(() => sb.from("student_activities").update(row).eq("id", draft.id))
      : await run(() => sb.from("student_activities").insert({ ...row, sort_order: list.length }));
    if (ok) setDraft(null);
  };

  const edit = (a: Activity) => setDraft({
    id: a.id, kind: a.kind, category: a.category, position: a.position, organization: a.organization ?? "",
    description: a.description ?? "", grades: a.grades ?? [], hours: a.hours_per_week?.toString() ?? "",
    weeks: a.weeks_per_year?.toString() ?? "", recognition: a.recognition ?? "school", ongoing: a.ongoing,
  });

  /** Colleges read activities in the order you list them, most important first. */
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const order = [...list];
    [order[i], order[j]] = [order[j]!, order[i]!];
    await run(async () => {
      for (const [n, a] of order.entries()) {
        const { error: e } = await sb.from("student_activities").update({ sort_order: n }).eq("id", a.id);
        if (e) return { error: e };
      }
      return { error: null };
    });
  };

  const remove = (a: Activity) => {
    if (window.confirm(`Remove "${a.position}"?`)) void run(() => sb.from("student_activities").delete().eq("id", a.id));
  };

  const posMax = isHonor ? LIMITS.honorTitle : LIMITS.position;
  const tips = draft && !isHonor ? descriptionTips(draft.description) : [];
  const tooLong = !!draft && (draft.position.length > posMax || draft.organization.length > LIMITS.organization || draft.description.length > LIMITS.description);
  const title = isParent ? `${student.first_name}'s activities and awards` : "My activities and awards";

  return (
    <Page title={title}>
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint">Add each club, sport, job, volunteer role and award once. It&apos;s set up the way the Common App asks, so you can copy each line straight in, and it prints as a one-page resume for scholarships and jobs.</p>

      <div className="todo-summary">
        <span className="todo-count"><b>{activities.length}</b> activities</span>
        <span className="todo-count"><b>{honors.length}</b> honors and awards</span>
        <span className="todo-count"><b>{totalHours.toLocaleString()}</b> hours a year</span>
      </div>
      <p><a className="btn btn-inline link-btn" href={`/activities/resume?student=${student.id}`}>📄 Make my resume</a> <a className="btn btn-ghost btn-inline link-btn" href="/activities/profile">📋 Copy for applications</a> <a className="btn btn-ghost btn-inline link-btn" href="/activities/common-app">✅ Common App ready</a></p>

      {beyondOn && (
        <Checkup grade={student.grade_level} items={checkup(student.grade_level, mine, myService, myRecs, myBrag)} />
      )}

      {error && <p className="note note-err" role="alert">{error}</p>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "activity"} onClick={() => { setTab("activity"); setDraft(null); }}>Activities ({activities.length})</button>
        <button role="tab" aria-selected={tab === "honor"} onClick={() => { setTab("honor"); setDraft(null); }}>Honors and awards ({honors.length})</button>
      </div>

      <section className="panel" id="activities">
        <h2>{isHonor ? "Honors and awards" : "Activities"}</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {isHonor
            ? `The Common App has room for ${LIMITS.honors} honors. List the biggest first: national, then state, then school.`
            : `The Common App has room for ${LIMITS.activities} activities. Put the one that matters most to you first. Jobs and family duties count.`}
          {list.length > cap && ` You have ${list.length}; only the top ${cap} fit on the Common App, but all of them go on your resume.`}
        </p>
        {list.length === 0 && !draft && <p className="hint">Nothing here yet. Tap the button below to add the first one.</p>}
        <ol className="items activity-list">
          {list.map((a, i) => (
            <li key={a.id} className={`activity-item${i >= cap ? " is-extra" : ""}`}>
              <div className="todo-top">
                <div className="item-main">
                  <b>{a.position}{a.organization ? `, ${a.organization}` : ""}</b>
                  <span className="hint">
                    {isHonor ? RECOGNITION[a.recognition ?? "school"] : CATEGORIES[a.category]}
                    {a.grades.length ? ` · ${gradeText(a.grades)}` : ""}
                    {!isHonor && a.hours_per_week ? ` · ${a.hours_per_week} hrs/week, ${a.weeks_per_year ?? 0} weeks/year` : ""}
                  </span>
                  {a.description && <span>{a.description} <CopyBtn text={a.description} /></span>}
                </div>
                <div className="item-actions">
                  <button className="btn btn-ghost btn-inline btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => void move(i, -1)}>↑</button>
                  <button className="btn btn-ghost btn-inline btn-sm" aria-label="Move down" disabled={i === list.length - 1} onClick={() => void move(i, 1)}>↓</button>
                  <button className="btn btn-ghost btn-inline btn-sm" onClick={() => edit(a)}>Edit</button>
                  <button className="btn btn-ghost btn-inline btn-sm" onClick={() => remove(a)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {!draft ? (
          <button className="btn btn-inline" onClick={() => setDraft(blank(tab))}>+ Add {isHonor ? "an honor or award" : "an activity"}</button>
        ) : (
          <form className="panel activity-form" onSubmit={save}>
            <h3 style={{ marginTop: 0 }}>{draft.id ? "Edit" : "Add"} {isHonor ? "honor or award" : "activity"}</h3>
            {!isHonor && (
              <div className="field"><label htmlFor="a-cat">Type</label>
                <select id="a-cat" className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            )}
            <div className="field"><label htmlFor="a-pos">{isHonor ? "Name of the honor or award" : "Your role or position"}<Counter n={draft.position.length} max={posMax} /></label>
              <input id="a-pos" className="input" required value={draft.position} placeholder={isHonor ? "AP Scholar with Distinction" : "Captain, Barn helper, Member"}
                onChange={(e) => setDraft({ ...draft, position: e.target.value })} /></div>
            {!isHonor && (
              <div className="field"><label htmlFor="a-org">Club, team or employer<Counter n={draft.organization.length} max={LIMITS.organization} /></label>
                <input id="a-org" className="input" value={draft.organization} placeholder="FFA, Varsity soccer, Oak Hill Farm"
                  onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></div>
            )}
            {!isHonor && (
              <div className="field"><label htmlFor="a-desc">What you did and what came of it<Counter n={draft.description.length} max={LIMITS.description} /></label>
                <textarea id="a-desc" className="input" rows={3} value={draft.description} placeholder="Trained 6 new volunteers; raised $2,400 for the county shelter."
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                {tips.length > 0 && <ul className="hint" style={{ margin: "6px 0 0" }}>{tips.map((t) => <li key={t}>{t}</li>)}</ul>}
              </div>
            )}
            <fieldset className="field" style={{ border: 0, padding: 0 }}>
              <legend>Grades</legend>
              <div className="row">
                {GRADES.map((g) => (
                  <label key={g} className="item-check">
                    <input type="checkbox" checked={draft.grades.includes(g)}
                      onChange={(e) => setDraft({ ...draft, grades: e.target.checked ? [...draft.grades, g] : draft.grades.filter((x) => x !== g) })} />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {isHonor ? (
              <div className="field"><label htmlFor="a-rec">Level</label>
                <select id="a-rec" className="input" value={draft.recognition} onChange={(e) => setDraft({ ...draft, recognition: e.target.value })}>
                  {Object.entries(RECOGNITION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            ) : (
              <div className="row">
                <div className="field" style={{ flex: "0 1 150px" }}><label htmlFor="a-hrs">Hours per week</label>
                  <input id="a-hrs" className="input" inputMode="decimal" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value.replace(/[^\d.]/g, "").slice(0, 4) })} /></div>
                <div className="field" style={{ flex: "0 1 150px" }}><label htmlFor="a-wks">Weeks per year</label>
                  <input id="a-wks" className="input" inputMode="numeric" value={draft.weeks} onChange={(e) => setDraft({ ...draft, weeks: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></div>
                <label className="item-check" style={{ alignSelf: "end", paddingBottom: 10 }}>
                  <input type="checkbox" checked={draft.ongoing} onChange={(e) => setDraft({ ...draft, ongoing: e.target.checked })} />
                  <span>I still do this</span>
                </label>
              </div>
            )}
            <div className="row">
              <button className="btn btn-inline" disabled={tooLong || !draft.position.trim()}>Save</button>
              <button type="button" className="btn btn-ghost btn-inline" onClick={() => setDraft(null)}>Cancel</button>
              {tooLong && <span className="note note-err" style={{ margin: 0 }}>Shorten the red fields to fit the Common App.</span>}
            </div>
          </form>
        )}
      </section>

      {beyondOn && (
        <>
          <ServiceLog sb={sb} studentId={student.id} rows={myService} run={run} />
          <Recommenders sb={sb} studentId={student.id} rows={myRecs} run={run} grade={student.grade_level} />
          <Brag sb={sb} studentId={student.id} sheet={myBrag} run={run} firstName={student.first_name} />
        </>
      )}
    </Page>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CAREERS, IMPORTANCE_SCALE, INTEREST_TYPES, LIKE_SCALE, RIASEC, WORK_VALUES,
  fitLabel, quizCareers, quizItem, quizTrades, rankedValues, scoreQuiz,
  type Answer, type SavedQuiz,
} from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { PICKS, savePick, useSpace, type ParentSave, type PickValue, type PickKind } from "../../lib/parent-space";
import { TRADES } from "../../lib/trades";
import { SignOffs } from "./sign-offs";

interface Student { id: string; first_name: string; state: string; permissions?: Record<string, boolean> | null; match_profile: { career_quiz?: SavedQuiz } | null }
interface QuizAnswers { student_id: string; answers: Record<string, Answer>; seconds: number | null; saved_at: string }

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const tradeName = (slug: string) => TRADES.find((t) => t.slug === slug)?.name ?? slug;

/**
 * My parent space: the parent's own home. Parents look around, save their own colleges,
 * scholarships, careers and trades with a like / maybe / no pick and a note, look over the
 * student's career quiz answers, and choose what to share with the student. Nothing here is
 * written to the student's plan unless the parent taps "Add to <name>'s plan".
 */
export default function ParentSpacePage() {
  const sb = supabase();
  const [me, setMe] = useState<string | null>(null);
  const [role, setRole] = useState<"parent" | "student" | "none" | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [saves, setSaves] = useState<ParentSave[]>([]);
  const [quiz, setQuiz] = useState<QuizAnswers[]>([]);
  const [planColleges, setPlanColleges] = useState<{ student_id: string; college_id: number | null }[]>([]);
  const [planScholarships, setPlanScholarships] = useState<{ student_id: string; scholarship_id: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, setSpace] = useSpace();

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/parent");
    setMe(s.session.user.id);
    const [mem, st, ps, qa, pc, ch] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, state, permissions, match_profile").order("first_name"),
      sb.from("parent_saves").select("*").order("created_at"),
      sb.from("career_quiz_answers").select("student_id, answers, seconds, saved_at"),
      sb.from("student_colleges").select("student_id, college_id"),
      sb.from("scholarship_choices").select("student_id, scholarship_id").eq("choice", "added"),
    ]);
    const m = (mem.data as { role: string }[]) ?? [];
    setRole(m.some((r) => r.role === "parent") ? "parent" : m.some((r) => r.role === "student") ? "student" : "none");
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => (c && list.some((x) => x.id === c) ? c : pickStudent(list, list[0]?.id)));
    setSaves((ps.data as ParentSave[]) ?? []);
    setQuiz((qa.data as QuizAnswers[]) ?? []);
    setPlanColleges((pc.data as { student_id: string; college_id: number | null }[]) ?? []);
    setPlanScholarships((ch.data as { student_id: string; scholarship_id: string }[]) ?? []);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const student = students.find((s) => s.id === current) ?? students[0];
  const forKid = saves.filter((x) => x.student_id === student?.id);
  const mine = forKid.filter((x) => x.user_id === me);
  const others = forKid.filter((x) => x.user_id !== me && x.pick !== "no");
  const pickOf = (kind: PickKind, key: string) => mine.find((x) => x.kind === kind && x.item_key === key);

  const title = "My parent space";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (role === null) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (role !== "parent") {
    return (
      <Page title={title}>
        <p className="hint">This page is for parents. {role === "student" ? <>Ideas your parents share with you show on your <a href="/home">home page</a>.</> : <>Set up your family on the <a href="/family">Family</a> page first.</>}</p>
      </Page>
    );
  }
  if (!student) {
    return (
      <Page title={title}>
        <p className="hint">Add your student on the <a href="/family">Family</a> page. Then you can search colleges and scholarships here in your own space, and look over their career quiz.</p>
      </Page>
    );
  }

  const run = async (p: PromiseLike<{ error: unknown }>) => {
    setError(null);
    const { error: e } = await p;
    if (e) { setError(friendly(e)); return false; }
    await load();
    return true;
  };
  const setPick = (kind: PickKind, key: string, name: string, pick: PickValue) => {
    const had = pickOf(kind, key);
    if (had?.pick === pick) return run(sb.from("parent_saves").delete().eq("id", had.id));
    return run(savePick(sb, { student_id: student.id, kind, item_key: key, name, pick }));
  };
  const update = (row: ParentSave, change: Partial<Pick<ParentSave, "pick" | "note" | "shared">>) => {
    const next = { ...change, ...(change.pick === "no" ? { shared: false } : {}) };
    return run(sb.from("parent_saves").update(next).eq("id", row.id));
  };
  const remove = (row: ParentSave) => run(sb.from("parent_saves").delete().eq("id", row.id));

  const onPlan = (row: ParentSave) => row.kind === "college"
    ? planColleges.some((c) => c.student_id === student.id && c.college_id === Number(row.item_key))
    : row.kind === "scholarship" ? planScholarships.some((c) => c.student_id === student.id && c.scholarship_id === row.item_key) : false;
  const addToPlan = async (row: ParentSave) => {
    if (row.kind === "college") {
      return run(sb.from("student_colleges").insert({ student_id: student.id, name: row.name, college_id: Number(row.item_key), plan: "RD", approved: true }));
    }
    const { data: sc, error: e } = await sb.from("scholarships").select("id, name, kind, url, amount_max, deadline").eq("id", row.item_key).single();
    if (e || !sc) return setError(friendly(e ?? { message: "Scholarship not found" }));
    const s = sc as { id: string; name: string; kind: string; url: string; amount_max: number | null; deadline: string | null };
    const { data: t, error: e2 } = await sb.from("tasks").insert({
      student_id: student.id, title: s.name, kind: s.kind === "grant" ? "aid" : "scholarship", due_on: s.deadline, url: s.url, amount: s.amount_max,
    }).select("id").single();
    if (e2) return setError(friendly(e2));
    return run(sb.from("scholarship_choices").upsert({ student_id: student.id, scholarship_id: s.id, choice: "added", task_id: (t as { id: string }).id }, { onConflict: "student_id,scholarship_id" }));
  };

  const name = student.first_name;
  const colleges = mine.filter((x) => x.kind === "college");
  const scholarships = mine.filter((x) => x.kind === "scholarship");
  const careers = mine.filter((x) => x.kind === "career" || x.kind === "trade");
  const shared = mine.filter((x) => x.shared).length;
  const answers = quiz.find((q) => q.student_id === student.id);
  const summary = student.match_profile?.career_quiz;
  const go = () => setSpace("parent");

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>Your own place to look around and keep notes. Colleges, scholarships and careers you save here are yours: they don&apos;t go on {name}&apos;s plan and don&apos;t show as {name}&apos;s work. When you want {name} to see one, tap <b>Share with {name}</b>.</p>
      {students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === student.id} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {error && <p className="note note-err" role="alert">{error}</p>}

      <div className="ps-stats">
        <span className="pill">{colleges.length} colleges</span>
        <span className="pill">{scholarships.length} scholarships</span>
        <span className="pill">{careers.length} careers and trades</span>
        <span className="pill pill-ok">{shared} shared with {name}</span>
      </div>

      {me && <SignOffs sb={sb} me={me} kids={students} onChanged={() => void load()} />}

      <h2 className="section-title">Look around in your own space</h2>
      <div className="tiles">
        <a className="tile" href="/colleges" onClick={go}>
          <span className="tile-icon">🔎</span><b>Find colleges</b>
          <span>Five quick questions, then colleges with a yearly price for your family. Save the ones you like to your list.</span>
          <span className="tile-go">Search colleges →</span>
        </a>
        <a className="tile" href="/majors" onClick={go}>
          <span className="tile-icon">🧭</span><b>Search by major</b>
          <span>Type a career or subject and see the strongest programs in your state first, then nationwide.</span>
          <span className="tile-go">Search by major →</span>
        </a>
        <a className="tile" href="/scholarships" onClick={go}>
          <span className="tile-icon">💰</span><b>Scholarships and grants</b>
          <span>Matched to {name}&apos;s grades and answers. Save the ones worth a look without adding them to {name}&apos;s deadlines.</span>
          <span className="tile-go">Search scholarships →</span>
        </a>
        <a className="tile" href="#quiz">
          <span className="tile-icon">🧩</span><b>{name}&apos;s career quiz</b>
          <span>{answers || summary ? `See what ${name} liked and mark the careers you like too.` : `${name} hasn't saved the career quiz yet.`}</span>
          <span className="tile-go">Look it over →</span>
        </a>
      </div>

      <QuizReview id="quiz" name={name} answers={answers} summary={summary} pickOf={pickOf} onPick={setPick} />

      <PickList title="My colleges" empty={<>No colleges yet. <a href="/colleges" onClick={go}>Find colleges</a> and tap Save to my list.</>}
        rows={colleges} name={name} onUpdate={update} onRemove={remove} onPlan={onPlan} onAddToPlan={addToPlan} addLabel={`Add to ${name}'s college list`} />
      <PickList title="My scholarships" empty={<>No scholarships yet. <a href="/scholarships" onClick={go}>Search scholarships</a> and tap Save to my list.</>}
        rows={scholarships} name={name} onUpdate={update} onRemove={remove} onPlan={onPlan} onAddToPlan={addToPlan} addLabel={`Add to ${name}'s deadlines`} />
      <PickList title="My career and trade picks" empty={<>No picks yet. Mark careers you like in {name}&apos;s career quiz above.</>}
        rows={careers} name={name} onUpdate={update} onRemove={remove} onPlan={onPlan} onAddToPlan={addToPlan} addLabel="" />

      {others.length > 0 && (
        <section className="panel">
          <h2>Picks from the other parent</h2>
          <p className="hint">Saved by another parent in your family. Only they can change these.</p>
          <ul className="items">
            {others.map((o) => (
              <li key={o.id}>
                <div className="item-main">
                  <b>{o.name}</b>
                  <span className="hint">{KIND[o.kind]} · {PICKS.find((p) => p[0] === o.pick)?.[2]}{o.shared ? ` · shared with ${name}` : ""}</span>
                  {o.note && <span className="hint">“{o.note}”</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="hint small">Only parents in your family can see your lists. {name} sees a pick only after you share it, and never one you marked Not for us.</p>
    </Page>
  );
}

const KIND: Record<PickKind, string> = { college: "College", scholarship: "Scholarship", career: "Career", trade: "Trade" };

function PickButtons({ value, onPick, label }: { value?: PickValue; onPick: (p: PickValue) => void; label: string }) {
  return (
    <span className="ps-picks" role="group" aria-label={`Your pick for ${label}`}>
      {PICKS.map(([p, icon, text]) => (
        <button key={p} type="button" className={`chip${value === p ? " chip-on" : ""}`} aria-pressed={value === p} title={text} onClick={() => onPick(p)}>
          <span aria-hidden="true">{icon}</span> {text}
        </button>
      ))}
    </span>
  );
}

function PickList({ title, empty, rows, name, onUpdate, onRemove, onPlan, onAddToPlan, addLabel }: {
  title: string; empty: ReactNode; rows: ParentSave[]; name: string; addLabel: string;
  onUpdate: (r: ParentSave, c: Partial<Pick<ParentSave, "pick" | "note" | "shared">>) => Promise<unknown>;
  onRemove: (r: ParentSave) => Promise<unknown>; onPlan: (r: ParentSave) => boolean; onAddToPlan: (r: ParentSave) => Promise<unknown>;
}) {
  const order: Record<PickValue, number> = { like: 0, maybe: 1, no: 2 };
  const sorted = [...rows].sort((a, b) => order[a.pick] - order[b.pick] || a.name.localeCompare(b.name));
  return (
    <section className="panel">
      <h2>{title}</h2>
      {sorted.length === 0 ? <p className="hint">{empty}</p> : (
        <ul className="items ps-list">
          {sorted.map((r) => <PickRow key={r.id} r={r} name={name} onUpdate={onUpdate} onRemove={onRemove} planned={onPlan(r)} onAddToPlan={addLabel ? onAddToPlan : null} addLabel={addLabel} />)}
        </ul>
      )}
    </section>
  );
}

function PickRow({ r, name, onUpdate, onRemove, planned, onAddToPlan, addLabel }: {
  r: ParentSave; name: string; planned: boolean; addLabel: string;
  onUpdate: (r: ParentSave, c: Partial<Pick<ParentSave, "pick" | "note" | "shared">>) => Promise<unknown>;
  onRemove: (r: ParentSave) => Promise<unknown>; onAddToPlan: ((r: ParentSave) => Promise<unknown>) | null;
}) {
  const [note, setNote] = useState(r.note ?? "");
  useEffect(() => setNote(r.note ?? ""), [r.note]);
  const link = r.kind === "trade" ? `/trades/${r.item_key}` : r.kind === "career" ? `/majors?q=${encodeURIComponent(r.name)}` : null;
  return (
    <li className={`ps-row ps-${r.pick}`}>
      <div className="item-main">
        <b>{link ? <a href={link}>{r.name}</a> : r.name}</b>
        <span className="hint small">{r.kind === "career" || r.kind === "trade" ? `${KIND[r.kind]} · ` : ""}Saved {day(r.created_at)}</span>
        <PickButtons value={r.pick} label={r.name} onPick={(p) => void onUpdate(r, { pick: p })} />
        <div className="ps-note">
          <label className="sr-only" htmlFor={`note-${r.id}`}>Your note about {r.name}</label>
          <textarea id={`note-${r.id}`} className="input" rows={2} maxLength={1000} placeholder="Your note (only parents see it unless you share)" value={note} onChange={(e) => setNote(e.target.value)} />
          {note !== (r.note ?? "") && <button className="btn btn-inline btn-sm" onClick={() => void onUpdate(r, { note: note.trim() || null })}>Save note</button>}
        </div>
      </div>
      <div className="item-actions">
        {r.pick !== "no" && (
          <label className="ps-share">
            <input type="checkbox" checked={r.shared} onChange={(e) => void onUpdate(r, { shared: e.target.checked })} /> Share with {name}
          </label>
        )}
        {onAddToPlan && (planned
          ? <span className="pill pill-ok">On {name}&apos;s plan ✓</span>
          : <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void onAddToPlan(r)}>{addLabel}</button>)}
        <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${r.name}`} onClick={() => void onRemove(r)}>Remove</button>
      </div>
    </li>
  );
}

function QuizReview({ id, name, answers, summary, pickOf, onPick }: {
  id: string; name: string; answers?: QuizAnswers; summary?: SavedQuiz;
  pickOf: (kind: PickKind, key: string) => ParentSave | undefined;
  onPick: (kind: PickKind, key: string, name: string, pick: PickValue) => Promise<unknown>;
}) {
  const result = useMemo(() => (answers ? scoreQuiz(answers.answers, { seconds: answers.seconds ?? undefined }) : null), [answers]);
  const careers = useMemo(() => (result ? quizCareers(result, 10) : []), [result]);
  const trades = useMemo(() => (result ? quizTrades(result, TRADES, 8) : []), [result]);
  const grouped = useMemo(() => {
    if (!answers) return [];
    const rows = Object.entries(answers.answers).map(([k, a]) => ({ item: quizItem(k), a })).filter((x) => !!x.item);
    return [4, 3, 2, 1, 0].map((a) => ({
      a, rows: rows.filter((x) => x.a === a),
    })).filter((g) => g.rows.length);
  }, [answers]);

  if (!answers && !summary) {
    return (
      <section className="panel" id={id}>
        <h2>{name}&apos;s career quiz</h2>
        <p className="hint">{name} hasn&apos;t saved the career quiz yet. Ask {name} to take the <a href="/career-quiz">career quiz</a> on their own sign-in and tap Save at the end. Then you&apos;ll see the results and every answer here, and you can mark the careers you like.</p>
      </section>
    );
  }

  const pickRow = (kind: PickKind, key: string, label: string) => (
    <PickButtons value={pickOf(kind, key)?.pick} label={label} onPick={(p) => void onPick(kind, key, label, p)} />
  );

  if (!result) {
    return (
      <section className="panel" id={id}>
        <h2>{name}&apos;s career quiz</h2>
        <p className="hint">Saved {summary!.at}. Interest code <b>{summary!.code}</b>. To see each answer, ask {name} to open the quiz results and tap Save again.</p>
        <ul className="items">
          {summary!.careers.map((k) => CAREERS[k] && (
            <li key={k}><div className="item-main"><b>{CAREERS[k]!.name}</b>{pickRow("career", k, CAREERS[k]!.name)}</div></li>
          ))}
          {summary!.trades.map((s) => (
            <li key={s}><div className="item-main"><b>{tradeName(s)}</b>{pickRow("trade", s, tradeName(s))}</div></li>
          ))}
        </ul>
      </section>
    );
  }

  const ordered = [...RIASEC].sort((a, b) => result.scores[b] - result.scores[a]);
  const values = rankedValues(result).slice(0, 3);
  return (
    <section className="panel" id={id}>
      <h2>{name}&apos;s career quiz</h2>
      <p className="hint">Saved {day(answers!.saved_at)} · {Object.keys(answers!.answers).length} answers. Mark the careers and trades you like for {name}. Your marks go on your own list, not on {name}&apos;s results. Suggestions to explore, not a decision.</p>
      <p><b>Strongest interests:</b> {ordered.slice(0, 3).map((t) => `${INTEREST_TYPES[t].icon} ${INTEREST_TYPES[t].name}`).join(" · ")} <span className="hint">(code {result.code})</span></p>
      <p><b>What matters most in a job:</b> {values.map(([v]) => WORK_VALUES[v].name).join(", ")}</p>

      <h3>Careers through college</h3>
      <ul className="items ps-list">
        {careers.map(({ key, career, fit }) => (
          <li key={key}>
            <div className="item-main">
              <b>{career.name}</b> <span className="pill">{fitLabel(result, fit)}</span>
              <span className="hint small">{usd(career.pay)} typical U.S. pay · {career.education}</span>
              {pickRow("career", key, career.name)}
            </div>
          </li>
        ))}
      </ul>

      <h3>Skilled trades</h3>
      <ul className="items ps-list">
        {trades.map(({ trade, fit }) => (
          <li key={trade.slug}>
            <div className="item-main">
              <b><a href={`/trades/${trade.slug}`}>{trade.name}</a></b> <span className="pill">{fitLabel(result, fit)}</span>
              {pickRow("trade", trade.slug, trade.name)}
            </div>
          </li>
        ))}
      </ul>

      <details className="rescue-more" style={{ marginTop: 12 }}>
        <summary>See all of {name}&apos;s answers</summary>
        {grouped.map((g) => (
          <div key={g.a} className="ps-answers">
            <h4>{LIKE_SCALE[g.a as Answer]} / {IMPORTANCE_SCALE[g.a as Answer]} ({g.rows.length})</h4>
            <ul>
              {g.rows.map(({ item }) => <li key={item!.id}>{item!.text}{"value" in item! ? <span className="hint small"> (job value)</span> : null}</li>)}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { type Challenge, type Prize, RUBRIC, day, grades, money, prizeText } from "../../../lib/challenge";

/**
 * Team page for the Essay Challenge: start a round (topic, subject, grades, cash prizes),
 * judge with names hidden, pick winners, and record how each prize was paid.
 * Database update 59 (migration 0057).
 */
const SUBJECTS = ["Writing", "Science", "History", "Animals and agriculture", "Careers and trades", "Community and service", "Technology", "Money and life skills", "Health and sports", "Arts and music"];
const TOPIC_IDEAS = [
  "Science: Pick an animal, plant or invention that you think changed the world. Explain how, and what you would study about it next.",
  "History: If you could spend one day with a person from Georgia's history, who would it be and what would you ask them?",
  "Careers and trades: Describe a job you'd like to try for a week. What would a day look like, and what skills would you need?",
  "Community and service: Tell us about a problem in your town and one small thing a student could do to help.",
  "Animals and agriculture: What does caring for an animal (or a garden) teach you that school can't?",
  "Money and life skills: You get $500 to help your family or community. How do you use it, and why?",
  "Technology: Should students use AI for school? Give your own opinion with real examples.",
];
const GROUPS = [{ min: 6, max: 8, name: "Middle school" }, { min: 9, max: 10, name: "Grades 9 and 10" }, { min: 11, max: 12, name: "Grades 11 and 12" }];
const DEFAULT_PRIZES: Prize[] = [
  { place: 1, label: "1st place", kind: "cash", amount: 250 },
  { place: 2, label: "2nd place", kind: "cash", amount: 100 },
  { place: 3, label: "3rd place", kind: "cash", amount: 50 },
];
const STATUS: Record<Challenge["status"], string> = { draft: "Draft (hidden)", open: "Open for entries", judging: "Closed: judging", done: "Results published" };

interface Count { challenge_id: string; status: string }
interface Judge {
  entry_id: string; number: number; title: string | null; body: string; words: number; writing_days: number; active_minutes: number; saves: number;
  big_jumps: number; paste_blocked: number; coach_checks: number; versions: number; submitted_at: string;
  my_score: Record<string, number | string | null> | null; judges: number; average: number | null;
}
interface Result {
  entry_id: string; number: number; first_name: string; grade_level: number; state: string; parent_emails: string | null; public_name_ok: boolean;
  team_family: boolean; average: number | null; judges: number; result: string | null; place: number | null; certificate_code: string | null;
}
interface Payout { entry_id: string; kind: string; amount: number; paid_to: string | null; method: string | null; reference: string | null; status: string; paid_on: string | null; tax_form: boolean; note: string | null }

interface Idea { subject: string; title: string; prompt: string; tips: string }

/** AI topic ideas for any subject and grade group. Picking one fills the form; nothing is published by itself. */
function AiIdeas({ sb, gradeMin, gradeMax, onPick }: { sb: SupabaseClient; gradeMin: number; gradeMax: number; onPick: (i: Idea) => void }) {
  const [subject, setSubject] = useState("");
  const [theme, setTheme] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await sb.auth.getSession();
      const r = await fetch("/api/challenge/topics", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ subject, gradeMin, gradeMax, theme }) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error ?? "Something went wrong.");
      setIdeas(out.ideas ?? []);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="note note-info" style={{ display: "grid", gap: 8, marginTop: 0, marginBottom: 12 }}>
      <b>✨ AI topic ideas</b>
      <div className="row">
        <div className="field"><label htmlFor="ai-subj">Subject (leave empty for every subject)</label>
          <input id="ai-subj" className="input" list="c-subjects" maxLength={60} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="field"><label htmlFor="ai-theme">Theme or season (optional)</label>
          <input id="ai-theme" className="input" maxLength={200} placeholder="Winter break, Earth Day, Georgia history month…" value={theme} onChange={(e) => setTheme(e.target.value)} /></div>
        <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void ask()}>{busy ? "Thinking…" : "Give me 6 ideas"}</button>
      </div>
      <span className="hint small">For grades {gradeMin} to {gradeMax}. Read and edit before you open a challenge.</span>
      {error && <span className="note note-err" style={{ margin: 0 }}>{error}</span>}
      {ideas.length > 0 && (
        <ul className="items">
          {ideas.map((i) => (
            <li key={i.title}>
              <div className="item-main"><b>{i.title}</b><span className="hint">{i.subject} · {i.prompt}</span></div>
              <div className="item-actions"><button className="btn btn-inline btn-sm" onClick={() => onPick(i)}>Use this</button></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function Form({ sb, start, onDone }: { sb: SupabaseClient; start: Partial<Challenge> | null; onDone: () => void }) {
  const now = new Date();
  const [f, setF] = useState({
    title: start?.title ?? "", subject: start?.subject ?? "Writing", prompt: start?.prompt ?? "", tips: start?.tips ?? "",
    grade_min: start?.grade_min ?? 9, grade_max: start?.grade_max ?? 12, min_words: start?.min_words ?? 250, max_words: start?.max_words ?? 650,
    opens_at: toLocal(start?.opens_at ? new Date(start.opens_at) : now),
    closes_at: toLocal(start?.closes_at ? new Date(start.closes_at) : new Date(now.getTime() + 30 * 86400000)),
    results_on: start?.results_on ?? new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10),
    prizes: start?.prizes ?? DEFAULT_PRIZES,
  });
  const [allGroups, setAllGroups] = useState(!start?.id);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const setPrize = (i: number, k: keyof Prize, v: unknown) => set("prizes", f.prizes.map((p, n) => (n === i ? { ...p, [k]: k === "amount" || k === "place" ? Number(v) : v } : p)));

  const save = async () => {
    setError(null);
    const row = { ...f, tips: f.tips.trim() || null, opens_at: new Date(f.opens_at).toISOString(), closes_at: new Date(f.closes_at).toISOString(), results_on: f.results_on || null };
    if (row.title.trim().length < 3 || row.prompt.trim().length < 10) return setError("Give it a title and a topic.");
    const r = start?.id
      ? await sb.from("challenges").update(row).eq("id", start.id)
      : allGroups
        ? await sb.from("challenges").insert(GROUPS.map((g) => ({ ...row, title: `${row.title} (${g.name})`, grade_min: g.min, grade_max: g.max,
            min_words: g.min === 6 ? Math.min(row.min_words, 200) : row.min_words, max_words: g.min === 6 ? Math.min(row.max_words, 500) : row.max_words })))
        : await sb.from("challenges").insert(row);
    if (r.error) return setError(friendly(r.error));
    onDone();
  };

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{start?.id ? "Change challenge" : "New challenge"}</h2>
      <AiIdeas sb={sb} gradeMin={allGroups ? 6 : f.grade_min} gradeMax={allGroups ? 12 : f.grade_max}
        onPick={(i) => setF({ ...f, title: i.title, subject: i.subject, prompt: i.prompt, tips: i.tips })} />
      <details style={{ marginBottom: 10 }}><summary>Ready-made topic ideas</summary>
        <ul>{TOPIC_IDEAS.map((t) => <li key={t}><button className="btn-link" onClick={() => { const [s, ...p] = t.split(": "); setF({ ...f, subject: s === "Animals and agriculture" || SUBJECTS.includes(s!) ? s! : f.subject, prompt: p.join(": ") }); }}>{t}</button></li>)}</ul>
      </details>
      <div className="row">
        <div className="field"><label htmlFor="c-title">Title</label><input id="c-title" className="input" maxLength={100} placeholder="Winter Essay Challenge" value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
        <div className="field"><label htmlFor="c-subject">Subject</label>
          <input id="c-subject" className="input" list="c-subjects" maxLength={60} value={f.subject} onChange={(e) => set("subject", e.target.value)} />
          <datalist id="c-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist></div>
      </div>
      <div className="field"><label htmlFor="c-prompt">Topic (what students write about)</label><textarea id="c-prompt" className="input" rows={3} maxLength={2000} value={f.prompt} onChange={(e) => set("prompt", e.target.value)} /></div>
      <div className="field"><label htmlFor="c-tips">Tips for students (optional)</label><textarea id="c-tips" className="input" rows={2} maxLength={4000} value={f.tips} onChange={(e) => set("tips", e.target.value)} /></div>
      {!start?.id && (
        <label className="item-check" style={{ display: "flex", marginBottom: 10 }}>
          <input type="checkbox" checked={allGroups} onChange={(e) => setAllGroups(e.target.checked)} />
          <span>Make one for each grade group (6 to 8, 9 and 10, 11 and 12), each judged and awarded on its own</span>
        </label>
      )}
      <div className="row">
        {!allGroups && <>
          <div className="field"><label htmlFor="c-gmin">From grade</label><input id="c-gmin" type="number" className="input" min={6} max={12} value={f.grade_min} onChange={(e) => set("grade_min", Number(e.target.value))} /></div>
          <div className="field"><label htmlFor="c-gmax">To grade</label><input id="c-gmax" type="number" className="input" min={6} max={12} value={f.grade_max} onChange={(e) => set("grade_max", Number(e.target.value))} /></div>
        </>}
        <div className="field"><label htmlFor="c-wmin">Fewest words</label><input id="c-wmin" type="number" className="input" min={50} max={3000} value={f.min_words} onChange={(e) => set("min_words", Number(e.target.value))} /></div>
        <div className="field"><label htmlFor="c-wmax">Most words</label><input id="c-wmax" type="number" className="input" min={100} max={5000} value={f.max_words} onChange={(e) => set("max_words", Number(e.target.value))} /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="c-open">Opens</label><input id="c-open" type="datetime-local" className="input" value={f.opens_at} onChange={(e) => set("opens_at", e.target.value)} /></div>
        <div className="field"><label htmlFor="c-close">Closes</label><input id="c-close" type="datetime-local" className="input" value={f.closes_at} onChange={(e) => set("closes_at", e.target.value)} /></div>
        <div className="field"><label htmlFor="c-res">Results by</label><input id="c-res" type="date" className="input" value={f.results_on} onChange={(e) => set("results_on", e.target.value)} /></div>
      </div>
      <h3>Prizes (cash prize money is separate from scholarships)</h3>
      {f.prizes.map((p, i) => (
        <div className="row" key={i} style={{ marginBottom: 8 }}>
          <div className="field"><label htmlFor={`p-l${i}`}>Name</label><input id={`p-l${i}`} className="input" value={p.label} onChange={(e) => setPrize(i, "label", e.target.value)} /></div>
          <div className="field"><label htmlFor={`p-k${i}`}>Kind</label>
            <select id={`p-k${i}`} className="input" value={p.kind} onChange={(e) => setPrize(i, "kind", e.target.value)}>
              <option value="cash">Cash prize</option><option value="gift_card">Gift card</option><option value="scholarship">Scholarship (paid to college)</option><option value="certificate">Certificate only</option>
            </select></div>
          <div className="field"><label htmlFor={`p-a${i}`}>Amount ($)</label><input id={`p-a${i}`} type="number" min={0} className="input" value={p.amount} onChange={(e) => setPrize(i, "amount", e.target.value)} /></div>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={() => set("prizes", f.prizes.filter((_, n) => n !== i))}>Remove</button>
        </div>
      ))}
      <button className="btn-link" onClick={() => set("prizes", [...f.prizes, { place: f.prizes.length + 1, label: `${f.prizes.length + 1}th place`, kind: "cash", amount: 50 }])}>+ Add a prize</button>
      <p className="hint small">Total per grade group: {money(f.prizes.reduce((a, p) => a + (p.kind === "certificate" ? 0 : p.amount), 0))}. Saved as a hidden draft; press Open when ready.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      <div className="row"><button className="btn btn-inline" onClick={() => void save()}>Save</button><button className="btn btn-ghost btn-inline" onClick={onDone}>Cancel</button></div>
    </div>
  );
}

function JudgeTab({ sb, c }: { sb: SupabaseClient; c: Challenge }) {
  const [list, setList] = useState<Judge[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<{ saved_at: string; words: number; body: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: e } = await sb.rpc("challenge_judging", { p_challenge: c.id });
    if (e) setError(friendly(e));
    setList((data as Judge[]) ?? []);
  }, [sb, c.id]);
  useEffect(() => { void load(); }, [load]);
  const open = list?.find((j) => j.entry_id === pick) ?? null;
  useEffect(() => {
    setHistory(null);
    const m = open?.my_score;
    setScore(Object.fromEntries(RUBRIC.map((r) => [r.key, Number(m?.[r.key] ?? 3)])));
    setNote((m?.note as string) ?? "");
  }, [open?.entry_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!open) return;
    const { error: e } = await sb.from("challenge_scores").upsert({ entry_id: open.entry_id, ...score, note: note.trim() || null, scored_at: new Date().toISOString() });
    if (e) return setError(friendly(e));
    await load();
    const next = list?.find((j) => j.entry_id !== open.entry_id && !j.my_score);
    setPick(next?.entry_id ?? null);
  };

  if (!list) return <p className="hint">Loading…</p>;
  return (
    <>
      {error && <p className="note note-err">{error}</p>}
      <p className="hint">Names are hidden. Score each part from 1 (weak) to 5 (excellent). Points: {RUBRIC.map((r) => `${r.label} ${r.weight}`).join(", ")}. Team families are left out.</p>
      <ul className="items">
        {list.map((j) => (
          <li key={j.entry_id}>
            <div className="item-main"><b>Essay #{j.number}{j.title ? `: ${j.title}` : ""}</b>
              <span className="hint">{j.words} words · {j.judges} judge{j.judges === 1 ? "" : "s"}{j.average !== null ? ` · average ${j.average}/100` : ""}</span></div>
            <div className="item-actions">{j.my_score ? <span className="pill pill-ok">Scored</span> : <span className="pill pill-soon">To score</span>}
              <button className="btn btn-inline btn-sm" onClick={() => setPick(j.entry_id === pick ? null : j.entry_id)}>{j.entry_id === pick ? "Close" : "Read"}</button></div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="hint">No essays sent in yet.</p>}
      {open && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Essay #{open.number}{open.title ? `: ${open.title}` : ""}</h3>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{open.body}</p>
          <p className="hint">Writing record: {open.writing_days} day{open.writing_days === 1 ? "" : "s"}, about {open.active_minutes} minutes typing, {open.saves} saves, {open.versions} snapshots, {open.coach_checks} coach checks, {open.paste_blocked} paste tries blocked{open.big_jumps ? `, ⚠️ ${open.big_jumps} big jumps of text in one save` : ""}.
            {" "}<button className="btn-link" onClick={() => void sb.rpc("challenge_history", { p_entry: open.entry_id }).then(({ data }) => setHistory((data as typeof history) ?? []))}>See how it grew</button></p>
          {history && <ol className="hint small">{history.map((h) => <li key={h.saved_at}>{new Date(h.saved_at).toLocaleString()}: {h.words} words · “{h.body.slice(-120)}”</li>)}</ol>}
          <div className="row">
            {RUBRIC.map((r) => (
              <div className="field" key={r.key}><label htmlFor={`s-${r.key}`}>{r.label} ({r.weight})</label>
                <select id={`s-${r.key}`} className="input" value={score[r.key] ?? 3} onChange={(e) => setScore({ ...score, [r.key]: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select></div>
            ))}
          </div>
          <div className="field"><label htmlFor="s-note">Note (team only)</label><input id="s-note" className="input" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn btn-inline" onClick={() => void save()}>Save score and go to the next</button>
        </div>
      )}
    </>
  );
}

function ResultsTab({ sb, c }: { sb: SupabaseClient; c: Challenge }) {
  const [rows, setRows] = useState<Result[] | null>(null);
  const [pay, setPay] = useState<Record<string, Payout>>({});
  const [edit, setEdit] = useState<Payout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [r, p] = await Promise.all([sb.rpc("challenge_results", { p_challenge: c.id }), sb.from("challenge_payouts").select("*")]);
    if (r.error) setError(friendly(r.error));
    setRows((r.data as Result[]) ?? []);
    setPay(Object.fromEntries(((p.data as Payout[]) ?? []).map((x) => [x.entry_id, x])));
  }, [sb, c.id]);
  useEffect(() => { void load(); }, [load]);

  const setResult = async (r: Result, result: string, place: number | null) => {
    const { error: e } = await sb.rpc("challenge_set_result", { p_entry: r.entry_id, p_result: result, p_place: place });
    if (e) return setError(friendly(e));
    await load();
  };
  const savePay = async () => {
    if (!edit) return;
    const { error: e } = await sb.from("challenge_payouts").upsert({ ...edit, paid_on: edit.paid_on || null });
    if (e) return setError(friendly(e));
    setEdit(null); await load();
  };
  const prizeFor = (r: Result) => c.prizes.find((p) => p.place === r.place);

  if (!rows) return <p className="hint">Loading…</p>;
  return (
    <>
      {error && <p className="note note-err">{error}</p>}
      <p className="hint">Highest average first. Pick winners and finalists, then press <b>Publish results</b> above so families see them. Cash prizes go to the parent or guardian. Ask for a W-9 before paying when a family&apos;s prizes in a year reach the amount the IRS requires a form for (check with the CPA).</p>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>#</th><th>Student</th><th>Average</th><th>Result</th><th>Prize</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const p = pay[r.entry_id];
            return (
              <tr key={r.entry_id}>
                <td>{r.number}</td>
                <td>{r.first_name}, grade {r.grade_level}, {r.state}{r.team_family ? " (team family, can't win)" : ""}<br /><span className="hint small">{r.parent_emails}{r.public_name_ok ? " · OK to share first name" : " · keep name private"}</span></td>
                <td>{r.average ?? "–"} <span className="hint small">({r.judges})</span></td>
                <td>
                  <select className="input input-sm" disabled={r.team_family} value={r.result === "winner" ? `w${r.place}` : r.result ?? "finisher"}
                    onChange={(e) => { const v = e.target.value; void setResult(r, v.startsWith("w") ? "winner" : v, v.startsWith("w") ? Number(v.slice(1)) : null); }}>
                    <option value="finisher">Finisher</option><option value="finalist">Finalist</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={`w${n}`}>Winner, place {n}</option>)}
                  </select>
                </td>
                <td>
                  {r.result === "winner" ? (
                    <>
                      {p ? <span className={`pill ${p.status === "paid" ? "pill-ok" : "pill-soon"}`}>{money(p.amount)} {p.status === "paid" ? "paid" : p.status === "waiting_on_family" ? "waiting on family" : "to pay"}</span> : <span className="hint small">{prizeFor(r) ? prizeText(prizeFor(r)!) : "No prize set"}</span>}
                      <button className="btn-link" onClick={() => setEdit(p ?? { entry_id: r.entry_id, kind: prizeFor(r)?.kind === "scholarship" ? "scholarship" : prizeFor(r)?.kind === "gift_card" ? "gift_card" : "cash", amount: prizeFor(r)?.amount ?? 0, paid_to: null, method: "Check", reference: null, status: "to_pay", paid_on: null, tax_form: false, note: null })}> Record payment</button>
                    </>
                  ) : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      {rows.length === 0 && <p className="hint">No essays sent in yet.</p>}
      {edit && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Prize payment</h3>
          <div className="row">
            <div className="field"><label htmlFor="pay-kind">Kind</label><select id="pay-kind" className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}><option value="cash">Cash</option><option value="gift_card">Gift card</option><option value="scholarship">Scholarship</option></select></div>
            <div className="field"><label htmlFor="pay-amt">Amount ($)</label><input id="pay-amt" type="number" className="input" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} /></div>
            <div className="field"><label htmlFor="pay-to">Paid to (parent name or college)</label><input id="pay-to" className="input" value={edit.paid_to ?? ""} onChange={(e) => setEdit({ ...edit, paid_to: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="pay-m">How</label><input id="pay-m" className="input" list="pay-methods" value={edit.method ?? ""} onChange={(e) => setEdit({ ...edit, method: e.target.value })} />
              <datalist id="pay-methods"><option value="Check" /><option value="Bank transfer" /><option value="Zelle" /><option value="Visa gift card" /></datalist></div>
            <div className="field"><label htmlFor="pay-ref">Check number or reference</label><input id="pay-ref" className="input" value={edit.reference ?? ""} onChange={(e) => setEdit({ ...edit, reference: e.target.value })} /></div>
            <div className="field"><label htmlFor="pay-st">Status</label><select id="pay-st" className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="to_pay">To pay</option><option value="waiting_on_family">Waiting on family (form)</option><option value="paid">Paid</option></select></div>
            <div className="field"><label htmlFor="pay-on">Paid on</label><input id="pay-on" type="date" className="input" value={edit.paid_on ?? ""} onChange={(e) => setEdit({ ...edit, paid_on: e.target.value })} /></div>
          </div>
          <label className="item-check" style={{ display: "flex" }}><input type="checkbox" checked={edit.tax_form} onChange={(e) => setEdit({ ...edit, tax_form: e.target.checked })} /><span>W-9 tax form on file</span></label>
          <div className="field"><label htmlFor="pay-note">Note (team only)</label><input id="pay-note" className="input" value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
          <div className="row"><button className="btn btn-inline" onClick={() => void savePay()}>Save</button><button className="btn btn-ghost btn-inline" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
    </>
  );
}

export default function AdminChallenges() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [list, setList] = useState<Challenge[]>([]);
  const [counts, setCounts] = useState<Count[]>([]);
  const [form, setForm] = useState<Partial<Challenge> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"judge" | "results">("judge");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/challenges");
    const a = await sb.rpc("is_app_admin");
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [c, e] = await Promise.all([
      sb.from("challenges").select("*").order("closes_at", { ascending: false }),
      sb.from("challenge_entries").select("challenge_id, status"),
    ]);
    if (c.error) setError(/challenges/.test(c.error.message) ? "Run database update 59 in Supabase first." : friendly(c.error));
    setList((c.data as Challenge[]) ?? []);
    setCounts((e.data as Count[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Essay challenges"><NotConfigured /></Page>;
  if (admin === undefined) return <Page title="Essay challenges"><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title="Essay challenges"><p className="note note-err">This page is for the ScholarTasks team.</p></Page>;

  const setStatus = async (c: Challenge, status: Challenge["status"]) => {
    const ask: Record<string, string> = { open: "Open this challenge? Students in these grades will see it.", judging: "Close entries and start judging?", done: "Publish results? Families will see winners and finalists, and certificates update." };
    if (ask[status] && !window.confirm(ask[status])) return;
    const { error: e } = await sb.from("challenges").update({ status }).eq("id", c.id);
    if (e) return setError(friendly(e));
    await load();
  };
  const remove = async (c: Challenge) => {
    if (!window.confirm(`Delete "${c.title}" and every essay in it? This can't be undone.`)) return;
    const { error: e } = await sb.from("challenges").delete().eq("id", c.id);
    if (e) return setError(friendly(e));
    await load();
  };
  const current = list.find((c) => c.id === open);

  return (
    <Page title="Essay challenges">
      <p className="hint">Start a round with its own topic and subject for each grade group. Students write in the app, earn badges and a certificate; winners get cash prizes ($50 to $250 suggested). Prize money is separate from scholarships. <a href="/challenge/rules">Official rules</a> are built from each challenge&apos;s settings.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {form ? <Form sb={sb} start={form} onDone={() => { setForm(null); void load(); }} /> : <button className="btn btn-inline" onClick={() => setForm({})}>+ New challenge</button>}

      <section className="panel">
        <h2>All challenges</h2>
        <ul className="items">
          {list.map((c) => {
            const n = counts.filter((x) => x.challenge_id === c.id);
            const sent = n.filter((x) => x.status === "submitted").length;
            return (
              <li key={c.id}>
                <div className="item-main"><b>{c.title}</b>
                  <span className="hint">{c.subject} · {grades(c)} · {day(c.opens_at)} to {day(c.closes_at)} · {STATUS[c.status]} · {n.length} started, {sent} sent in</span></div>
                <div className="item-actions">
                  {c.status === "draft" && <button className="btn btn-inline btn-sm" onClick={() => void setStatus(c, "open")}>Open</button>}
                  {c.status === "open" && <button className="btn btn-inline btn-sm" onClick={() => void setStatus(c, "judging")}>Close and judge</button>}
                  {c.status === "judging" && <button className="btn btn-inline btn-sm" onClick={() => void setStatus(c, "done")}>Publish results</button>}
                  {c.status !== "draft" && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setOpen(c.id === open ? null : c.id)}>{c.id === open ? "Close" : "Judge and prizes"}</button>}
                  <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setForm(c)}>Change</button>
                  {c.status === "draft" && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void remove(c)}>Delete</button>}
                </div>
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <p className="hint">No challenges yet. Press New challenge to start one.</p>}
      </section>

      {current && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>{current.title}</h2>
          <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
            <button role="tab" aria-selected={tab === "judge"} onClick={() => setTab("judge")}>Judge (names hidden)</button>
            <button role="tab" aria-selected={tab === "results"} onClick={() => setTab("results")}>Results and prizes</button>
          </div>
          {tab === "judge" ? <JudgeTab key={current.id} sb={sb} c={current} /> : <ResultsTab key={current.id} sb={sb} c={current} />}
        </section>
      )}
    </Page>
  );
}

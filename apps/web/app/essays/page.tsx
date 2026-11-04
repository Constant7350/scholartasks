"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { ReportAi } from "../report-ai";

interface Student { id: string; first_name: string }
interface Essay {
  id: string; student_id: string; kind: "personal" | "supplement" | "other"; college_id: string | null; title: string;
  prompt: string | null; word_limit: number | null; draft: string; status: "drafting" | "done"; updated_at: string;
}
interface College { id: string; student_id: string; name: string; status: string }
interface Feedback { mode: "feedback"; strengths: string[]; improve: string[]; answers_prompt: string; word_count_note: string; next_step: string; words: number }
interface Brainstorm { mode: "brainstorm"; questions: string[]; next_step: string }

/** Common App personal essay prompts. They rarely change; check commonapp.org each August. */
const COMMON_APP_PROMPTS = [
  "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
  "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
  "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
  "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
  "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
  "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
  "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
];
const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? ""));
const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** One essay open in the editor: autosaves, counts words, asks the coach. */
function Editor({ essay, colleges, onSaved, onRemove }: { essay: Essay; colleges: College[]; onSaved: (e: Essay) => void; onRemove: () => void }) {
  const sb = supabase()!;
  const [draft, setDraft] = useState(essay.draft);
  const [prompt, setPrompt] = useState(essay.prompt ?? "");
  const [limit, setLimit] = useState(essay.word_limit?.toString() ?? "");
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fb, setFb] = useState<Feedback | Brainstorm | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (patch: Partial<Essay>) => {
    setSaved("saving");
    const { data, error } = await sb.from("student_essays").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", essay.id).select("*").single();
    if (error) return setSaved("error");
    setSaved("saved");
    onSaved(data as Essay);
  }, [sb, essay.id, onSaved]);

  const onDraft = (v: string) => {
    setDraft(v); setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save({ draft: v }), 1200);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const ask = async (mode: "feedback" | "brainstorm") => {
    setBusy(true); setMsg(null); setFb(null);
    if (timer.current) { clearTimeout(timer.current); await save({ draft }); }
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch("/api/essays/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ essayId: essay.id, mode }) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
      setFb(out);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };

  const words = countWords(draft);
  const max = limit ? Number(limit) : null;
  const college = colleges.find((c) => c.id === essay.college_id);

  return (
    <div className="panel essay-editor">
      <div className="todo-top">
        <h2 style={{ margin: 0 }}>{essay.title}{college ? ` · ${college.name}` : ""}</h2>
        <div className="item-actions">
          <label className="item-check">
            <input type="checkbox" checked={essay.status === "done"} onChange={(e) => void save({ status: e.target.checked ? "done" : "drafting" })} />
            <span>Finished</span>
          </label>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={onRemove}>Remove</button>
        </div>
      </div>

      {essay.kind === "personal" ? (
        <div className="field">
          <label htmlFor="e-prompt">Which prompt? <span className="hint">(650 words, at least 250)</span></label>
          <select id="e-prompt" className="input" value={COMMON_APP_PROMPTS.indexOf(prompt) >= 0 ? prompt : ""} onChange={(e) => { setPrompt(e.target.value); void save({ prompt: e.target.value || null }); }}>
            <option value="">Not chosen yet</option>
            {COMMON_APP_PROMPTS.map((p, i) => <option key={i} value={p}>{i + 1}. {p.slice(0, 90)}…</option>)}
          </select>
          {prompt && <p className="hint" style={{ margin: "6px 0 0" }}>{prompt}</p>}
        </div>
      ) : (
        <div className="row">
          <div className="field"><label htmlFor="e-prompt">Prompt (paste it from the college)</label>
            <textarea id="e-prompt" className="input" rows={2} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} onBlur={() => void save({ prompt: prompt.trim() || null })} /></div>
          <div className="field" style={{ flex: "0 1 140px" }}><label htmlFor="e-limit">Word limit</label>
            <input id="e-limit" className="input" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onBlur={() => void save({ word_limit: limit && Number(limit) >= 25 ? Number(limit) : null })} /></div>
        </div>
      )}

      <div className="field">
        <label htmlFor="e-draft">Your draft</label>
        <textarea id="e-draft" className="input essay-text" rows={16} maxLength={20000} value={draft} onChange={(e) => onDraft(e.target.value)}
          placeholder="Write in your own words. It saves as you type." />
        <p className="hint essay-meta">
          <span className={max && words > max ? "note-err" : ""}>{words} word{words === 1 ? "" : "s"}{max ? ` of ${max}` : ""}</span>
          <span>{saved === "saving" ? "Saving…" : saved === "error" ? "Not saved. Check your connection." : "Saved ✓"}</span>
        </p>
      </div>

      <div className="row">
        <button className="btn btn-inline" disabled={busy} onClick={() => void ask("feedback")}>{busy ? "Reading…" : "✨ Get feedback"}</button>
        <button className="btn btn-ghost btn-inline" disabled={busy} onClick={() => void ask("brainstorm")}>💡 Help me find a topic</button>
      </div>
      <p className="hint">The coach gives feedback and asks questions. It never writes for you, because colleges want your own words. Each request uses 1 of today&apos;s AI uses.</p>
      {msg && <p className="note note-err" role="alert">{msg}</p>}
      {fb?.mode === "feedback" && (
        <div className="panel" style={{ marginTop: 10 }}>
          {fb.answers_prompt !== "no prompt" && <p style={{ margin: "0 0 6px" }}><b>Answers the prompt:</b> {fb.answers_prompt}</p>}
          <p style={{ margin: "0 0 4px" }}><b>What works</b></p>
          <ul>{fb.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
          <p style={{ margin: "0 0 4px" }}><b>To make it stronger</b></p>
          <ul>{fb.improve.map((x) => <li key={x}>{x}</li>)}</ul>
          {fb.word_count_note && <p className="hint">{fb.word_count_note}</p>}
          <p style={{ margin: 0 }}><b>Next step:</b> {fb.next_step}</p>
          <ReportAi feature="college essay coach" text={[...fb.strengths, ...fb.improve, fb.next_step].join("\n")} />
        </div>
      )}
      {fb?.mode === "brainstorm" && (
        <div className="panel" style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 4px" }}><b>Questions to get you thinking</b></p>
          <ol>{fb.questions.map((x) => <li key={x}>{x}</li>)}</ol>
          <p style={{ margin: 0 }}><b>Next step:</b> {fb.next_step}</p>
          <ReportAi feature="college essay coach" text={[...fb.questions, fb.next_step].join("\n")} />
        </div>
      )}
    </div>
  );
}

/** The Common App essay and every college's supplements, in one place. */
export default function EssaysPage() {
  const sb = supabase();
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [essays, setEssays] = useState<Essay[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ college: string; title: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/essays");
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name").order("first_name"),
    ]);
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    setIsParent(m.some((r) => r.role === "parent"));
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (own ?? pickStudent(list, list[0]?.id)));
    const [es, cs] = await Promise.all([
      sb.from("student_essays").select("*").order("created_at"),
      sb.from("student_colleges").select("id, student_id, name, status").order("name"),
    ]);
    if (missingTable(es.error)) { setOffline(true); setReady(true); return; }
    setEssays((es.data as Essay[]) ?? []);
    setColleges((cs.data as College[]) ?? []);
    setReady(true);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const onSaved = useCallback((e: Essay) => setEssays((all) => all.map((x) => (x.id === e.id ? e : x))), []);

  if (!sb) return <Page title="College essays"><NotConfigured /></Page>;
  if (!ready) return <Page title="College essays"><p className="hint">Loading…</p></Page>;
  if (offline) return <Page title="College essays"><div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>Essays are switching on. Check back shortly.</p></div></Page>;
  const student = students.find((s) => s.id === current);
  if (!student) return <Page title="College essays"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const mine = essays.filter((e) => e.student_id === student.id);
  const myColleges = colleges.filter((c) => c.student_id === student.id && c.status !== "withdrawn");
  const personal = mine.find((e) => e.kind === "personal");
  const open = mine.find((e) => e.id === openId) ?? null;

  const create = async (row: Partial<Essay>) => {
    setError(null);
    const { data, error: e } = await sb.from("student_essays").insert({ student_id: student.id, ...row }).select("*").single();
    if (e) return setError(friendly(e));
    setEssays([...essays, data as Essay]);
    setOpenId((data as Essay).id);
    setAdding(null);
  };
  const remove = async (e: Essay) => {
    if (!window.confirm(`Remove "${e.title}" and its draft? This can't be undone.`)) return;
    const { error: err } = await sb.from("student_essays").delete().eq("id", e.id);
    if (err) return setError(friendly(err));
    setEssays(essays.filter((x) => x.id !== e.id));
    setOpenId(null);
  };

  return (
    <Page title={isParent ? `${student.first_name}'s college essays` : "My college essays"}>
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint">Draft the Common App essay and each college&apos;s extra essays here. Everything saves as you type, and the coach gives feedback without writing for you. For scholarship essays, use the coach on each saved scholarship.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      <section className="panel">
        <h2>Essays ({mine.length})</h2>
        <ul className="items">
          {mine.map((e) => {
            const w = countWords(e.draft);
            const c = myColleges.find((x) => x.id === e.college_id);
            return (
              <li key={e.id}>
                <div className="item-main">
                  <b>{e.title}{c ? ` · ${c.name}` : ""}</b>
                  <span className="hint">{w} word{w === 1 ? "" : "s"}{e.word_limit ? ` of ${e.word_limit}` : ""}</span>
                </div>
                <div className="item-actions">
                  {e.status === "done" ? <span className="pill pill-ok">Finished ✓</span> : <span className="pill">Drafting</span>}
                  <button className="btn btn-inline btn-sm" onClick={() => setOpenId(e.id === openId ? null : e.id)}>{e.id === openId ? "Close" : "Open"}</button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="row" style={{ marginTop: 8 }}>
          {!personal && <button className="btn btn-inline" onClick={() => void create({ kind: "personal", title: "Common App personal essay", word_limit: 650 })}>+ Start my Common App essay</button>}
          {!adding && <button className="btn btn-ghost btn-inline" onClick={() => setAdding({ college: myColleges[0]?.id ?? "", title: "" })}>+ Add a college&apos;s essay</button>}
        </div>
        {adding && (
          <form className="row panel" style={{ alignItems: "end" }} onSubmit={(e) => {
            e.preventDefault();
            const c = myColleges.find((x) => x.id === adding.college);
            void create({ kind: c ? "supplement" : "other", college_id: c?.id ?? null, title: adding.title.trim() || (c ? "Why this college?" : "Essay") });
          }}>
            <div className="field"><label htmlFor="n-col">College</label>
              <select id="n-col" className="input" value={adding.college} onChange={(e) => setAdding({ ...adding, college: e.target.value })}>
                {myColleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="">Other (not on my list)</option>
              </select></div>
            <div className="field"><label htmlFor="n-title">Short name</label>
              <input id="n-title" className="input" maxLength={200} placeholder="Why this college?" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} /></div>
            <button className="btn btn-inline">Add</button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setAdding(null)}>Cancel</button>
          </form>
        )}
      </section>

      {open && <Editor key={open.id} essay={open} colleges={myColleges} onSaved={onSaved} onRemove={() => void remove(open)} />}
    </Page>
  );
}

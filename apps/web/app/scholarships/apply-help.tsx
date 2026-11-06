"use client";

import { useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { ReportAi } from "../report-ai";
import { DraftImport } from "../attach-buttons";
import { downloadDocx } from "../../lib/docx";
import type { Choice, Row } from "./types";

export interface Steps { steps: { title: string; detail: string }[]; essay_prompts: string[]; sources: string[] }
interface Feedback { strengths: string[]; improve: string[]; answers_prompt: string; word_count_note: string; next_step: string; words: number }

/** "Get ready to apply": the checklist for one saved award, plus the essay coach. */
export function ApplyHelp({ s, choice, startOpen = false, onSteps }: { s: Row; choice: Choice; startOpen?: boolean; onSteps?: (steps: Steps) => void }) {
  const sb = supabase();
  const [open, setOpen] = useState(startOpen);
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
    if (data) { setSteps(data as Steps); setPrompt((data as Steps).essay_prompts[0] ?? ""); onSteps?.(data as Steps); }
  };
  const makeSteps = async () => {
    setBusy("steps"); setMsg(null);
    try { const out = await call<Steps>("/api/scholarships/steps", { studentId: choice.student_id, scholarshipId: s.id }); setSteps(out); setPrompt(out.essay_prompts[0] ?? ""); onSteps?.(out); }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (startOpen) void loadSteps(); }, []);

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
      <DraftImport studentId={choice.student_id} draft={draft} onText={(t) => setDraft(t.slice(0, 12000))} disabled={busy !== null} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <span className="hint">{words} words</span>
        <button className="btn btn-ghost btn-inline btn-sm" disabled={busy !== null} onClick={() => void saveDraft()}>Save draft</button>
        <button className="btn btn-ghost btn-inline btn-sm" disabled={!draft.trim()} onClick={() => void downloadDocx(draft, `${s.name} essay`, { title: `${s.name} essay`, note: prompt.trim() ? `Prompt: ${prompt.trim()}` : undefined })}>⬇ Download as Word</button>
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

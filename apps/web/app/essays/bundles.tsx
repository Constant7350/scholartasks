"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bundleEssays, trimToWords, type EssayItem } from "@scholartasks/core";

interface Choice { id: string; scholarship_id: string; essay_draft: string | null }
interface Award { id: string; name: string; deadline: string | null }
interface StepRow { scholarship_id: string; essay_prompts: string[] }
export interface BundleEssay { id: string; title: string; prompt: string | null; word_limit: number | null; draft: string }

/**
 * Essay bundles: saved scholarships (and college essays) whose questions ask the
 * same thing, grouped so one good draft can start the others. Copying only fills
 * empty drafts and the student still tailors each one; nothing is written by AI.
 */
export function EssayBundles({ sb, studentId, essays, onEssaysChanged }: {
  sb: SupabaseClient; studentId: string; essays: BundleEssay[]; onEssaysChanged: () => Promise<void>;
}) {
  const [choices, setChoices] = useState<Choice[]>([]);
  const [awards, setAwards] = useState<Map<string, Award>>(new Map());
  const [prompts, setPrompts] = useState<Map<string, string[]>>(new Map());
  const [from, setFrom] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: c } = await sb.from("scholarship_choices").select("id, scholarship_id, essay_draft").eq("student_id", studentId).eq("choice", "added");
    const list = (c as Choice[]) ?? [];
    setChoices(list);
    const ids = list.map((x) => x.scholarship_id);
    if (ids.length) {
      const [a, s] = await Promise.all([
        sb.from("scholarships").select("id, name, deadline").in("id", ids),
        sb.from("scholarship_steps").select("scholarship_id, essay_prompts").in("scholarship_id", ids),
      ]);
      setAwards(new Map(((a.data as Award[]) ?? []).map((x) => [x.id, x])));
      setPrompts(new Map(((s.data as StepRow[]) ?? []).map((x) => [x.scholarship_id, x.essay_prompts])));
    }
    setLoaded(true);
  }, [sb, studentId]);
  useEffect(() => { void load(); }, [load]);

  if (!loaded) return null;

  const items: EssayItem[] = [
    ...choices.map((c) => ({
      key: `s:${c.id}`, title: awards.get(c.scholarship_id)?.name ?? "Scholarship", prompt: prompts.get(c.scholarship_id)?.[0] ?? null,
      draft: c.essay_draft, deadline: awards.get(c.scholarship_id)?.deadline ?? null,
    })),
    ...essays.map((e) => ({ key: `e:${e.id}`, title: e.title, prompt: e.prompt, draft: e.draft, wordLimit: e.word_limit })),
  ];
  const { bundles } = bundleEssays(items);
  const noPrompt = choices.filter((c) => !prompts.get(c.scholarship_id)?.length).length;

  const write = async (key: string, text: string) => {
    const [kind, id] = key.split(":");
    if (kind === "s") return sb.from("scholarship_choices").update({ essay_draft: text.slice(0, 12000) }).eq("id", id!);
    return sb.from("student_essays").update({ draft: text.slice(0, 20000), updated_at: new Date().toISOString() }).eq("id", id!);
  };
  const fill = async (b: (typeof bundles)[number]) => {
    setMsg(null);
    const src = b.items.find((i) => i.key === (from[b.theme] ?? "")) ?? b.items.filter((i) => i.words >= 25).sort((x, y) => y.words - x.words)[0];
    if (!src?.draft) return;
    const targets = b.items.filter((i) => i.words === 0 && i.key !== src.key);
    const results = await Promise.all(targets.map((t) => write(t.key, trimToWords(src.draft!, t.limit))));
    if (results.some((r) => r.error)) return setMsg("Some drafts didn't save. Try again.");
    await Promise.all([load(), onEssaysChanged()]);
    setMsg(`✓ Started ${targets.length} draft${targets.length === 1 ? "" : "s"} from "${src.title}". Now change each one so it answers its own question.`);
  };

  return (
    <section className="panel">
      <h2>Essay bundles</h2>
      <p className="hint">Many scholarships ask almost the same question. Write one strong answer, then use it to start the others and change each one to fit. Saved scholarships and college essays with the same kind of question are grouped here.</p>
      {msg && <p className="note" role="status">{msg}</p>}
      {bundles.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          No bundles yet. Save a few scholarships, open <b>Get ready to apply</b> on each to load its essay question, and the ones that ask the same thing group here.
        </p>
      ) : (
        bundles.map((b) => {
          const sources = b.items.filter((i) => i.words >= 25);
          return (
            <div key={b.theme} className="panel" style={{ margin: "10px 0" }}>
              <h3 style={{ marginTop: 0 }}>{b.label} <span className="pill">{b.items.length} essays</span></h3>
              <ul className="items">
                {b.items.map((i) => (
                  <li key={i.key}>
                    <div className="item-main">
                      <b>{i.title}</b>
                      <span className="hint">{i.prompt && i.prompt.length > 160 ? `${i.prompt.slice(0, 157)}…` : i.prompt}</span>
                      <span className="hint small">{i.words ? `${i.words} words written` : "Not started"}{i.limit ? ` · limit ${i.limit}` : ""}{i.deadline ? ` · due ${new Date(`${i.deadline}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span>
                    </div>
                    <div className="item-actions">
                      <a className="btn btn-ghost btn-inline btn-sm link-btn" href={i.key.startsWith("s:") ? "/scholarships" : "/essays"}>Open</a>
                    </div>
                  </li>
                ))}
              </ul>
              {sources.length > 0 && b.empty > 0 ? (
                <div className="row" style={{ alignItems: "end" }}>
                  {sources.length > 1 && (
                    <div className="field" style={{ flex: "0 1 280px" }}>
                      <label htmlFor={`src-${b.theme}`}>Start from</label>
                      <select id={`src-${b.theme}`} className="input" value={from[b.theme] ?? sources[0]!.key} onChange={(e) => setFrom({ ...from, [b.theme]: e.target.value })}>
                        {sources.map((s) => <option key={s.key} value={s.key}>{s.title} ({s.words} words)</option>)}
                      </select>
                    </div>
                  )}
                  <button className="btn btn-inline btn-sm" onClick={() => void fill(b)}>Use it to start the {b.empty} empty draft{b.empty === 1 ? "" : "s"}</button>
                </div>
              ) : sources.length === 0 ? (
                <p className="hint small" style={{ margin: 0 }}>Write one of these first (25 words or more), then use it to start the others.</p>
              ) : null}
            </div>
          );
        })
      )}
      {noPrompt > 0 && <p className="hint small" style={{ marginBottom: 0 }}>{noPrompt} saved scholarship{noPrompt === 1 ? " has" : "s have"} no essay question loaded yet. Open <a href="/scholarships">Get ready to apply</a> on {noPrompt === 1 ? "it" : "each"} to check.</p>}
    </section>
  );
}

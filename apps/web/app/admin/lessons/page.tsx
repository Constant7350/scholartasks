"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { LESSONS, type Lesson } from "../../study/lessons";
import { drillsFor } from "../../study/drills";
import { ReviewNav, timeOf } from "../review-kit";

/** Each lesson, then its subject drills as a separate review item ("<lesson>-drills"). */
interface Item { id: string; lesson: Lesson; drills: boolean }
const ITEMS: Item[] = LESSONS.flatMap((l) => [{ id: l.id, lesson: l, drills: false }, { id: `${l.id}-drills`, lesson: l, drills: true }]);

interface Review { lesson_id: string; status: "approved" | "changes"; notes: string | null; updated_at: string }

/** Team review of the study skills lessons: approve each one or leave notes for changes. */
export default function LessonReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(ITEMS[0]!.id);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, Date>>({});
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/lessons");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.from("lesson_reviews").select("lesson_id, status, notes, updated_at");
    if (e) return setError(/relation|schema cache/i.test(e.message) ? "This page needs the latest database update." : friendly(e));
    const map: Record<string, Review> = {};
    for (const r of (data as Review[]) ?? []) map[r.lesson_id] = r;
    setReviews(map);
    setNotes(Object.fromEntries(Object.values(map).map((r) => [r.lesson_id, r.notes ?? ""])));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, status: Review["status"]) => {
    if (!sb) return;
    setError(null);
    const { error: e } = await sb.rpc("set_lesson_review", { p_lesson: id, p_status: status, p_notes: notes[id] ?? "" });
    if (e) return setError(friendly(e));
    setSavedAt((m) => ({ ...m, [id]: new Date() }));
    await load();
    // Open the next lesson that hasn't been reviewed yet.
    const i = ITEMS.findIndex((l) => l.id === id);
    const nextOpen = [...ITEMS.slice(i + 1), ...ITEMS.slice(0, i)].find((l) => !reviews[l.id] && l.id !== id);
    setOpen(nextOpen?.id ?? null);
  };

  const notReviewed = ITEMS.filter((l) => !reviews[l.id]);
  const approveAll = async () => {
    if (!sb) return;
    if (!confirmAll) return setConfirmAll(true);
    setConfirmAll(false); setError(null);
    const now = new Date();
    for (const l of notReviewed) {
      const { error: e } = await sb.rpc("set_lesson_review", { p_lesson: l.id, p_status: "approved", p_notes: notes[l.id] ?? "" });
      if (e) { setError(friendly(e)); break; }
      setSavedAt((m) => ({ ...m, [l.id]: now }));
    }
    setOpen(null);
    await load();
  };

  const title = "Lesson review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;
  const approved = ITEMS.filter((l) => reviews[l.id]?.status === "approved").length;

  return (
    <Page title={title}>
      <ReviewNav />
      <p className="hint" style={{ marginTop: -8 }}>
        Read each study skills lesson, and its practice drills in math, science, history and English, the way a classroom teacher would. Approve it if it&apos;s accurate and right for grades 6 to 12, or write what should change and pick &quot;Needs changes&quot;. Your notes come to us and we update it. <b>{approved} of {ITEMS.length}</b> approved. Practice questions are reviewed on the <a href="/admin/questions">question review page</a>.
      </p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {notReviewed.length > 1 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn btn-inline" onClick={() => void approveAll()}>{confirmAll ? `Tap again to approve all ${notReviewed.length}` : `Approve all ${notReviewed.length} not reviewed`}</button>
          {confirmAll && <button className="btn btn-ghost btn-inline" onClick={() => setConfirmAll(false)}>Cancel</button>}
          <span className="hint" style={{ fontSize: 13 }}>Or open each one below. Approving one opens the next.</span>
        </div>
      )}
      {ITEMS.map(({ id, lesson: l, drills }) => {
        const r = reviews[id];
        return (
          <section key={id} className="panel review">
            <button className="lesson-review-head" onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>
              <span><span aria-hidden="true">{l.emoji}</span> <b>{l.title}</b>{drills ? ": subject drills" : ""}</span>
              <span className={`pill ${r?.status === "approved" ? "pill-ok" : r?.status === "changes" ? "pill-soon" : ""}`}>{r?.status === "approved" ? "✓ Approved" : r?.status === "changes" ? "Needs changes" : "Not reviewed"}{savedAt[id] ? ` · saved ${timeOf(savedAt[id]!)}` : ""}</span>
            </button>
            {open === id && (
              <div style={{ marginTop: 12 }}>
                {drills ? drillsFor(l.id).map((d) => (
                  <div key={d.subject} style={{ marginBottom: 14 }}>
                    <p className="eyebrow">{d.subject} · {d.kind}: {d.title}</p>
                    <p className="hint">{d.how}</p>
                    {d.study && <p style={{ fontSize: 14 }}><b>{d.study.title}{d.study.hide ? " (hidden before the questions)" : ""}:</b> {d.study.lines.join(" / ")}</p>}
                    {d.worked && <p style={{ fontSize: 14 }}><b>{d.worked.title}:</b> {d.worked.problem} {d.worked.steps.join(" / ")}</p>}
                    <ol className="lesson-steps">
                      {d.checks.map((c) => <li key={c.q}>{c.q}<br /><span className="hint">Answer: {c.options[c.answer]}. Others: {c.options.filter((_, j) => j !== c.answer).join("; ")}. {c.explain}</span></li>)}
                    </ol>
                    {d.explain && <p style={{ fontSize: 14 }}><b>Explain:</b> {d.explain.question} <span className="hint">Model: {d.explain.answer}</span></p>}
                    <p style={{ fontSize: 14 }}><b>Your turn:</b> {d.yourTurn}</p>
                  </div>
                )) : <>
                <p><b>{l.summary}</b></p>
                <p className="hint">{l.why}</p>
                <p className="eyebrow">Steps</p>
                <ol className="lesson-steps">{l.steps.map((s) => <li key={s.title}><b>{s.title}.</b> {s.body}</li>)}</ol>
                <p className="eyebrow">Quick check</p>
                <ol className="lesson-steps">
                  {l.checks.map((c) => <li key={c.q}>{c.q}<br /><span className="hint">Answer: {c.options[c.answer]}. {c.explain}</span></li>)}
                </ol>
                {l.projects.map((p) => (
                  <div key={p.band}><p className="eyebrow">Project, grades {p.band}: {p.title}</p><ol className="lesson-steps">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
                ))}
                </>}
                <p><a href={`/study/${l.id}`} target="_blank" rel="noreferrer">See it as students do ↗</a></p>
                <div className="field"><label htmlFor={`n-${id}`}>Notes (what to change, or anything to add)</label>
                  <textarea id={`n-${id}`} className="input" rows={3} maxLength={4000} value={notes[id] ?? ""} onChange={(e) => setNotes({ ...notes, [id]: e.target.value })} /></div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn btn-inline" onClick={() => void decide(id, "approved")}>Approve</button>
                  <button className="btn btn-ghost btn-inline" onClick={() => void decide(id, "changes")}>Needs changes</button>
                </div>
                {r && <p className={savedAt[id] ? "note note-ok" : "hint"} style={{ fontSize: 12, marginTop: 8 }} role="status">{savedAt[id] ? "✓ Saved" : "Last saved"} {new Date(r.updated_at).toLocaleString()}</p>}
              </div>
            )}
          </section>
        );
      })}
    </Page>
  );
}

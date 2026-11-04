"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { LESSONS } from "../../study/lessons";

interface Review { lesson_id: string; status: "approved" | "changes"; notes: string | null; updated_at: string }

/** Teacher review of the study skills lessons: approve each one or leave notes for changes. */
export default function LessonReviewPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(LESSONS[0]!.id);
  const [error, setError] = useState<string | null>(null);

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
    await load();
    const i = LESSONS.findIndex((l) => l.id === id);
    setOpen(LESSONS[i + 1]?.id ?? null);
  };

  const title = "Lesson review";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;
  const approved = LESSONS.filter((l) => reviews[l.id]?.status === "approved").length;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        Read each study skills lesson as a teacher would. Approve it if it&apos;s accurate and right for grades 8 to 12, or write what should change and pick &quot;Needs changes&quot;. Your notes come to us and we update the lesson. <b>{approved} of {LESSONS.length}</b> approved.
      </p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {LESSONS.map((l) => {
        const r = reviews[l.id];
        return (
          <section key={l.id} className="panel review">
            <button className="lesson-review-head" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
              <span><span aria-hidden="true">{l.emoji}</span> <b>{l.title}</b></span>
              <span className={`pill ${r?.status === "approved" ? "pill-ok" : r?.status === "changes" ? "pill-soon" : ""}`}>{r?.status === "approved" ? "Approved" : r?.status === "changes" ? "Needs changes" : "Not reviewed"}</span>
            </button>
            {open === l.id && (
              <div style={{ marginTop: 12 }}>
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
                <p><a href={`/study/${l.id}`} target="_blank" rel="noreferrer">See it as students do ↗</a></p>
                <div className="field"><label htmlFor={`n-${l.id}`}>Notes (what to change, or anything to add)</label>
                  <textarea id={`n-${l.id}`} className="input" rows={3} maxLength={4000} value={notes[l.id] ?? ""} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} /></div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn btn-inline" onClick={() => void decide(l.id, "approved")}>Approve</button>
                  <button className="btn btn-ghost btn-inline" onClick={() => void decide(l.id, "changes")}>Needs changes</button>
                </div>
                {r && <p className="hint" style={{ fontSize: 12, marginTop: 8 }}>Last saved {new Date(r.updated_at).toLocaleString()}</p>}
              </div>
            )}
          </section>
        );
      })}
    </Page>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { loadStudy, type StudyContext } from "./context";
import { LESSONS } from "./lessons";

export default function StudyLibraryPage() {
  const sb = supabase();
  const [ctx, setCtx] = useState<StudyContext | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/study");
      const c = await loadStudy(sb, s.session.user.id);
      setCtx(c);
      setCurrent(c.own ?? c.students[0]?.id ?? null);
    })();
  }, [sb]);

  const title = "Study skills library";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (!ctx) return <Page title={title}><p className="hint">Loading…</p></Page>;
  const student = ctx.students.find((s) => s.id === current);
  const done = new Set(student ? ctx.done[student.id] ?? [] : []);

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        Short lessons on how to study, using methods with strong research behind them. Each one has a quick check and a small project to try this week. Lessons are free and don&apos;t use any AI. Ready to test yourself? Try the <a href="/practice">practice questions</a>.
      </p>
      {ctx.role === "parent" && ctx.students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {ctx.students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      {student && <p className="hint"><b>{done.size} of {LESSONS.length}</b> lessons finished{ctx.role === "parent" ? ` by ${student.first_name}` : ""}.</p>}
      <div className="lesson-grid">
        {LESSONS.map((l) => (
          <a key={l.id} className={`lesson-tile ${done.has(l.id) ? "lesson-done" : ""}`} href={`/study/${l.id}${student && ctx.role === "parent" ? `?student=${student.id}` : ""}`}>
            <span className="lesson-emoji" aria-hidden="true">{l.emoji}</span>
            <b>{l.title}</b>
            <span className="hint">{l.summary}</span>
            <span className="lesson-meta">
              {l.minutes} min{l.tool ? " · interactive tool" : ""}
              {done.has(l.id) && <span className="pill pill-ok">✓ Done</span>}
              {ctx.reviews[l.id] !== "approved" && <span className="pill">Draft</span>}
            </span>
          </a>
        ))}
      </div>
      <p className="hint" style={{ fontSize: 12 }}>Lessons marked Draft are still being checked by our teacher reviewer.</p>
    </Page>
  );
}

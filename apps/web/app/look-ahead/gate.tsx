"use client";

import { Page } from "../ui";

/**
 * Shown to a student in grades 6 to 8 who opens a college or scholarship page (Constant, 2026-11-08:
 * those are for parents while the student is young). Parents find them under Look ahead.
 */
export function ParentsOnlyForNow({ title }: { title: string }) {
  return (
    <Page title={title}>
      <section className="panel">
        <h2>This opens in 9th grade</h2>
        <p className="hint" style={{ marginTop: 0 }}>Colleges and scholarships come later. For now, the best things to do are good grades, good study habits and the career quiz.</p>
        <div className="kid-links">
          <a className="btn btn-inline btn-sm link-btn" href="/career-quiz">🧩 Career quiz</a>
          <a className="btn btn-ghost btn-inline btn-sm link-btn" href="/study">📚 Study skills</a>
          <a className="btn btn-ghost btn-inline btn-sm link-btn" href="/home">🏠 Home</a>
        </div>
      </section>
    </Page>
  );
}

"use client";

import { useEffect, useState } from "react";

const GOALS = [
  { v: 2.5, label: "2.5" },
  { v: 2.8, label: "2.8" },
  { v: 3.0, label: "3.0 · keeps HOPE" },
  { v: 3.3, label: "3.3" },
  { v: 3.5, label: "3.5" },
  { v: 3.7, label: "3.7 · Zell Miller" },
  { v: 4.0, label: "4.0" },
];
const STANDARDS = [
  { v: "A", label: "A (aiming for straight A's)" },
  { v: "B", label: "B (A's and B's)" },
  { v: "C", label: "C (passing comfortably)" },
] as const;

/** Plain advice about the chosen goal. Free: no AI needed for this part. */
export function goalAdvice(goal: number, min: string): string[] {
  const out: string[] = [];
  if (goal < 3) out.push("A goal under 3.0 won't qualify for the HOPE Scholarship, which needs a 3.0 HOPE GPA. Many other scholarships also ask for 3.0 or higher.");
  else if (goal < 3.7) out.push("A 3.0 or higher keeps HOPE in reach. Zell Miller (full tuition) needs a 3.7 plus a 1200 SAT or 25 ACT.");
  else out.push("This goal aims for Zell Miller, which pays full tuition at Georgia public colleges. It also needs a 1200 SAT or 25 ACT.");
  if (min === "C" && goal >= 3) out.push("With C's allowed, each C needs an A in another core class to stay at a 3.0.");
  if (min !== "A" && goal >= 3.7) out.push("A 3.7 means nearly all A's in core classes, so consider setting the standard to A.");
  out.push("Harder classes (AP, IB, dual enrollment) add 0.5 to B's and lower in the HOPE GPA, and HOPE needs 4 of them.");
  return out;
}

export function GoalsCard({ name, goal, minGrade, canEdit, onSave }: {
  name: string; goal: number | null; minGrade: string; canEdit: boolean;
  onSave: (goal: number, minGrade: string) => Promise<boolean>;
}) {
  const [g, setG] = useState(goal ?? 3);
  const [m, setM] = useState(minGrade || "B");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setG(goal ?? 3); setM(minGrade || "B"); }, [goal, minGrade]);
  const changed = g !== (goal ?? 3) || m !== (minGrade || "B") || goal === null;
  const ask = `${name}'s goal is a ${g.toFixed(1)} GPA, with ${m} as the lowest grade we're OK with in core classes. Is that a good goal for scholarships, and what would it take to reach it?`;

  return (
    <section className="panel">
      <h2>Goals</h2>
      <p className="hint">Set a goal that fits {name}. The scorecard and the AI counselor use it to decide what needs attention. These are suggestions only, and the choice is yours.</p>
      <form
        className="row"
        onSubmit={async (e) => { e.preventDefault(); if (await onSave(g, m)) { setSaved(true); setTimeout(() => setSaved(false), 2500); } }}
      >
        <div className="field" style={{ flex: "0 1 220px" }}><label htmlFor="goal-gpa">GPA goal (HOPE GPA)</label>
          <select id="goal-gpa" className="input" disabled={!canEdit} value={g} onChange={(e) => setG(Number(e.target.value))}>
            {GOALS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select></div>
        <div className="field" style={{ flex: "0 1 280px" }}><label htmlFor="goal-min">Lowest grade we're OK with in a core class</label>
          <select id="goal-min" className="input" disabled={!canEdit} value={m} onChange={(e) => setM(e.target.value)}>
            {STANDARDS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select></div>
        {canEdit && <button className="btn btn-inline" disabled={!changed && !saved}>{saved ? "✓ Saved" : goal === null ? "Set goal" : "Save goal"}</button>}
      </form>
      {goal === null && <p className="hint" style={{ marginTop: 8 }}>No goal saved yet, so the scorecard uses 3.0 (HOPE) and B.</p>}
      <ul className="gaps goal-advice">{goalAdvice(g, m).map((t) => <li key={t}>{t}</li>)}</ul>
      <a className="tile-go" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }} href={`/counselor?ask=${encodeURIComponent(ask)}`}>Ask the AI counselor about this goal →</a>
    </section>
  );
}

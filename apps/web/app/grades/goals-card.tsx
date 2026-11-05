"use client";

import { useEffect, useState } from "react";
import { checkablePrograms, primaryGpa, type StatePack } from "@scholartasks/core";

const BASE_GOALS = [2.5, 2.8, 3.0, 3.3, 3.5, 3.7, 4.0];

/** GPA thresholds of the state's grade-based scholarships, lowest first (one per GPA). */
function tiers(pack: StatePack | null): { gpa: number; name: string; tests?: string }[] {
  if (!pack) return [];
  const out = new Map<number, { gpa: number; name: string; tests?: string }>();
  for (const p of checkablePrograms(pack)) {
    const gpa = p.rules.min_gpa;
    if (gpa === undefined || out.has(gpa)) continue;
    const t = p.rules.tests_any;
    const tests = t ? [t.sat ? `${t.sat} SAT` : "", t.act ? `${t.act} ACT` : ""].filter(Boolean).join(" or ") : undefined;
    out.set(gpa, { gpa, name: p.name.replace(/ \(.*\)$/, ""), tests: tests ? `${p.rules.min_met === 1 ? "or" : "plus"} a ${tests}` : undefined });
  }
  return [...out.values()].sort((a, b) => a.gpa - b.gpa);
}

const fmt = (g: number) => (Math.round(g * 100) % 10 === 0 ? g.toFixed(1) : g.toFixed(2));

const STANDARDS = [
  { v: "A", label: "A (aiming for straight A's)" },
  { v: "B", label: "B (A's and B's)" },
  { v: "C", label: "C (passing comfortably)" },
] as const;

/** Plain advice about the chosen goal, from the student's state pack. Free: no AI needed for this part. */
export function goalAdvice(goal: number, min: string, pack: StatePack | null): string[] {
  const out: string[] = [];
  const t = tiers(pack);
  const label = primaryGpa(pack)?.label ?? "GPA";
  if (t.length === 0) out.push("Many scholarships and college merit awards ask for a 3.0 or higher. Check each college's scholarship page for its own GPA and test score rules.");
  else if (goal < t[0]!.gpa) out.push(`A goal under ${fmt(t[0]!.gpa)} won't qualify for ${t[0]!.name}, which needs a ${fmt(t[0]!.gpa)} ${label}. Many other scholarships also ask for 3.0 or higher.`);
  else {
    const reached = [...t].reverse().find((x) => x.gpa <= goal)!;
    const next = t.find((x) => x.gpa > goal);
    out.push(`A ${fmt(goal)} keeps ${reached.name} in reach${reached.tests ? ` (${reached.tests})` : ""}.${next ? ` ${next.name} needs a ${fmt(next.gpa)}${next.tests ? ` ${next.tests}` : ""}.` : ""}`);
  }
  if (min === "C" && goal >= 3) out.push("With C's allowed, each C needs an A in another core class to stay at a 3.0.");
  if (min !== "A" && goal >= 3.7) out.push("A 3.7 means nearly all A's in core classes, so consider setting the standard to A.");
  const f = primaryGpa(pack);
  if (f) out.push(f.formula.description);
  return out;
}

export function GoalsCard({ name, goal, minGrade, canEdit, onSave, pack }: {
  name: string; goal: number | null; minGrade: string; canEdit: boolean; pack: StatePack | null;
  onSave: (goal: number, minGrade: string) => Promise<boolean>;
}) {
  const t = tiers(pack);
  const goals = [...new Set([...BASE_GOALS, ...t.map((x) => x.gpa)])].sort((a, b) => a - b)
    .map((v) => ({ v, label: [fmt(v), ...t.filter((x) => x.gpa === v).map((x) => x.name)].join(" · ") }));
  const label = primaryGpa(pack)?.label ?? "GPA";
  const def = primaryGpa(pack)?.target ?? 3;
  const [g, setG] = useState(goal ?? def);
  const [m, setM] = useState(minGrade || "B");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setG(goal ?? def); setM(minGrade || "B"); }, [goal, minGrade, def]);
  const changed = g !== (goal ?? def) || m !== (minGrade || "B") || goal === null;
  const ask = `${name}'s goal is a ${g.toFixed(1)} GPA, with ${m} as the lowest grade we're OK with in core classes. Is that a good goal for scholarships, and what would it take to reach it?`;

  return (
    <section className="panel">
      <h2>Goals</h2>
      <p className="hint">Set a goal that fits {name}. The scorecard and the AI counselor use it to decide what needs attention. These are suggestions only, and the choice is yours.</p>
      <form
        className="row"
        onSubmit={async (e) => { e.preventDefault(); if (await onSave(g, m)) { setSaved(true); setTimeout(() => setSaved(false), 2500); } }}
      >
        <div className="field" style={{ flex: "0 1 220px" }}><label htmlFor="goal-gpa">GPA goal ({label})</label>
          <select id="goal-gpa" className="input" disabled={!canEdit} value={g} onChange={(e) => setG(Number(e.target.value))}>
            {goals.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select></div>
        <div className="field" style={{ flex: "0 1 280px" }}><label htmlFor="goal-min">Lowest grade we're OK with in a core class</label>
          <select id="goal-min" className="input" disabled={!canEdit} value={m} onChange={(e) => setM(e.target.value)}>
            {STANDARDS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select></div>
        {canEdit && <button className="btn btn-inline" disabled={!changed && !saved}>{saved ? "✓ Saved" : goal === null ? "Set goal" : "Save goal"}</button>}
      </form>
      {goal === null && <p className="hint" style={{ marginTop: 8 }}>No goal saved yet, so the scorecard uses {fmt(def)}{t[0] ? ` (${t[0].name})` : ""} and B.</p>}
      <ul className="gaps goal-advice">{goalAdvice(g, m, pack).map((t) => <li key={t}>{t}</li>)}</ul>
      <a className="tile-go" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }} href={`/counselor?ask=${encodeURIComponent(ask)}`}>Ask the AI counselor about this goal →</a>
    </section>
  );
}

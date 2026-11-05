import { useState } from "react";
import { buildScorecard, displayGpa, primaryGpa, type CourseGrade, type StatePack } from "@scholartasks/core";
import { PLAIN_GPA as PLAIN } from "../../lib/state-packs";

interface Row { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }

const STATUS = {
  ok: { label: "On track", cls: "pill-ok" },
  close: { label: "Close to the goal", cls: "pill-soon" },
  below: { label: "Below the goal", cls: "pill-late" },
  none: { label: "No grades yet", cls: "" },
} as const;

/**
 * The always-visible GPA scorecard: the state scholarship GPA (HOPE, Bright Futures...) against the goal, the trend,
 * an overall GPA, rigor progress and what needs attention this year.
 */
export function GpaScorecard({ rows, currentGrade, pack, name, compact, href, goal, minGrade, weights, onSaveWeights, onRescue }: {
  rows: Row[]; currentGrade: number; pack: StatePack | null; name?: string; compact?: boolean; href?: string;
  /** The family's own goal and standard; defaults to the state scholarship's GPA (or 3.0) and B. */
  goal?: number | null; minGrade?: string;
  /** The school's extra points for AP/IB/dual enrollment and for honors. */
  weights?: { rigor: number; honors: number };
  /** Shown when the viewer may change the school's weighting. */
  onSaveWeights?: (w: { rigor: number; honors: number }) => Promise<boolean>;
  /** Starts a grade rescue check-in for a class that needs attention. */
  onRescue?: (course: string, grade: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(weights ?? { rigor: 1, honors: 0.5 });
  const main = primaryGpa(pack);
  const formula = main?.formula ?? PLAIN;
  const target = goal ?? main?.target ?? 3;
  const grades: CourseGrade[] = rows.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
  const w = weights ?? { rigor: 1, honors: 0.5 };
  const s = buildScorecard(grades, { currentGrade, formula, target, rigorNeeded: main?.program.rules.rigor_courses, rigorLevels: main?.program.rules.rigor_levels, schoolWeights: w, minGrade: (minGrade || "B") as CourseGrade["grade"] });
  const trend = s.stateGpa !== null && s.stateGpaBefore !== null ? s.stateGpa - s.stateGpaBefore : null;
  const shown = compact ? s.attention.slice(0, 3) : s.attention;
  const gpaName = main?.label ?? "Unweighted GPA";

  return (
    <section className={`panel scorecard scorecard-${s.status}`} aria-label="GPA scorecard">
      <div className="score-head">
        <p className="eyebrow" style={{ margin: 0 }}>{name ? `${name}'s GPA scorecard` : "GPA scorecard"}</p>
        <span className={`pill ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
      </div>
      <div className="score-grid">
        <div className="score-main">
          <span className="score-num">{s.stateGpa === null ? "—" : displayGpa(s.stateGpa)}</span>
          <span className="hint">
            {gpaName} · goal {target.toFixed(1)}
            {trend !== null && Math.abs(trend) >= 0.005 && (
              <b className={trend > 0 ? "trend-up" : "trend-down"}> {trend > 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(2)} this year</b>
            )}
          </span>
          <div className="score-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, ((s.stateGpa ?? 0) / 4) * 100)}%` }} />
            <i style={{ left: `${(target / 4) * 100}%` }} />
          </div>
        </div>
        <div className="score-side">
          <span><b>{s.schoolGpa === null ? "—" : displayGpa(s.schoolGpa)}</b> weighted school GPA <span className="score-note">(AP/IB/DE +{w.rigor}, honors +{w.honors})</span></span>
          <span><b>{s.overallGpa === null ? "—" : displayGpa(s.overallGpa)}</b> unweighted GPA (A = 4, every class the same)</span>
          {s.rigorNeeded > 0 && <span><b>{s.rigorDone} of {s.rigorNeeded}</b> rigor courses (AP, IB, dual enrollment)</span>}
        </div>
      </div>

      {s.status === "none" ? (
        <p className="hint" style={{ margin: "10px 0 0" }}>Add this year's grades to see where things stand.</p>
      ) : s.attention.length === 0 ? (
        <p className="score-fine">✓ Nothing needs attention right now.</p>
      ) : (
        <div className="score-attn">
          <b>Needs attention</b>
          <ul>
            {shown.map((a) => (
              <li key={a.course + a.gradeLevel} className={`attn-${a.severity}`}>
                <span className="grade-chip">{a.grade}</span>
                <span><b>{a.course}</b> <span className="hint">{a.message}</span></span>
                {onRescue && <button className="btn btn-ghost btn-inline btn-sm attn-plan" onClick={() => onRescue(a.course, a.grade)}>Make a plan</button>}
              </li>
            ))}
          </ul>
          {shown.length < s.attention.length && <span className="hint">and {s.attention.length - shown.length} more</span>}
        </div>
      )}
      {href && <a className="tile-go" href={href}>See all grades →</a>}
      {onSaveWeights && !editing && (
        <button className="linklike score-edit" onClick={() => { setDraft(w); setEditing(true); }}>Match my school's weighting</button>
      )}
      {onSaveWeights && editing && (
        <form
          className="score-weights"
          onSubmit={async (e) => { e.preventDefault(); if (await onSaveWeights(draft)) setEditing(false); }}
        >
          <p className="hint" style={{ margin: 0 }}>Check the report card or school handbook for how many extra points harder classes get. Many schools add 1 for AP, IB and dual enrollment, and 0.5 for honors, but it varies.</p>
          <div className="field"><label htmlFor="w-rigor">AP, IB, dual enrollment</label>
            <select id="w-rigor" className="input" value={draft.rigor} onChange={(e) => setDraft({ ...draft, rigor: Number(e.target.value) })}>
              {[0, 0.5, 1, 1.5].map((n) => <option key={n} value={n}>+{n}</option>)}
            </select></div>
          <div className="field"><label htmlFor="w-honors">Honors</label>
            <select id="w-honors" className="input" value={draft.honors} onChange={(e) => setDraft({ ...draft, honors: Number(e.target.value) })}>
              {[0, 0.5, 1].map((n) => <option key={n} value={n}>+{n}</option>)}
            </select></div>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <button className="btn btn-inline">Save</button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
      {!compact && <p className="hint" style={{ fontSize: 12, margin: "10px 0 0" }}>{main ? <>{main.formula.description} Estimate only{pack?.aid_site ? <>, {pack.aid_site.name} has the official number</> : <>; the {pack?.agency.name} decides the official number</>}.</> : <>Your state has no grade-based state scholarship in ScholarTasks yet, so this shows the unweighted GPA. Colleges and scholarships look at it too.</>}</p>}
    </section>
  );
}

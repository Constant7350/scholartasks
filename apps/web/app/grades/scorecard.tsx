import { buildScorecard, displayGpa, type CourseGrade, type StatePack } from "@scholartasks/core";

interface Row { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }

const STATUS = {
  ok: { label: "On track", cls: "pill-ok" },
  close: { label: "Close to the goal", cls: "pill-soon" },
  below: { label: "Below the goal", cls: "pill-late" },
  none: { label: "No grades yet", cls: "" },
} as const;

/**
 * The always-visible GPA scorecard: HOPE GPA against the goal, the trend,
 * an overall GPA, rigor progress and what needs attention this year.
 */
export function GpaScorecard({ rows, currentGrade, pack, name, compact, href }: {
  rows: Row[]; currentGrade: number; pack: StatePack; name?: string; compact?: boolean; href?: string;
}) {
  const hope = pack.programs.find((p) => p.rules.gpa_formula);
  const formula = hope?.rules.gpa_formula ? pack.gpa_formulas[hope.rules.gpa_formula] : undefined;
  if (!hope || !formula) return null;
  const target = hope.rules.min_gpa ?? 3;
  const grades: CourseGrade[] = rows.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
  const s = buildScorecard(grades, { currentGrade, formula, target, rigorNeeded: hope.rules.rigor_courses, rigorLevels: hope.rules.rigor_levels });
  const trend = s.stateGpa !== null && s.stateGpaBefore !== null ? s.stateGpa - s.stateGpaBefore : null;
  const shown = compact ? s.attention.slice(0, 3) : s.attention;
  const gpaName = hope.name.replace(/ Scholarship$/, "");

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
            {gpaName} GPA · goal {target.toFixed(1)}
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
          <span><b>{s.overallGpa === null ? "—" : displayGpa(s.overallGpa)}</b> overall GPA (all courses)</span>
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
              </li>
            ))}
          </ul>
          {shown.length < s.attention.length && <span className="hint">and {s.attention.length - shown.length} more</span>}
        </div>
      )}
      {href && <a className="tile-go" href={href}>See all grades →</a>}
      {!compact && <p className="hint" style={{ fontSize: 12, margin: "10px 0 0" }}>{gpaName} counts core courses from 9th to 12th grade only; 8th grade courses count in the overall GPA. Estimate only, GAfutures has the official number.</p>}
    </section>
  );
}

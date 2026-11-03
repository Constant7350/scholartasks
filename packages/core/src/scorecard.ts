import { computeGpa, type CourseGrade } from "./gpa";
import type { CourseLevel, GpaFormula } from "./schema";

export interface AttentionItem {
  course: string;
  grade: CourseGrade["grade"];
  gradeLevel: number;
  /** "urgent" for a D or F, "watch" for a core grade under the goal. */
  severity: "urgent" | "watch";
  message: string;
}

export interface Scorecard {
  /** The state's scholarship GPA (HOPE in Georgia), or null before any counted course. */
  stateGpa: number | null;
  /** The same GPA without this school year's courses, to show the trend. */
  stateGpaBefore: number | null;
  /** Every course entered, unweighted 4.0 scale. */
  overallGpa: number | null;
  target: number;
  status: "none" | "ok" | "close" | "below";
  rigorDone: number;
  rigorNeeded: number;
  attention: AttentionItem[];
}

const UNWEIGHTED: GpaFormula = {
  description: "All courses, unweighted",
  courses: "all",
  grade_levels: [6, 7, 8, 9, 10, 11, 12],
  scale: { A: 4, B: 3, C: 2, D: 1, F: 0 },
  weights: [],
  rounding: "none",
};

/**
 * One view of where a student stands: the scholarship GPA against their goal,
 * an overall GPA, rigor progress and the courses that need attention now.
 */
export function buildScorecard(
  grades: CourseGrade[],
  opts: { currentGrade: number; formula: GpaFormula; target: number; rigorNeeded?: number; rigorLevels?: CourseLevel[] },
): Scorecard {
  const { formula, target } = opts;
  const stateGpa = computeGpa(grades, formula).gpa;
  const earlier = grades.filter((g) => g.gradeLevel < opts.currentGrade);
  const stateGpaBefore = earlier.length < grades.length ? computeGpa(earlier, formula).gpa : null;
  const overallGpa = computeGpa(grades, UNWEIGHTED).gpa;

  const levels = opts.rigorLevels ?? ["AP", "IB", "DE"];
  const rigorDone = grades.filter((g) => levels.includes(g.level)).length;

  // This year's courses are the ones that can still change; if none are
  // entered yet, look at the most recent year that has grades.
  const latest = grades.some((g) => g.gradeLevel === opts.currentGrade)
    ? opts.currentGrade
    : Math.max(-1, ...grades.filter((g) => g.gradeLevel <= opts.currentGrade).map((g) => g.gradeLevel));
  const attention: AttentionItem[] = [];
  for (const g of grades.filter((c) => c.gradeLevel === latest)) {
    if (g.grade === "D" || g.grade === "F") {
      attention.push({ course: g.course, grade: g.grade, gradeLevel: g.gradeLevel, severity: "urgent", message: g.grade === "F" ? "Failing: talk with the teacher this week." : "At risk of failing: make a plan this week." });
    } else if (g.core && (formula.scale[g.grade] ?? 0) < target) {
      attention.push({ course: g.course, grade: g.grade, gradeLevel: g.gradeLevel, severity: "watch", message: `Below the ${target.toFixed(1)} goal: this grade pulls the GPA down.` });
    }
  }
  attention.sort((a, b) => (a.severity === b.severity ? a.course.localeCompare(b.course) : a.severity === "urgent" ? -1 : 1));

  const status = stateGpa === null ? "none" : stateGpa >= target ? "ok" : stateGpa >= target - 0.2 ? "close" : "below";
  return { stateGpa, stateGpaBefore, overallGpa, target, status, rigorDone, rigorNeeded: opts.rigorNeeded ?? 0, attention };
}

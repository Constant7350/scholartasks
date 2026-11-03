import type { CourseLevel, GpaFormula, LetterGrade } from "./schema";

export interface CourseGrade {
  term: string;
  course: string;
  grade: LetterGrade;
  level: CourseLevel;
  /** Core academic course (English, math, science, social studies, foreign language). */
  core: boolean;
  /** School grade level when taken, e.g. 9. */
  gradeLevel: number;
}

export interface GpaResult {
  gpa: number | null;
  coursesCounted: number;
}

/** Computes a state's scholarship GPA from a reusable formula definition. */
export function computeGpa(grades: CourseGrade[], formula: GpaFormula): GpaResult {
  const counted = grades.filter(
    (g) => (formula.courses === "all" || g.core) && formula.grade_levels.includes(g.gradeLevel),
  );
  if (counted.length === 0) return { gpa: null, coursesCounted: 0 };

  let total = 0;
  for (const g of counted) {
    let points = formula.scale[g.grade] ?? 0;
    for (const w of formula.weights) {
      if (w.levels.includes(g.level) && w.applies_to.includes(g.grade)) points += w.add;
    }
    if (formula.cap !== undefined) points = Math.min(points, formula.cap);
    total += points;
  }
  let gpa = total / counted.length;
  if (formula.rounding === "two_decimals") gpa = Math.round(gpa * 100) / 100;
  return { gpa, coursesCounted: counted.length };
}

/** Shows a GPA without ever rounding up past a threshold (2.999 shows as 2.99). */
export function displayGpa(gpa: number): string {
  return (Math.floor(gpa * 100) / 100).toFixed(2);
}

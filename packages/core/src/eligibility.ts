import { computeGpa, displayGpa, type CourseGrade } from "./gpa";
import type { Program, StatePack } from "./schema";

export interface StudentProfile {
  state: string;
  gradeLevel: number;
  grades: CourseGrade[];
  sat?: number;
  act?: number;
}

export type Gap =
  | { kind: "gpa"; needed: number; current: number | null; message: string }
  | { kind: "rigor"; needed: number; current: number; message: string }
  | { kind: "test"; needed: { sat?: number; act?: number }; message: string };

export interface ProgramResult {
  programId: string;
  programName: string;
  /** "eligible" only when every rule is met; "on_track" when gaps remain. */
  status: "eligible" | "on_track";
  gpa: number | null;
  gaps: Gap[];
  sourceUrl: string;
}

export function evaluateProgram(student: StudentProfile, program: Program, pack: StatePack): ProgramResult {
  const r = program.rules;
  const gaps: Gap[] = [];
  let gpa: number | null = null;

  if (r.gpa_formula) {
    const formula = pack.gpa_formulas[r.gpa_formula];
    if (!formula) throw new Error(`Pack ${pack.state}: unknown GPA formula ${r.gpa_formula}`);
    gpa = computeGpa(student.grades, formula).gpa;
    if (r.min_gpa !== undefined && (gpa === null || gpa < r.min_gpa)) {
      gaps.push({
        kind: "gpa",
        needed: r.min_gpa,
        current: gpa,
        message:
          gpa === null
            ? `Enter grades to check the ${r.min_gpa.toFixed(1)} GPA requirement.`
            : `Needs a ${r.min_gpa.toFixed(1)} GPA; currently ${displayGpa(gpa)}.`,
      });
    }
  }

  if (r.rigor_courses) {
    const levels = r.rigor_levels ?? [];
    const done = student.grades.filter((g) => levels.includes(g.level)).length;
    if (done < r.rigor_courses) {
      gaps.push({
        kind: "rigor",
        needed: r.rigor_courses,
        current: done,
        message: `Needs ${r.rigor_courses} rigor courses (${levels.join(", ")}); ${done} so far.`,
      });
    }
  }

  if (r.tests_any) {
    const { sat, act } = r.tests_any;
    const met = (sat !== undefined && (student.sat ?? 0) >= sat) || (act !== undefined && (student.act ?? 0) >= act);
    if (!met) {
      const parts = [sat !== undefined ? `${sat} SAT` : null, act !== undefined ? `${act} ACT` : null].filter(Boolean);
      gaps.push({ kind: "test", needed: { sat, act }, message: `Needs ${parts.join(" or ")}.` });
    }
  }

  return {
    programId: program.id,
    programName: program.name,
    status: gaps.length === 0 ? "eligible" : "on_track",
    gpa,
    gaps,
    sourceUrl: program.source_url,
  };
}

export function evaluateStatePrograms(student: StudentProfile, pack: StatePack): ProgramResult[] {
  if (student.state !== pack.state) throw new Error(`Student state ${student.state} does not match pack ${pack.state}`);
  return pack.programs.map((p) => evaluateProgram(student, p, pack));
}

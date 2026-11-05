import { computeGpa, displayGpa, type CourseGrade } from "./gpa";
import type { GpaFormula, Program, StatePack } from "./schema";

export interface StudentProfile {
  state: string;
  gradeLevel: number;
  grades: CourseGrade[];
  sat?: number;
  act?: number;
  /** Graduating class (e.g. 2028), for rules that change by class. */
  classOf?: number;
}

export type Gap =
  | { kind: "gpa"; needed: number; current: number | null; message: string }
  | { kind: "rigor"; needed: number; current: number; message: string }
  | { kind: "test"; needed: { sat?: number; act?: number }; message: string }
  /** A rule the app can't see, such as class rank. */
  | { kind: "check"; message: string };

export interface ProgramResult {
  programId: string;
  programName: string;
  /** "eligible" only when every rule the app can check is met; "on_track" when gaps remain. */
  status: "eligible" | "on_track";
  gpa: number | null;
  gaps: Gap[];
  /** Other requirements to confirm (service hours, income, a state form). Never block "eligible". */
  checks: string[];
  sourceUrl: string;
}

/** Test scores this student needs for a program (some states change them by graduating class). */
export function testsFor(program: Program, classOf?: number): { sat?: number; act?: number } | undefined {
  const r = program.rules;
  if (!r.tests_any) return undefined;
  const override = classOf !== undefined ? r.tests_by_class?.[String(classOf)] : undefined;
  return override ? { ...r.tests_any, ...override } : r.tests_any;
}

export function evaluateProgram(student: StudentProfile, program: Program, pack: StatePack): ProgramResult {
  const r = program.rules;
  const gaps: Gap[] = [];
  /** GPA, test and class rank are "either/or" rules when min_met is set; rigor always counts. */
  const choice: Gap[] = [];
  const rigorGaps: Gap[] = [];
  let met = 0;
  let gpa: number | null = null;

  if (r.gpa_formula) {
    const formula = pack.gpa_formulas[r.gpa_formula];
    if (!formula) throw new Error(`Pack ${pack.state}: unknown GPA formula ${r.gpa_formula}`);
    gpa = computeGpa(student.grades, formula).gpa;
    if (r.min_gpa !== undefined) {
      if (gpa !== null && gpa >= r.min_gpa) met++;
      else
        choice.push({
          kind: "gpa",
          needed: r.min_gpa,
          current: gpa,
          message:
            gpa === null
              ? `Enter grades to check the ${r.min_gpa.toFixed(2).replace(/0$/, "")} GPA requirement.`
              : `Needs a ${r.min_gpa.toFixed(2).replace(/0$/, "")} GPA; currently ${displayGpa(gpa)}.`,
        });
    }
  }

  if (r.rigor_courses) {
    const levels = r.rigor_levels ?? [];
    const done = student.grades.filter((g) => levels.includes(g.level)).length;
    if (done < r.rigor_courses) {
      rigorGaps.push({
        kind: "rigor",
        needed: r.rigor_courses,
        current: done,
        message: `Needs ${r.rigor_courses} rigor courses (${levels.join(", ")}); ${done} so far.`,
      });
    }
  }

  const tests = testsFor(program, student.classOf);
  if (tests) {
    const { sat, act } = tests;
    const ok = (sat !== undefined && (student.sat ?? 0) >= sat) || (act !== undefined && (student.act ?? 0) >= act);
    if (ok) met++;
    else {
      const parts = [sat !== undefined ? `${sat} SAT` : null, act !== undefined ? `${act} ACT` : null].filter(Boolean);
      choice.push({ kind: "test", needed: { sat, act }, message: `Needs ${parts.join(" or ")}.` });
    }
  }

  const rules = (r.min_gpa !== undefined && r.gpa_formula ? 1 : 0) + (tests ? 1 : 0) + (r.class_rank_top_pct ? 1 : 0);
  const need = r.min_met ?? rules;
  if (r.class_rank_top_pct) {
    const rank = `class rank in the top ${r.class_rank_top_pct}% (ask the school counselor)`;
    if (met < need) {
      // Rank might be the missing piece: say so instead of listing every other rule.
      if (met + 1 >= need && r.min_met !== undefined) gaps.push({ kind: "check", message: `Qualifies with a ${rank}, or by meeting: ${choice.map((c) => c.message).join(" ")}` });
      else {
        gaps.push(...choice);
        gaps.push({ kind: "check", message: `Also needs a ${rank}.` });
      }
    } else if (r.min_met === undefined) gaps.push({ kind: "check", message: `Also needs a ${rank}.` });
  } else if (met < need) {
    if (r.min_met !== undefined && choice.length > 1) {
      gaps.push({ kind: "check", message: `Meet ${need === 1 ? "one" : need} of these: ${choice.map((c) => c.message.replace(/\.$/, "")).join(" or ")}.` });
    } else gaps.push(...choice);
  }

  // Keep the familiar order: GPA, then rigor, then the rest.
  const at = gaps[0]?.kind === "gpa" ? 1 : 0;
  gaps.splice(at, 0, ...rigorGaps);

  return {
    programId: program.id,
    programName: program.name,
    status: gaps.length === 0 ? "eligible" : "on_track",
    gpa,
    gaps,
    checks: r.also ?? [],
    sourceUrl: program.source_url,
  };
}

/** Programs the app can check from grades and scores (merit awards). Need-based grants are listed elsewhere. */
export function checkablePrograms(pack: StatePack): Program[] {
  return pack.programs.filter((p) => p.rules.gpa_formula || p.rules.tests_any);
}

export function evaluateStatePrograms(student: StudentProfile, pack: StatePack): ProgramResult[] {
  if (student.state !== pack.state) throw new Error(`Student state ${student.state} does not match pack ${pack.state}`);
  return checkablePrograms(pack).map((p) => evaluateProgram(student, p, pack));
}

/**
 * The state's main scholarship GPA, used by the scorecard and transcript (HOPE GPA in Georgia,
 * Bright Futures GPA in Florida). Null for states with no grade-based state scholarship.
 */
export function primaryGpa(pack: StatePack | null | undefined): {
  program: Program; formula: GpaFormula; label: string; target: number; rigorNeeded: number;
} | null {
  if (!pack) return null;
  const program = pack.programs.find((p) => p.rules.gpa_formula && p.rules.min_gpa !== undefined) ?? pack.programs.find((p) => p.rules.gpa_formula);
  const formula = program?.rules.gpa_formula ? pack.gpa_formulas[program.rules.gpa_formula] : undefined;
  if (!program || !formula) return null;
  return {
    program,
    formula,
    label: formula.label ?? `${pack.name} scholarship GPA`,
    target: program.rules.min_gpa ?? 3,
    rigorNeeded: program.rules.rigor_courses ?? 0,
  };
}

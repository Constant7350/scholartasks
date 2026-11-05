import { z } from "zod";
import { AidStep } from "./aid";

/**
 * State packs hold everything state-specific: programs, GPA formulas,
 * forms and deadlines. App code must never hard-code any of it.
 */

export const LetterGrade = z.enum(["A", "B", "C", "D", "F"]);
export type LetterGrade = z.infer<typeof LetterGrade>;

export const CourseLevel = z.enum(["standard", "honors", "AP", "IB", "DE"]);
export type CourseLevel = z.infer<typeof CourseLevel>;

export const PackStatus = z.enum(["draft", "review", "beta", "live"]);
export type PackStatus = z.infer<typeof PackStatus>;

export const GpaFormula = z.object({
  /** Short name families know, e.g. "HOPE GPA" or "Bright Futures GPA". */
  label: z.string().optional(),
  description: z.string(),
  /** Which courses count: only core academic courses, or every course. */
  courses: z.enum(["core_only", "all"]),
  /** High school grade levels included, e.g. [9, 10, 11, 12]. */
  grade_levels: z.array(z.number().int().min(6).max(12)).min(1),
  /** Points per letter grade. */
  scale: z.record(LetterGrade, z.number()),
  /** Extra points for course levels, limited to certain letter grades. */
  weights: z
    .array(
      z.object({
        levels: z.array(CourseLevel).min(1),
        add: z.number(),
        applies_to: z.array(LetterGrade).min(1),
      }),
    )
    .default([]),
  /** Optional ceiling on points for a single course. */
  cap: z.number().optional(),
  /** "none" means the exact value is compared: 2.99 never becomes 3.0. */
  rounding: z.enum(["none", "two_decimals"]),
});
export type GpaFormula = z.infer<typeof GpaFormula>;

const TestScores = z.object({ sat: z.number().int().optional(), act: z.number().int().optional() });

export const ProgramRules = z.object({
  gpa_formula: z.string().optional(),
  min_gpa: z.number().optional(),
  rigor_courses: z.number().int().optional(),
  rigor_levels: z.array(CourseLevel).optional(),
  /** Student must meet at least one of these test scores. */
  tests_any: TestScores.optional(),
  /** Different test scores for some graduating classes, e.g. { "2028": { sat: 1350 } }. */
  tests_by_class: z.record(z.string().regex(/^\d{4}$/), TestScores).optional(),
  /** Needs a class rank in the top N percent. The app can't see rank, so it is shown as something to check. */
  class_rank_top_pct: z.number().positive().max(100).optional(),
  /**
   * How many of the rules (GPA, test score, class rank) must be met. Leave out when all are needed.
   * Tennessee HOPE is 1 (a 3.0 GPA or a 21 ACT); South Carolina LIFE is 2 of 3.
   */
  min_met: z.number().int().min(1).optional(),
  /** Other requirements the app can't check (service hours, income, residency, a state form). */
  also: z.array(z.string()).optional(),
});
export type ProgramRules = z.infer<typeof ProgramRules>;

export const Program = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["merit", "need", "merit_and_need", "grant", "tuition_discount"]),
  summary: z.string(),
  rules: ProgramRules,
  award: z.object({
    summary: z.string(),
    /**
     * Rough yearly amount for cost estimates, for students living in this state at
     * colleges in this state. "tuition" = covers in-state tuition at public colleges.
     */
    estimate: z
      .object({
        public: z.union([z.literal("tuition"), z.number().nonnegative()]).optional(),
        private_per_year: z.number().nonnegative().optional(),
      })
      .optional(),
  }),
  application: z.array(z.string()),
  source_url: z.string().url(),
});
export type Program = z.infer<typeof Program>;

export const Deadline = z.object({
  id: z.string(),
  title: z.string(),
  form: z.string(),
  /** ISO date, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["opens", "priority", "deadline"]),
  where: z.string().url(),
  documents: z.array(z.string()).default([]),
  /** School grade levels this applies to. */
  grade_levels: z.array(z.number().int()).min(1),
  /** When set, the date is for this graduating class only (a date belongs to one FAFSA year). */
  class_of: z.number().int().optional(),
});
export type Deadline = z.infer<typeof Deadline>;

export const Verification = z.object({
  last_verified: z.string().nullable(),
  verified_by: z.string().nullable(),
  note: z.string(),
});

export const StatePack = z.object({
  kind: z.literal("state"),
  state: z.string().length(2),
  name: z.string(),
  version: z.string(),
  status: PackStatus,
  regions: z.array(z.string()).default([]),
  agency: z.object({ name: z.string(), url: z.string().url() }),
  gpa_formulas: z.record(z.string(), GpaFormula),
  programs: z.array(Program),
  forms: z.array(z.string()),
  deadlines: z.array(Deadline),
  /** State aid-form steps added to the federal FAFSA guide (packs/federal/aid-guide.json). */
  aid_steps: z.array(AidStep).default([]),
  /** The state's own student aid website, where families check awards (e.g. GAfutures). */
  aid_site: z.object({ name: z.string(), url: z.string().url() }).optional(),
  /** State facts for the AI counselor, one short paragraph each. */
  counselor_notes: z.array(z.string()).default([]),
  verification: Verification,
});
export type StatePack = z.infer<typeof StatePack>;

export const RegionPack = z.object({
  kind: z.literal("region"),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  status: PackStatus,
  members: z.array(z.string().length(2)).min(1),
  summary: z.string(),
  source_url: z.string().url(),
  verification: Verification,
});
export type RegionPack = z.infer<typeof RegionPack>;

/** Extra checks zod can't express: every reference must resolve. */
export function checkStatePack(pack: StatePack): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of pack.programs) {
    if (ids.has(p.id)) problems.push(`duplicate program id ${p.id}`);
    ids.add(p.id);
    const f = p.rules.gpa_formula;
    if (f && !pack.gpa_formulas[f]) problems.push(`${p.id}: unknown gpa_formula ${f}`);
    if (p.rules.min_gpa !== undefined && !f) problems.push(`${p.id}: min_gpa needs gpa_formula`);
    if (p.rules.rigor_courses && !p.rules.rigor_levels?.length)
      problems.push(`${p.id}: rigor_courses needs rigor_levels`);
    const rules = [f && p.rules.min_gpa !== undefined, !!p.rules.tests_any, !!p.rules.class_rank_top_pct].filter(Boolean).length;
    if (p.rules.min_met !== undefined && p.rules.min_met > rules)
      problems.push(`${p.id}: min_met ${p.rules.min_met} is more than its ${rules} rules`);
    if (p.rules.tests_by_class && !p.rules.tests_any) problems.push(`${p.id}: tests_by_class needs tests_any`);
    for (const form of p.application)
      if (!pack.forms.includes(form)) problems.push(`${p.id}: form ${form} not listed in forms`);
  }
  for (const d of pack.deadlines)
    if (!pack.forms.includes(d.form)) problems.push(`deadline ${d.id}: form ${d.form} not listed in forms`);
  if (pack.status === "live" && !pack.verification.last_verified)
    problems.push("a live pack must have verification.last_verified");
  return problems;
}

/** State aid offices for states without a full pack (packs/federal/state-agencies.json). */
export const StateAgencies = z.object({
  kind: z.literal("state-agencies"),
  version: z.string(),
  note: z.string(),
  agencies: z.array(
    z.object({ state: z.string().length(2), name: z.string(), url: z.string().url(), programs: z.array(z.string()).default([]) }),
  ),
});
export type StateAgencies = z.infer<typeof StateAgencies>;

import type { CourseLevel } from "./schema";

/**
 * Four-year course planner: the student lays out grades 9 to 12 course by
 * course, and this checks the plan against graduation credits, the state
 * scholarship's rigor courses and the usual college-prep extras. Advice only:
 * every school's handbook and course list is the final word.
 */

export type Bucket = "english" | "math" | "science" | "social" | "health_pe" | "pathway" | "elective";

export interface PlanCourse { grade: number; course: string; subject: string | null; level: CourseLevel; credits?: number; done?: boolean }

export interface GradRules {
  label: string;
  total: number;
  needs: { bucket: Bucket; label: string; credits: number }[];
  /** A note shown under the checklist, e.g. where the official rules live. */
  note: string;
  /** Most four-year colleges in the state want 2 years of the same world language. */
  sameLanguage?: number;
}

const GENERIC: GradRules = {
  label: "Typical U.S. graduation plan",
  total: 22,
  needs: [
    { bucket: "english", label: "English", credits: 4 },
    { bucket: "math", label: "Math", credits: 3 },
    { bucket: "science", label: "Science", credits: 3 },
    { bucket: "social", label: "Social studies", credits: 3 },
    { bucket: "health_pe", label: "Health and PE", credits: 1 },
  ],
  note: "Every state and school sets its own graduation rules. Check your school's course handbook or ask the counselor.",
  sameLanguage: 2,
};

/** Graduation rules by state. States not listed use the typical plan. */
export const GRAD_RULES: Record<string, GradRules> = {
  GA: {
    label: "Georgia graduation plan",
    total: 23,
    needs: [
      { bucket: "english", label: "English", credits: 4 },
      { bucket: "math", label: "Math", credits: 4 },
      { bucket: "science", label: "Science", credits: 4 },
      { bucket: "social", label: "Social studies", credits: 3 },
      { bucket: "health_pe", label: "Health and PE", credits: 1 },
      { bucket: "pathway", label: "Career tech, world language or fine arts", credits: 3 },
    ],
    note: "Georgia's state rule is 23 credits. Your school may ask for more. Georgia's public universities also want 2 years of the same world language.",
    sameLanguage: 2,
  },
};

export const gradRulesFor = (state: string | null | undefined): GradRules => GRAD_RULES[(state ?? "").toUpperCase()] ?? GENERIC;

/** Which requirement a subject counts toward. */
export function bucketOf(subject: string | null | undefined): Bucket {
  const s = (subject ?? "").toLowerCase();
  if (/english|language arts|literature/.test(s)) return "english";
  if (/math/.test(s)) return "math";
  if (/science/.test(s) && !/computer/.test(s)) return "science";
  if (/social|history/.test(s)) return "social";
  if (/health|pe\b|physical/.test(s)) return "health_pe";
  if (/world lang|fine art|career|computer|ctae/.test(s)) return "pathway";
  return "elective";
}

/** The language a world-language course teaches, e.g. "Spanish III" → "spanish". */
export function languageOf(course: string): string | null {
  const m = course.match(/\b(Spanish|French|German|Latin|Chinese|Japanese|Italian|Arabic|Korean|American Sign Language)\b/i);
  return m ? m[1]!.toLowerCase() : null;
}

export interface PlanCheck {
  rules: GradRules;
  total: number;
  lines: { label: string; needed: number; planned: number; ok: boolean }[];
  rigorPlanned: number;
  rigorNeeded: number;
  rigorByGrade: Record<number, number>;
  sameLanguageYears: number;
  creditsByGrade: Record<number, number>;
  warnings: string[];
  ready: boolean;
}

/** Checks a four-year plan. `rigorNeeded` and `rigorLevels` come from the state's scholarship rules. */
export function checkPlan(plan: PlanCourse[], opts: { state?: string | null; rigorNeeded?: number; rigorLevels?: CourseLevel[] }): PlanCheck {
  const rules = gradRulesFor(opts.state);
  const levels = opts.rigorLevels ?? ["AP", "IB", "DE"];
  const credit = (c: PlanCourse) => (typeof c.credits === "number" && c.credits > 0 ? c.credits : 1);
  const hs = plan.filter((c) => c.grade >= 9 && c.grade <= 12);

  const byBucket = new Map<Bucket, number>();
  for (const c of hs) byBucket.set(bucketOf(c.subject), (byBucket.get(bucketOf(c.subject)) ?? 0) + credit(c));
  const lines = rules.needs.map((n) => {
    const planned = byBucket.get(n.bucket) ?? 0;
    return { label: n.label, needed: n.credits, planned, ok: planned >= n.credits };
  });
  const total = hs.reduce((s, c) => s + credit(c), 0);
  lines.push({ label: "Total credits", needed: rules.total, planned: total, ok: total >= rules.total });

  const rigorByGrade: Record<number, number> = { 9: 0, 10: 0, 11: 0, 12: 0 };
  const creditsByGrade: Record<number, number> = { 9: 0, 10: 0, 11: 0, 12: 0 };
  for (const c of hs) {
    creditsByGrade[c.grade] = (creditsByGrade[c.grade] ?? 0) + credit(c);
    if (levels.includes(c.level)) rigorByGrade[c.grade] = (rigorByGrade[c.grade] ?? 0) + 1;
  }
  const rigorPlanned = Object.values(rigorByGrade).reduce((a, b) => a + b, 0);
  const rigorNeeded = opts.rigorNeeded ?? 0;

  const langYears = new Map<string, number>();
  for (const c of hs) { const l = languageOf(c.course); if (l) langYears.set(l, (langYears.get(l) ?? 0) + 1); }
  const sameLanguageYears = Math.max(0, ...langYears.values());

  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const c of hs) {
    const k = c.course.trim().toLowerCase();
    if (seen.has(k)) warnings.push(`${c.course} is in the plan twice.`);
    seen.add(k);
  }
  for (const g of [9, 10, 11, 12]) {
    if (rigorByGrade[g]! >= 5) warnings.push(`Grade ${g} has ${rigorByGrade[g]} AP, IB or dual enrollment classes. That is a very heavy year; check it with the counselor.`);
    if (creditsByGrade[g]! > 8) warnings.push(`Grade ${g} has ${creditsByGrade[g]} credits. Most schools allow 6 to 8 a year.`);
  }
  if (rules.sameLanguage && sameLanguageYears < rules.sameLanguage && hs.length >= 12)
    warnings.push(`Most four-year colleges want ${rules.sameLanguage} years of the same world language. The plan has ${sameLanguageYears}.`);
  if (rigorNeeded && rigorPlanned < rigorNeeded && hs.length >= 12)
    warnings.push(`The state scholarship needs ${rigorNeeded} rigor courses. The plan has ${rigorPlanned}.`);
  const mathByGrade = [9, 10, 11, 12].filter((g) => hs.some((c) => c.grade === g && bucketOf(c.subject) === "math"));
  if (hs.some((c) => c.grade === 12) && !mathByGrade.includes(12)) warnings.push("There is no math in grade 12. Many colleges like to see math every year.");

  const ready = lines.every((l) => l.ok) && (!rigorNeeded || rigorPlanned >= rigorNeeded);
  return { rules, total, lines, rigorPlanned, rigorNeeded, rigorByGrade, sameLanguageYears, creditsByGrade, warnings, ready };
}

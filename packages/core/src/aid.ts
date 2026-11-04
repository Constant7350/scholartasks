import { z } from "zod";

/**
 * Financial aid form help: the FAFSA (federal) plus each state's own forms.
 *
 * The federal guide lives in packs/federal/aid-guide.json and each state pack
 * may add its own steps (aid_steps). ScholarTasks never files a form, never
 * signs in to StudentAid.gov or a state site, and never stores an FSA ID,
 * password or Social Security number. It explains, lists and reminds.
 */

export const AidStage = z.enum(["accounts", "gather", "file", "after", "decide"]);
export type AidStage = z.infer<typeof AidStage>;

export const AID_STAGES: { id: AidStage; title: string }[] = [
  { id: "accounts", title: "1. Make the accounts" },
  { id: "gather", title: "2. Gather what you need" },
  { id: "file", title: "3. Fill in and submit" },
  { id: "after", title: "4. After you submit" },
  { id: "decide", title: "5. Compare offers and accept" },
];

export const AidStep = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  stage: AidStage,
  /** Sort position inside the whole list, so state steps can sit between federal ones. */
  order: z.number(),
  title: z.string(),
  who: z.enum(["student", "parent", "family"]),
  minutes: z.number().int().positive().optional(),
  /** Optional steps can be marked "Doesn't apply to us". */
  optional: z.boolean().default(false),
  summary: z.string(),
  how: z.array(z.string()).min(1),
  /** Safety or common-mistake notes, shown highlighted. */
  watch_out: z.array(z.string()).default([]),
  link: z.object({ label: z.string(), url: z.string().url() }).optional(),
  /** Set when the step is answered inside ScholarTasks (e.g. the household questions). */
  in_app: z.enum(["household", "documents", "college_dates"]).optional(),
});
export type AidStep = z.infer<typeof AidStep>;

export const AidCycle = z.object({
  /** e.g. "2027-28": the college year the aid pays for. */
  id: z.string().regex(/^\d{4}-\d{2}$/),
  /** High school class (graduation year) that files this cycle as seniors. */
  for_class_of: z.number().int(),
  opens: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** True when the opening date is the usual one, not yet announced. */
  opens_expected: z.boolean().default(false),
  federal_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  corrections_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Tax year the form asks about ("prior-prior year"). */
  tax_year: z.number().int(),
});
export type AidCycle = z.infer<typeof AidCycle>;

export const AidDocument = z.object({
  id: z.string(),
  text: z.string(),
  who: z.enum(["student", "parent", "family"]),
  /** Shown when any condition matches: "flag" (true) or "key=value". No conditions means always. */
  when: z.array(z.string()).default([]),
  /** Why it is needed or where to find it. */
  hint: z.string().optional(),
});
export type AidDocument = z.infer<typeof AidDocument>;

export const AidGuide = z.object({
  kind: z.literal("aid_guide"),
  version: z.string(),
  status: z.enum(["draft", "review", "beta", "live"]),
  cycles: z.array(AidCycle).min(1),
  steps: z.array(AidStep).min(1),
  documents: z.array(AidDocument).min(1),
  /** Things ScholarTasks will never ask for, shown on the page. */
  never_store: z.array(z.string()).min(1),
  sources: z.array(z.string().url()).min(1),
  verification: z.object({ last_verified: z.string().nullable(), verified_by: z.string().nullable(), note: z.string() }),
});
export type AidGuide = z.infer<typeof AidGuide>;

/** A family's answers to the short "about your household" questions. Situations only, never numbers or IDs. */
export const HouseholdAnswers = z.object({
  parents: z.enum(["married", "unmarried_together", "divorced_separated", "remarried", "single_widowed"]).optional(),
  /** Married or remarried: did they file one joint federal return? */
  filed_jointly: z.boolean().optional(),
  parent_filed_taxes: z.enum(["yes", "no", "not_yet"]).optional(),
  student_worked: z.boolean().optional(),
  self_employed: z.boolean().optional(),
  business_or_farm: z.boolean().optional(),
  investments: z.boolean().optional(),
  child_support: z.boolean().optional(),
  parent_no_ssn: z.boolean().optional(),
}).strict();
export type HouseholdAnswers = z.infer<typeof HouseholdAnswers>;

/** The graduating class for a student in a grade on a date (school years start in July). */
export function classOf(gradeLevel: number, today: string): number {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const yearEnd = m >= 7 ? y + 1 : y;
  return yearEnd + (12 - gradeLevel);
}

/** The FAFSA cycle this student files as a senior (or is filing now). */
export function aidCycleFor(guide: AidGuide, gradeLevel: number, today: string): AidCycle | undefined {
  const c = classOf(gradeLevel, today);
  return guide.cycles.find((x) => x.for_class_of === c);
}

/** Federal steps plus the state's own steps, in order. */
export function aidSteps(guide: AidGuide, stateSteps: AidStep[] = []): AidStep[] {
  const stage = (s: AidStep) => AID_STAGES.findIndex((x) => x.id === s.stage);
  return [...guide.steps, ...stateSteps].sort((a, b) => stage(a) - stage(b) || a.order - b.order);
}

/** Fills in {tax_year}, {cycle}, {deadline} and {corrections} placeholders. */
export function fillCycle(text: string, cycle?: AidCycle): string {
  if (!cycle) return text.replace(/\{tax_year\}/g, "the prior-prior year's").replace(/\{cycle\}/g, "next year's");
  const nice = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return text
    .replace(/\{tax_year\}/g, String(cycle.tax_year))
    .replace(/\{cycle\}/g, cycle.id)
    .replace(/\{deadline\}/g, nice(cycle.federal_deadline))
    .replace(/\{corrections\}/g, cycle.corrections_deadline ? nice(cycle.corrections_deadline) : "the corrections deadline");
}

function matches(cond: string, a: HouseholdAnswers): boolean {
  const [key, value] = cond.split("=") as [keyof HouseholdAnswers, string | undefined];
  const v = a[key];
  return value === undefined ? v === true : String(v) === value;
}

/** The documents this family needs, based on their answers. */
export function documentsFor(guide: AidGuide, answers: HouseholdAnswers, cycle?: AidCycle): AidDocument[] {
  return guide.documents
    .filter((d) => d.when.length === 0 || d.when.some((c) => matches(c, answers)))
    .map((d) => ({ ...d, text: fillCycle(d.text, cycle), hint: d.hint && fillCycle(d.hint, cycle) }));
}

/**
 * Who has to be a "contributor" on a dependent student's FAFSA, in plain words.
 * Follows StudentAid.gov's rules for dependent students; families should confirm
 * with the official "Who's my FAFSA parent?" help.
 */
export function fafsaContributors(a: HouseholdAnswers): { people: string[]; note?: string } {
  const student = "The student";
  switch (a.parents) {
    case "married":
      return a.filed_jointly === false
        ? { people: [student, "Parent 1", "Parent 2"], note: "Married parents who filed separate tax returns are both contributors." }
        : { people: [student, "One parent (either one)"], note: "Married parents who filed one joint return need only one of them as a contributor. The other parent's details are included through the joint return." };
    case "unmarried_together":
      return { people: [student, "Parent 1", "Parent 2"], note: "Parents who live together but aren't married are both contributors." };
    case "divorced_separated":
      return { people: [student, "The parent who gave more financial support in the last 12 months"], note: "If support was equal, use the parent with the higher income and assets. The other parent doesn't fill in the FAFSA (some colleges' CSS Profile still asks for them)." };
    case "remarried":
      return a.filed_jointly === false
        ? { people: [student, "The parent who gave more support", "Their spouse (stepparent)"], note: "A stepparent who filed a separate return is also a contributor." }
        : { people: [student, "The parent who gave more support"], note: "If that parent and the stepparent filed one joint return, the parent alone is the contributor, and the joint return covers the stepparent." };
    case "single_widowed":
      return { people: [student, "Your one parent"] };
    default:
      return { people: [student], note: "Answer the household questions to see who else needs to take part." };
  }
}

export interface AidProgressRow { step_id: string; status: "done" | "skipped" }

/** Counts done and skipped steps and finds the next one to do. */
export function aidProgress(steps: AidStep[], rows: AidProgressRow[]) {
  const by = new Map(rows.map((r) => [r.step_id, r.status]));
  const done = steps.filter((s) => by.get(s.id) === "done").length;
  const skipped = steps.filter((s) => by.get(s.id) === "skipped").length;
  const next = steps.find((s) => !by.has(s.id));
  return { done, skipped, total: steps.length, left: steps.length - done - skipped, next };
}

/** Problems a validator can't express in zod: unique ids and placeholders that resolve. */
export function checkAidGuide(guide: AidGuide, stateSteps: AidStep[] = []): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const s of [...guide.steps, ...stateSteps]) {
    if (seen.has(s.id)) problems.push(`duplicate aid step id ${s.id}`);
    seen.add(s.id);
  }
  const docIds = new Set<string>();
  const keys = Object.keys(HouseholdAnswers.shape);
  for (const d of guide.documents) {
    if (docIds.has(d.id)) problems.push(`duplicate document id ${d.id}`);
    docIds.add(d.id);
    for (const c of d.when) if (!keys.includes(c.split("=")[0]!)) problems.push(`document ${d.id}: unknown condition ${c}`);
  }
  for (const c of guide.cycles) {
    const [a, b] = c.id.split("-").map(Number) as [number, number];
    if ((a + 1) % 100 !== b) problems.push(`cycle ${c.id}: years don't follow each other`);
    if (c.tax_year !== a - 2) problems.push(`cycle ${c.id}: tax year should be ${a - 2}`);
    if (c.for_class_of !== a) problems.push(`cycle ${c.id}: for_class_of should be ${a}`);
  }
  return problems;
}

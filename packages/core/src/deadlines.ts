/**
 * Application deadlines that can be filled in for a family instead of typed (Constant, 2026-11-07:
 * "should this deadline not auto fill in from the database").
 *
 * The federal College Scorecard, where our college facts come from, has no application deadlines.
 * So two sources fill the date:
 *   1. the college_deadlines table: a college's own dates (month and day, since they repeat each
 *      year), kept by the team and shown as that college's date;
 *   2. the typical date for the plan type, used when the table has nothing, shown as "typical" with
 *      a nudge to check the college's site.
 * Either way the family can still change the date.
 */

/** Plan types a college list row can have, with the month/day most colleges use. */
export const TYPICAL_DEADLINES: Record<string, { month: number; day: number; label: string }> = {
  EA: { month: 11, day: 1, label: "Early Action" },
  ED: { month: 11, day: 1, label: "Early Decision" },
  REA: { month: 11, day: 1, label: "Restrictive Early Action" },
  ED2: { month: 1, day: 1, label: "Early Decision II" },
  RD: { month: 1, day: 1, label: "Regular Decision" },
  priority: { month: 12, day: 1, label: "Priority" },
  // rolling: no fixed date; left empty on purpose.
};

export interface CollegeDeadline { college_id: number; plan: string; month: number; day: number; note: string | null }

/** The next time this month/day comes around, on or after `today` (YYYY-MM-DD), as YYYY-MM-DD. */
export function nextOn(month: number, day: number, today: string): string {
  const [y] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisYear = `${y}-${pad(month)}-${pad(day)}`;
  return thisYear >= today ? thisYear : `${(y ?? 0) + 1}-${pad(month)}-${pad(day)}`;
}

export interface FilledDeadline { date: string; source: "college" | "typical"; note: string | null }

/**
 * The date to put in the Deadline box for this college and plan: the college's own date when the
 * team has it, otherwise the typical date for the plan. Null for rolling admission and unknown plans.
 */
export function fillDeadline(plan: string, known: CollegeDeadline[], today: string): FilledDeadline | null {
  const own = known.find((d) => d.plan === plan);
  if (own) return { date: nextOn(own.month, own.day, today), source: "college", note: own.note };
  const typical = TYPICAL_DEADLINES[plan];
  if (!typical) return null;
  return { date: nextOn(typical.month, typical.day, today), source: "typical", note: null };
}

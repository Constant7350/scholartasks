// Family plan price levels (Constant, 2026-11-07). One price covers every child in the
// family and is set by the OLDEST student: Explore (grades 6-8), Build (9-10), Apply (11-12).
// Each child's app still follows that child's own grade; only the price follows the oldest.
// When the oldest student's grade moves the family to another level (up when they move into
// grade 9 or 11, down when the oldest graduates or leaves the account), the family is told by
// email and on Home about 30 days before the next bill, and the new price starts only at that
// next billing date (at renewal for yearly plans). Pure functions, so the billing page,
// checkout and the daily price check all agree.

export type PlanLevel = "explore" | "build" | "apply";
export const PLAN_LEVELS: PlanLevel[] = ["explore", "build", "apply"];

/** The notice goes out when the next bill is this many days away or fewer... */
export const NOTICE_WINDOW_DAYS = 30;
/** ...but never closer than this; a later change waits for the bill after. */
export const NOTICE_MIN_DAYS = 7;

export function levelForGrade(grade: number): PlanLevel {
  if (grade <= 8) return "explore";
  if (grade <= 10) return "build";
  return "apply";
}

/** The family's level from its students' grades: the oldest student decides. Null when no student has a grade yet. */
export function familyPlanLevel(grades: readonly (number | null | undefined)[]): PlanLevel | null {
  const known = grades.filter((g): g is number => typeof g === "number" && Number.isFinite(g));
  if (known.length === 0) return null;
  return levelForGrade(Math.max(...known));
}

export function isPlanLevel(x: unknown): x is PlanLevel {
  return typeof x === "string" && (PLAN_LEVELS as string[]).includes(x);
}

const rank = (l: PlanLevel) => PLAN_LEVELS.indexOf(l);

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/** Students the Family plan price covers (Constant, 2026-11-07); each one after that is extra. */
export const INCLUDED_STUDENTS = 2;
export function extraStudents(count: number): number {
  return Math.max(0, Math.floor(count) - INCLUDED_STUDENTS);
}

/** What a family is billed for: the level and how many extra students. */
export interface Billed { level: PlanLevel; extras: number }

export interface LevelState {
  /** What the family pays for now. */
  current: Billed;
  /** What its students call for today (level null = no grades yet, keep what they have). */
  target: { level: PlanLevel | null; extras: number };
  /** Today, "YYYY-MM-DD". */
  today: string;
  /** The next billing date, "YYYY-MM-DD" (null when the plan is ending and won't bill again). */
  nextBill: string | null;
}

export type LevelStep =
  | { action: "none" }
  /** A change is coming but the next bill is too far off (or too close) for the notice yet. */
  | { action: "wait"; to: Billed }
  /** Tell the family now and switch the price for the next bill. */
  | { action: "change"; to: Billed; levelUp: boolean; levelDown: boolean; startsOn: string };

/**
 * What the daily price check should do for one family. Any change (a new level, or a student
 * added or removed beyond the two included) is told about 30 days ahead and starts at the next bill.
 */
export function levelStep(s: LevelState): LevelStep {
  if (!s.target.level || !s.nextBill) return { action: "none" };
  const to: Billed = { level: s.target.level, extras: s.target.extras };
  if (to.level === s.current.level && to.extras === s.current.extras) return { action: "none" };
  const days = daysBetween(s.today, s.nextBill);
  if (days > NOTICE_WINDOW_DAYS || days < NOTICE_MIN_DAYS) return { action: "wait", to };
  return {
    action: "change", to, startsOn: s.nextBill.slice(0, 10),
    levelUp: rank(to.level) > rank(s.current.level), levelDown: rank(to.level) < rank(s.current.level),
  };
}

/** The notice a family sees on Home and the billing page until the new price starts. */
export interface LevelNotice {
  from: PlanLevel;
  to: PlanLevel;
  /** Students on the account and how many of them are extra (beyond INCLUDED_STUDENTS). */
  students?: number;
  extras?: number;
  /** The price now, to show the difference. */
  old_cents?: number;
  /** The oldest student's first name and grade, which set the new level. */
  student: string;
  grade: number;
  cents: number;
  interval: "month" | "year";
  starts_on: string;
  sent_on: string;
}

/** Is this notice still worth showing today? */
export function noticeShowing(n: LevelNotice | null | undefined, today: string): n is LevelNotice {
  return !!n && isPlanLevel(n.to) && typeof n.starts_on === "string" && today.slice(0, 10) <= n.starts_on.slice(0, 10);
}

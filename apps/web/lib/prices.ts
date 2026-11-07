// ALL PRICES LIVE HERE. Change a number here and the Plan and billing page and Stripe
// checkout both follow (amounts are in cents). Safe to import in the browser.
//
// Family plan: three price levels, set by Constant on 2026-11-07. One price covers every child
// in the family and is set by the OLDEST student's grade (rules in @scholartasks/core plan-level):
//   Explore, grades 6-8:   $6.99 a month or $59 a year
//   Build, grades 9-10:    $9.99 a month or $79 a year
//   Apply, grades 11-12:  $12.99 a month or $99 a year
// The price covers 2 students; each extra student is $2.99 a month (Constant, 2026-11-07).
// The yearly extra ($25) was suggested but not yet confirmed by Constant.

import { extraStudents, type PlanLevel } from "@scholartasks/core";

export type FamilyItem = `family_${PlanLevel}_${"month" | "year"}`;
export type BillingItem = FamilyItem | "coach_month" | "coach_year" | "pack_100";

export interface CatalogEntry {
  name: string;
  cents: number;
  /** Subscriptions renew every month or year; packs are one-time. */
  interval: "month" | "year" | null;
  kind: "family" | "study_coach" | "pack";
  /** Family plan only: the price level. */
  level?: PlanLevel;
  credits?: number;
  /** Optional Stripe Price id from Vercel, if prices are made in the Stripe dashboard instead. */
  priceEnv: string;
}

/** The three Family plan levels, youngest first. */
export const FAMILY_LEVELS: { key: PlanLevel; grades: string; name: string; month: number; year: number }[] = [
  { key: "explore", grades: "6-8", name: "Explore", month: 699, year: 5900 },
  { key: "build", grades: "9-10", name: "Build", month: 999, year: 7900 },
  { key: "apply", grades: "11-12", name: "Apply", month: 1299, year: 9900 },
];

/** Each student after the two included, per month or year. */
export const EXTRA_STUDENT = { month: 299, year: 2500 } as const;

/** The Family plan price for this level, billing period and number of students. */
export function familyCents(level: PlanLevel, interval: "month" | "year", students: number): number {
  const l = FAMILY_LEVELS.find((x) => x.key === level)!;
  return (interval === "month" ? l.month : l.year) + extraStudents(students) * EXTRA_STUDENT[interval];
}

export function familyItem(level: PlanLevel, interval: "month" | "year"): FamilyItem {
  return `family_${level}_${interval}`;
}

const familyEntries = Object.fromEntries(
  FAMILY_LEVELS.flatMap((l) => (["month", "year"] as const).map((iv) => [
    familyItem(l.key, iv),
    {
      name: `ScholarTasks Family plan, ${l.name} (grades ${l.grades}, ${iv === "month" ? "monthly" : "yearly"})`,
      cents: iv === "month" ? l.month : l.year,
      interval: iv,
      kind: "family",
      level: l.key,
      priceEnv: `STRIPE_PRICE_FAMILY_${l.key.toUpperCase()}_${iv.toUpperCase()}`,
    } satisfies CatalogEntry,
  ])),
) as Record<FamilyItem, CatalogEntry>;

export const CATALOG: Record<BillingItem, CatalogEntry> = {
  ...familyEntries,
  // Homework Helper add-on. It took over from "Study Coach", so the item keys and
  // the subscription kind ("coach_*", "study_coach") keep their old names.
  coach_month: { name: "ScholarTasks Homework Helper add-on (monthly)", cents: 999, interval: "month", kind: "study_coach", priceEnv: "STRIPE_PRICE_COACH_MONTH" },
  coach_year: { name: "ScholarTasks Homework Helper add-on (yearly)", cents: 7900, interval: "year", kind: "study_coach", priceEnv: "STRIPE_PRICE_COACH_YEAR" },
  pack_100: { name: "ScholarTasks 100 extra AI messages", cents: 299, interval: null, kind: "pack", credits: 100, priceEnv: "STRIPE_PRICE_PACK_100" },
};

/** AI uses a day per person on the Family plan (and for everyone while PAYWALL_ON is false). */
export const FAMILY_DAILY_LIMIT = 10;
/** AI uses a day per person on the free plan, once PAYWALL_ON is true. */
export const FREE_DAILY_LIMIT = 3;
/** Homework Helper add-on: helper (and practice tutor) turns a day per student. Others use the normal daily AI uses. */
export const HOMEWORK_DAILY_LIMIT = 30;
/** Homework Helper add-on: helper turns a month for the whole family (fair use), before message packs. */
export const HOMEWORK_MONTHLY_LIMIT = 400;
/** Practice-tutor help a day with the add-on (same as the helper). */
export const STUDY_COACH_DAILY_LIMIT = HOMEWORK_DAILY_LIMIT;

/** What the free plan includes. Everything that isn't AI stays free, so no family is locked out of deadlines or aid. */
export const FREE_PLAN_INCLUDES = [
  "Georgia deadlines, college list and to-do list, with calendar and phone reminders",
  "College search and match quiz, and what each college will really cost",
  "Grades, GPA and HOPE / Zell tracking",
  "Scholarship list, FAFSA and aid checklist",
  "Activities and resume, essay writing space, study lessons and practice questions",
] as const;

/** "$12.99", "$99" */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

/**
 * Off while ScholarTasks is in beta: paid features (like the Homework Helper add-on's
 * full practice tests) are open to everyone. Turn on only after prices are set.
 */
export const PAYWALL_ON = false;

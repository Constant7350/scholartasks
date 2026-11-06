// Compare a handful of colleges side by side and rank them on what matters to
// this family: strength in the student's major, cost, finishing on time, pay
// after, debt and chance of getting in. Every score is 0-100 (higher is better),
// ranks are 1 = best among the colleges being compared, and the overall score
// uses the family's own importance for each criterion.

export type CompareKey = "major" | "cost" | "finish" | "pay" | "debt" | "fit";

/** 0 = leave out, 1 = a little, 2 = some, 3 = a lot. */
export type Importance = 0 | 1 | 2 | 3;

export const COMPARE_CRITERIA: { key: CompareKey; label: string; help: string }[] = [
  { key: "major", label: "Strength in the major", help: "How the college's program in the chosen major scores: how many students finish it, their pay after, debt and graduation rate (federal data)." },
  { key: "cost", label: "Cost for your family", help: "Our yearly price estimate for your family. Cheapest scores 100; others score lower the more they cost." },
  { key: "finish", label: "Students who graduate", help: "Share of students who finish a degree within 6 years (4-year colleges) or 3 years (2-year colleges)." },
  { key: "pay", label: "Pay after college", help: "Typical pay of former students about 10 years after starting. Highest scores 100." },
  { key: "debt", label: "Low student debt", help: "Typical federal loan debt when students leave. Lowest debt scores 100." },
  { key: "fit", label: "Chance of getting in", help: "Admission rate, adjusted by how the student's SAT compares with the college's average when both are known." },
];

export const DEFAULT_IMPORTANCE: Record<CompareKey, Importance> = { major: 3, cost: 3, finish: 2, pay: 2, debt: 1, fit: 2 };

export interface CompareItem {
  id: number;
  /** 0-100 program score in the chosen major (from rankPrograms), or null if no major picked / not offered. */
  major: number | null;
  /** Yearly cost estimate for this family. */
  cost: number | null;
  /** Graduation rate, 0-1. */
  finish: number | null;
  /** Typical pay after college. */
  pay: number | null;
  /** Typical debt. */
  debt: number | null;
  /** Admission rate, 0-1. */
  admit: number | null;
  satAvg: number | null;
}

export interface CompareRow {
  id: number;
  scores: Record<CompareKey, number | null>;
  ranks: Record<CompareKey, number | null>;
  overall: number | null;
  overallRank: number | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 1 = best; equal scores share a rank; missing scores get no rank. */
function rankOf(values: (number | null)[]): (number | null)[] {
  return values.map((v) => (v == null ? null : 1 + values.filter((x) => x != null && x > v).length));
}

export function compareColleges(items: CompareItem[], importance: Record<CompareKey, Importance>, studentSat?: number | null): CompareRow[] {
  const min = (k: "cost" | "debt") => Math.min(...items.map((i) => i[k]).filter((x): x is number => x != null && x > 0));
  const maxPay = Math.max(0, ...items.map((i) => i.pay ?? 0));
  const minCost = min("cost"), minDebt = min("debt");
  const scores = items.map((i): Record<CompareKey, number | null> => {
    let fit: number | null = i.admit == null ? null : Number(i.admit) * 100;
    if (fit != null && studentSat && i.satAvg) fit += (studentSat - i.satAvg) / 4;
    return {
      major: i.major == null ? null : clamp(i.major),
      cost: i.cost == null ? null : i.cost <= 0 ? 100 : clamp((100 * minCost) / i.cost),
      finish: i.finish == null ? null : clamp(Number(i.finish) * 100),
      pay: i.pay == null || !maxPay ? null : clamp((100 * i.pay) / maxPay),
      debt: i.debt == null ? null : i.debt <= 0 ? 100 : clamp((100 * minDebt) / i.debt),
      fit: fit == null ? null : clamp(fit),
    };
  });
  const keys = COMPARE_CRITERIA.map((c) => c.key);
  const ranks = Object.fromEntries(keys.map((k) => [k, rankOf(scores.map((s) => s[k]))])) as Record<CompareKey, (number | null)[]>;
  const overall = scores.map((s) => {
    let sum = 0, w = 0;
    for (const k of keys) {
      const v = s[k];
      if (v == null || !importance[k]) continue;
      sum += v * importance[k];
      w += importance[k];
    }
    return w ? Math.round(sum / w) : null;
  });
  const overallRanks = rankOf(overall);
  return items.map((i, n) => ({
    id: i.id,
    scores: scores[n]!,
    ranks: Object.fromEntries(keys.map((k) => [k, ranks[k][n] ?? null])) as Record<CompareKey, number | null>,
    overall: overall[n] ?? null,
    overallRank: overallRanks[n] ?? null,
  }));
}

/** "1st", "2nd", "25th" */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${n % 10 > 3 ? "th" : s}`;
}

export interface Place { at: number; of: number }

/**
 * A college's place among every college in its own state and nationwide
 * ("25th of 48 in Georgia, 410th of 1,512 nationwide"). Ties share a place;
 * colleges with no number are left out of the count.
 */
export function placeAmong(all: { id: number; state: string; value: number | null }[], id: number, higherIsBetter = true): { state: Place; nation: Place } | null {
  const me = all.find((x) => x.id === id);
  if (!me || me.value == null) return null;
  const v = me.value;
  const better = (x: number) => (higherIsBetter ? x > v : x < v);
  const known = all.filter((x): x is { id: number; state: string; value: number } => x.value != null);
  const inState = known.filter((x) => x.state === me.state);
  return {
    state: { at: 1 + inState.filter((x) => better(x.value)).length, of: inState.length },
    nation: { at: 1 + known.filter((x) => better(x.value)).length, of: known.length },
  };
}

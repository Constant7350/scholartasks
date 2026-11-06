import type { StatePack } from "./schema";
import type { ProgramResult } from "./eligibility";
import type { IncomeBand } from "./scholarships";
import { computeGpa, type CourseGrade } from "./gpa";
import { fitsSchoolType, type SchoolType } from "./faith";

/** One college from the federal College Scorecard (see supabase/seed/colleges.json). */
export interface CollegeFacts {
  id: number;
  name: string;
  state: string;
  /** 1 public, 2 private nonprofit, 3 private for-profit. */
  ownership: number;
  size: number | null;
  admitRate: number | null;
  satAvg: number | null;
  actMid: number | null;
  tuitionIn: number | null;
  tuitionOut: number | null;
  /** Yearly cost of attendance: tuition, fees, housing, food, books. */
  costOfAttendance: number | null;
  avgNetPrice: number | null;
  /** Average net price for families earning $0-30k, 30-48k, 48-75k, 75-110k, 110k+. */
  netPriceByIncome: (number | null)[];
  /** Share of degrees in each program family, 0-1. */
  programs: Record<string, number>;
  /** Scorecard religious affiliation code (see faith.ts), when the college reports one. */
  religiousAffiliation?: number | null;
}


export const INCOME_LABELS: Record<IncomeBand, string> = {
  under_30k: "under $30,000", "30_60k": "$30,000-$60,000", "60_110k": "$60,000-$110,000",
  "110_200k": "$110,000-$200,000", over_200k: "over $200,000", prefer_not: "not shared",
};

export interface CostInput {
  homeState: string;
  incomeBand: IncomeBand | null;
  /** State program results (HOPE, Zell...) for this student. */
  statePrograms: ProgramResult[];
  pack: StatePack | null;
  /** Grants and scholarships in this college's aid offer, per year (from the award letter). */
  aidOffer?: number | null;
  /** Outside scholarships won, per year, used at any college. */
  outsideAwards?: number | null;
}

export interface CostLine { label: string; amount: number }

export interface CostEstimate {
  /** Full yearly price before any aid. */
  sticker: number | null;
  /** What families at this income typically pay (federal data; includes typical grants). */
  typical: number | null;
  /** Our best yearly estimate for this family. */
  estimate: number | null;
  /** Four years at the estimate (no price increases assumed). */
  fourYears: number | null;
  lines: CostLine[];
  basis: "offer" | "typical" | "state_award" | "sticker" | "unknown";
  notes: string[];
}

const BAND_INDEX: Record<IncomeBand, number[] | null> = {
  under_30k: [0], "30_60k": [1, 2], "60_110k": [2, 3], "110_200k": [4], over_200k: null, prefer_not: null,
};

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const round100 = (n: number) => Math.round(n / 100) * 100;

/** Best state award this student has earned (or is on track for) at this college, per year. */
export function stateAwardFor(c: CollegeFacts, input: Pick<CostInput, "homeState" | "statePrograms" | "pack">): { name: string; amount: number; eligible: boolean } | null {
  if (!input.pack || c.state !== input.homeState || input.pack.state !== c.state) return null;
  let best: { name: string; amount: number; eligible: boolean } | null = null;
  for (const r of input.statePrograms) {
    const p = input.pack.programs.find((x) => x.id === r.programId);
    const est = p?.award.estimate;
    if (!est) continue;
    const amount = c.ownership === 1
      ? est.public === "tuition" ? c.tuitionIn ?? 0 : est.public ?? 0
      : c.ownership === 2 ? est.private_per_year ?? 0 : 0;
    if (!amount) continue;
    const cand = { name: r.programName, amount, eligible: r.status === "eligible" };
    // An award the student has earned beats one they're still working toward.
    if (!best || (cand.eligible && !best.eligible) || (cand.eligible === best.eligible && cand.amount > best.amount)) best = cand;
  }
  return best;
}

/**
 * A plain, explainable yearly cost estimate:
 * 1. With an aid offer from the college: full price minus the offer.
 * 2. Otherwise start from what families at this income typically pay (federal
 *    College Scorecard). If HOPE or Zell alone would make it cheaper, use that.
 * 3. Then take off outside scholarships the student has won.
 */
export function estimateCost(c: CollegeFacts, input: CostInput): CostEstimate {
  const notes: string[] = [];
  const outOfState = c.state !== input.homeState;
  const outOfStateExtra = c.ownership === 1 && outOfState && c.tuitionOut != null && c.tuitionIn != null ? Math.max(0, c.tuitionOut - c.tuitionIn) : 0;
  const sticker = c.costOfAttendance != null ? c.costOfAttendance + outOfStateExtra : null;
  if (sticker == null) {
    return { sticker: null, typical: null, estimate: null, fourYears: null, lines: [], basis: "unknown", notes: ["The federal data has no price for this college. Use the college's net price calculator."] };
  }
  const idx = input.incomeBand ? BAND_INDEX[input.incomeBand] : null;
  const typicalBase = idx ? avg(idx.map((i) => c.netPriceByIncome[i])) : null;
  const typical = typicalBase != null ? Math.min(sticker, typicalBase + outOfStateExtra) : null;
  const lines: CostLine[] = [{ label: outOfStateExtra ? "Full price (out-of-state)" : "Full price", amount: sticker }];
  let estimate: number;
  let basis: CostEstimate["basis"];

  const award = stateAwardFor(c, input);
  const outside = Math.max(0, input.outsideAwards ?? 0);

  if (input.aidOffer != null && input.aidOffer > 0) {
    estimate = sticker - input.aidOffer;
    lines.push({ label: "Grants and scholarships in the college's offer", amount: -input.aidOffer });
    basis = "offer";
  } else {
    const viaAward = award?.eligible ? sticker - award.amount : null;
    if (typical != null && (viaAward == null || typical <= viaAward)) {
      estimate = typical;
      lines.push({ label: `Typical grants for families earning ${INCOME_LABELS[input.incomeBand!]}`, amount: typical - sticker });
      basis = "typical";
    } else if (viaAward != null) {
      estimate = viaAward;
      lines.push({ label: `${award!.name} (estimated)`, amount: -award!.amount });
      basis = "state_award";
    } else {
      estimate = sticker;
      basis = "sticker";
    }
    if (award && !award.eligible) notes.push(`On track for ${award.name}? It would take off about $${round100(award.amount).toLocaleString()} a year.`);
    if (!input.incomeBand || input.incomeBand === "prefer_not") notes.push("Add your income range on the Scholarships page to see what families like yours typically pay.");
    if (input.incomeBand === "over_200k") notes.push("Families over $200,000 rarely get need-based grants; merit scholarships from the college can still lower the price.");
  }
  if (outside > 0) {
    lines.push({ label: "Outside scholarships you won", amount: -outside });
    estimate -= outside;
  }
  estimate = Math.max(0, round100(estimate));
  if (outOfState && c.ownership === 1) notes.push("Out-of-state price. The Academic Common Market can give in-state tuition for some majors.");
  return { sticker: round100(sticker), typical: typical != null ? round100(typical) : null, estimate, fourYears: estimate * 4, lines: lines.map((l) => ({ ...l, amount: round100(l.amount) })), basis, notes };
}

export type Fit = "likely" | "match" | "reach" | "unknown";

/** What the fit label is based on, so the page can say why. */
export interface FitInput { sat?: number | null; act?: number | null; gpa?: number | null; rigor?: number | null }

const STEPS: Fit[] = ["reach", "match", "likely"];

/** The high school record colleges look at: unweighted GPA (grades 9 to 12) and rigor courses. */
export function fitRecord(grades: CourseGrade[]): { gpa: number | null; rigor: number } {
  const hs = grades.filter((g) => (g.gradeLevel ?? 9) >= 9);
  const gpa = hs.length ? computeGpa(hs, { description: "Unweighted", courses: "all", grade_levels: [9, 10, 11, 12], scale: { A: 4, B: 3, C: 2, D: 1, F: 0 }, weights: [], rounding: "none" }).gpa : null;
  const rigor = new Set(hs.filter((g) => g.level === "AP" || g.level === "IB" || g.level === "DE").map((g) => g.course.toLowerCase())).size;
  return { gpa, rigor };
}

/**
 * Reach / match / likely from the college's admit rate, the student's test
 * scores against the college's average, and their unweighted GPA and number
 * of rigor courses (AP, IB, dual enrollment). A rough guide, never a percentage.
 */
export function collegeFit(c: Pick<CollegeFacts, "admitRate" | "satAvg" | "actMid">, scores: FitInput): Fit {
  const rate = c.admitRate;
  if (rate != null && rate < 0.15) return "reach";
  const gpa = typeof scores.gpa === "number" && scores.gpa > 0 ? scores.gpa : null;
  const rigor = scores.rigor ?? 0;
  // Compare on the SAT scale (rough ACT to SAT conversion).
  const actToSat = (a: number) => Math.round(400 + (a - 1) * (1200 / 35));
  const mine = scores.sat ?? (scores.act ? actToSat(scores.act) : null);
  const theirs = c.satAvg ?? (c.actMid ? actToSat(c.actMid) : null);
  let fit: Fit;
  if (mine != null && theirs != null) {
    const diff = mine - theirs;
    if (diff >= 60 && (rate == null || rate >= 0.5)) fit = "likely";
    else if (diff <= -80) fit = "reach";
    else if (rate != null && rate < 0.3) fit = "reach";
    else fit = "match";
    if (gpa == null) return fit;
    // Grades and rigor matter as much as scores: a strong record moves it up a step, a weak one down.
    const i = STEPS.indexOf(fit);
    if (gpa >= 3.8 && rigor >= 4 && i < 2 && (fit === "match" ? rate == null || rate >= 0.5 : rate == null || rate >= 0.3)) return STEPS[i + 1]!;
    if (gpa < 3.0 && i > 0) return STEPS[i - 1]!;
    return fit;
  }
  if (rate == null) return "unknown";
  if (gpa != null) {
    // No test scores (many colleges are test-optional): use grades and rigor.
    if (rate >= 0.75) return gpa >= 3.0 ? "likely" : gpa >= 2.5 ? "match" : "reach";
    if (rate >= 0.4) return gpa >= 3.7 && rigor >= 4 ? "likely" : gpa >= 3.2 ? "match" : "reach";
    return gpa >= 3.8 && rigor >= 5 ? "match" : "reach";
  }
  return rate >= 0.75 ? "likely" : rate >= 0.4 ? "match" : "reach";
}

/** Interest words used across ScholarTasks, mapped to Scorecard program families. */
export const INTEREST_PROGRAMS: Record<string, string[]> = {
  STEM: ["engineering", "computer", "mathematics", "physical_science", "biological"],
  Health: ["health", "biological"],
  Business: ["business_marketing"],
  Education: ["education"],
  Arts: ["visual_performing", "architecture"],
  Music: ["visual_performing"],
  Writing: ["english", "communication"],
  Sports: ["parks_recreation_fitness"],
  "Community service": ["public_administration_social_service", "social_science"],
  Leadership: ["business_marketing", "public_administration_social_service"],
  Government: ["social_science", "legal", "public_administration_social_service", "security_law_enforcement"],
  Trades: ["mechanic_repair_technology", "construction", "precision_production"],
  Agriculture: ["agriculture", "resources"],
  "Animals and veterinary": ["biological", "agriculture"],
  "Horses and equestrian": ["agriculture"],
  "Marine and ocean science": ["biological", "resources", "physical_science"],
};

export interface MatchAnswers {
  where: "home" | "region" | "anywhere";
  size: "small" | "medium" | "large" | "any";
  /** Public, private, Christian (private colleges with a Christian church affiliation) or any. */
  type: SchoolType;
  /** With type "christian": one church family (see CHURCH_FAMILIES), or null for any Christian college. */
  church?: string | null;
  interests: string[];
  /** Highest yearly estimate the family wants to see, or null for any. */
  budget: number | null;
}

/** Region for "nearby": the student's state plus the states that border the Southeast. */
export const SOUTHEAST = ["GA", "FL", "AL", "SC", "NC", "TN", "MS", "KY", "VA", "LA", "AR", "WV"];

export function sizeOf(n: number | null): "small" | "medium" | "large" | null {
  if (n == null) return null;
  return n < 5000 ? "small" : n < 15000 ? "medium" : "large";
}

/** Score 0-100 for how well a college fits the quiz answers; null when it is ruled out. */
export function matchScore(c: CollegeFacts, a: MatchAnswers, homeState: string, estimate: number | null): number | null {
  if (a.where === "home" && c.state !== homeState) return null;
  if (a.where === "region" && c.state !== homeState && !SOUTHEAST.includes(c.state)) return null;
  if (!fitsSchoolType(c, a.type, a.church)) return null;
  if (c.ownership === 3) return null; // for-profit colleges are left out of matches
  if (a.budget != null && estimate != null && estimate > a.budget) return null;
  let score = 50;
  const sz = sizeOf(c.size);
  if (a.size !== "any") score += sz === a.size ? 20 : -10;
  const families = [...new Set(a.interests.flatMap((i) => INTEREST_PROGRAMS[i] ?? []))];
  if (families.length) {
    const share = families.reduce((n, f) => n + (c.programs[f] ?? 0), 0);
    if (share === 0) return null;
    score += Math.min(30, Math.round(share * 100));
  }
  if (estimate != null && a.budget != null) score += Math.round(10 * (1 - estimate / Math.max(a.budget, 1)));
  return Math.max(0, Math.min(100, score));
}

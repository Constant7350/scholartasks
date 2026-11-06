// Tools that make applying faster: essay bundles (one draft for several
// similar prompts), a side-by-side look at college aid offers, and a career
// interest quiz that covers college careers and trades together.

import { CAREERS, FIELDS, type Career } from "./majors";
import { TRADE_INTERESTS, type TradeInterest } from "./trades";

// ---------- Essay bundles ----------

/** What an essay question is really asking. Prompts with the same theme can start from one draft. */
export const ESSAY_THEMES = {
  goals: "Your goals and why this field",
  challenge: "A challenge you overcame",
  service: "Community service and helping others",
  leadership: "Leadership",
  need: "Why you need the money",
  identity: "Who you are and your background",
  why_school: "Why this college",
  interest: "Something you love learning about",
  agriculture: "Farming, food and rural life",
  other: "Other questions",
} as const;
export type EssayTheme = keyof typeof ESSAY_THEMES;

/** Checked in order: the first theme with a matching word wins. */
const THEME_WORDS: [EssayTheme, RegExp][] = [
  ["need", /\b(financial need|financial situation|financial hardship|need this scholarship|pay for (your )?(college|school|education)|afford|financial circumstances)/i],
  ["why_school", /\bwhy (do you want to attend|are you interested in|this (college|university|school)|(us|our (college|university|school)))\b|\bwhy [A-Z][a-z]+ (college|university)\b/i],
  ["agriculture", /\b(agricultur|farm|rural|4-h|ffa|livestock|forestry|food (system|security|production))/i],
  ["challenge", /\b(challenge|obstacle|setback|adversity|hardship|overc[oa]me|failure|difficult time|struggle)/i],
  ["leadership", /\b(leader|leadership|led a|take the lead|in charge)/i],
  ["service", /\b(community service|volunteer|serve your community|service to|giving back|give back|make a difference in your community|helped others)/i],
  ["goals", /\b(career goal|goals|future plans|after (you )?graduat|what do you (want|plan|hope) to (study|do|become)|intended major|why (did you choose|have you chosen|are you pursuing)|educational goals|aspirations|dream job|in ten years|in 10 years)/i],
  ["identity", /\b(background|identity|heritage|culture|who you are|tell us about yourself|describe yourself|first[- ]generation|your story|family)/i],
  ["interest", /\b(lose (all )?track of time|passion|curious|captivate|engaging|interest you|excites you|love learning)/i],
];

export function essayTheme(prompt: string | null | undefined): EssayTheme {
  const p = (prompt ?? "").trim();
  if (!p) return "other";
  for (const [theme, re] of THEME_WORDS) if (re.test(p)) return theme;
  return "other";
}

/** "In 500 words or less" → 500. Ranges like "250-300 words" take the top number. */
export function wordLimitFrom(prompt: string | null | undefined): number | null {
  const m = (prompt ?? "").match(/(\d{2,4})\s*(?:-|–|to)?\s*(\d{2,4})?\s*(?:words|word)/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return n >= 25 && n <= 3000 ? n : null;
}

export const countWords = (t: string | null | undefined) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;

export interface EssayItem {
  /** Unique key, e.g. "s:<choice id>" or "e:<essay id>". */
  key: string;
  title: string;
  prompt: string | null;
  draft: string | null;
  wordLimit?: number | null;
  deadline?: string | null;
}
export interface EssayBundle { theme: EssayTheme; label: string; items: (EssayItem & { words: number; limit: number | null })[]; withDraft: number; empty: number }

/**
 * Group essays by what they ask. Only themes with two or more essays are a bundle;
 * the rest come back in `single`. Bundles with the most essays come first.
 */
export function bundleEssays(items: EssayItem[]): { bundles: EssayBundle[]; single: EssayItem[] } {
  const byTheme = new Map<EssayTheme, EssayBundle["items"]>();
  for (const it of items) {
    if (!it.prompt?.trim()) continue;
    const t = essayTheme(it.prompt);
    if (t === "other") continue;
    const list = byTheme.get(t) ?? [];
    list.push({ ...it, words: countWords(it.draft), limit: it.wordLimit ?? wordLimitFrom(it.prompt) });
    byTheme.set(t, list);
  }
  const bundles: EssayBundle[] = [];
  const inBundle = new Set<string>();
  for (const [theme, list] of byTheme) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    list.forEach((i) => inBundle.add(i.key));
    const withDraft = list.filter((i) => i.words >= 25).length;
    bundles.push({ theme, label: ESSAY_THEMES[theme], items: list, withDraft, empty: list.filter((i) => i.words === 0).length });
  }
  bundles.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  return { bundles, single: items.filter((i) => !inBundle.has(i.key)) };
}

/** Cut a draft to a word limit at a sentence end when possible, so a reused draft starts near the right length. */
export function trimToWords(text: string, limit: number | null): string {
  if (!limit) return text;
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  const cut = words.slice(0, limit).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > cut.length * 0.6 ? cut.slice(0, end + 1) : cut;
}

// ---------- Comparing aid offers ----------

/** What a college's award letter says, per year, in dollars. All optional. */
export interface AidOfferDetail {
  /** Cost of attendance in the letter (tuition, fees, housing, food, books, travel). */
  coa?: number | null;
  /** Grants and scholarships from the college, the state (HOPE, Zell) and the federal government (Pell). Free money. */
  grants?: number | null;
  /** Federal Direct Subsidized and Unsubsidized loans offered to the student. */
  student_loans?: number | null;
  /** Parent PLUS or private loans listed in the letter. */
  parent_loans?: number | null;
  /** Federal work-study (earned during the year, not taken off the bill). */
  work_study?: number | null;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

export interface OfferSummary {
  coa: number;
  free: number;
  /** Cost of attendance minus free money: what the family really pays, by savings, earnings or loans. */
  netPrice: number;
  studentLoans: number;
  parentLoans: number;
  workStudy: number;
  /** What is left after free money, loans and work-study. Paid from savings or income. */
  stillToCover: number;
  /** Student loans over four years at today's offer, a rough guide. */
  fourYearStudentDebt: number;
  /** Share of the cost covered by free money. */
  freeShare: number;
  warnings: string[];
}

/** Turns an award letter into the numbers that matter. `coaFallback` is the federal cost of attendance when the letter has none. */
export function summarizeOffer(d: AidOfferDetail, coaFallback?: number | null): OfferSummary {
  const coa = n(d.coa) || n(coaFallback);
  const free = n(d.grants);
  const studentLoans = n(d.student_loans);
  const parentLoans = n(d.parent_loans);
  const workStudy = n(d.work_study);
  const netPrice = Math.max(0, coa - free);
  const stillToCover = Math.max(0, netPrice - studentLoans - parentLoans - workStudy);
  const warnings: string[] = [];
  if (!coa) warnings.push("No cost of attendance yet. Type it from the letter so the totals are right.");
  if (parentLoans > 0) warnings.push("Parent PLUS and private loans are debt, not aid. Many letters count them as aid.");
  if (studentLoans > 9500) warnings.push("Federal student loans for a first-year student top out at $5,500 to $9,500 a year, so a bigger number probably includes private loans.");
  if (workStudy > 0) warnings.push("Work-study is paid in paychecks during the year. It does not lower the bill when it is due.");
  if (coa && free > coa) warnings.push("Free money is more than the cost. Check the numbers against the letter.");
  return { coa, free, netPrice, studentLoans, parentLoans, workStudy, stillToCover, fourYearStudentDebt: studentLoans * 4, freeShare: coa ? Math.min(1, free / coa) : 0, warnings };
}

/** Offers ranked by net price (lowest first); offers with no cost yet go last. */
export function rankOffers<T extends { summary: OfferSummary }>(offers: T[]): T[] {
  return [...offers].sort((a, b) => (a.summary.coa ? 0 : 1) - (b.summary.coa ? 0 : 1) || a.summary.netPrice - b.summary.netPrice);
}

// ---------- Career interest quiz ----------

/** Everything the quiz asks about: the trade interests plus school subjects and work styles. */
export const CAREER_INTERESTS = {
  ...TRADE_INTERESTS,
  science: "Science and how living things work",
  numbers: "Numbers, money and business",
  words: "Reading, writing and debating",
  teaching: "Teaching and explaining things",
  justice: "Rules, fairness and the law",
  leading: "Leading and organizing people",
  research: "Solving puzzles and researching",
  serving: "Serving my country, teamwork and adventure",
} as const;
export type CareerInterest = keyof typeof CAREER_INTERESTS;

/** Which interests each college-path career fits. Trades use their own tags from the trades pack. */
export const CAREER_TAGS: Partial<Record<keyof typeof CAREERS, CareerInterest[]>> = {
  vet: ["animals", "science", "people", "precise"],
  vettech: ["animals", "people", "precise"],
  zoologist: ["animals", "outdoors", "science", "water", "research"],
  geoscientist: ["outdoors", "science", "water", "research"],
  conservation: ["outdoors", "science", "animals"],
  agscientist: ["science", "outdoors", "cooking", "research"],
  farmer: ["outdoors", "animals", "machines", "leading"],
  rn: ["people", "science", "action"],
  lpn: ["people", "action"],
  np: ["people", "science", "leading"],
  doctor: ["people", "science", "precise", "action"],
  pa: ["people", "science", "precise"],
  pharmacist: ["science", "people", "precise"],
  dentist: ["people", "science", "precise", "hands"],
  hygienist: ["people", "precise", "hands"],
  pt: ["people", "science", "teaching"],
  ot: ["people", "teaching", "hands"],
  slp: ["people", "words", "teaching"],
  radtech: ["people", "machines", "precise"],
  resptherapist: ["people", "action", "science"],
  dietitian: ["cooking", "science", "people", "teaching"],
  software: ["computers", "research", "design", "numbers"],
  cyber: ["computers", "research", "justice"],
  datasci: ["computers", "numbers", "research"],
  mecheng: ["machines", "hands", "numbers", "research"],
  civileng: ["heights", "outdoors", "numbers", "leading"],
  eleceng: ["electric", "computers", "numbers"],
  chemist: ["science", "precise", "research"],
  accountant: ["numbers", "precise"],
  finance: ["numbers", "research"],
  analyst: ["numbers", "leading", "research"],
  marketing: ["design", "words", "leading", "numbers"],
  hsteacher: ["teaching", "people", "words"],
  elemteacher: ["teaching", "people"],
  lawyer: ["justice", "words", "leading"],
  paralegal: ["justice", "words", "precise"],
  psychologist: ["people", "science", "research"],
  socialworker: ["people", "justice"],
  police: ["action", "justice", "people", "driving"],
  automech: ["machines", "hands"],
  aircraftmech: ["machines", "hands", "precise"],
  electrician: ["electric", "hands", "heights"],
  pilot: ["machines", "driving", "action", "precise"],
  designer: ["design", "computers"],
};

export interface CareerMatch { key: string; career: Career; score: number; fieldId: string | null }

/** College-path careers that fit the picks, best first; ties go to the higher-paying career. */
export function matchCareers(picked: CareerInterest[], limit = 8): CareerMatch[] {
  const want = new Set(picked);
  const out: CareerMatch[] = [];
  for (const [key, tags] of Object.entries(CAREER_TAGS)) {
    const score = (tags ?? []).filter((t) => want.has(t)).length;
    const career = CAREERS[key as keyof typeof CAREERS];
    if (!score || !career) continue;
    const field = FIELDS.find((f) => (f.careers as string[]).includes(key));
    out.push({ key, career, score, fieldId: field?.id ?? null });
  }
  return out.sort((a, b) => b.score - a.score || b.career.pay - a.career.pay).slice(0, limit);
}

/** The interest keys a trade can be matched on (the quiz's extra interests never match a trade). */
export const isTradeInterest = (i: CareerInterest): i is TradeInterest => i in TRADE_INTERESTS;

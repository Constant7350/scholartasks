/**
 * Trades: skilled careers a student can train for without a four-year degree
 * (electrician, welder, LPN, lineworker...). The list lives in
 * packs/trades/trades.json as data, so the team can fix a number or add a
 * trade without touching code. Pay is Bureau of Labor Statistics May 2025
 * wage data (Georgia and US). Georgia is shown first, but every trade also
 * lists how to train in any state: the app never limits advice to one place.
 */
import { z } from "zod";

export const TRADE_CATEGORIES = {
  building: "Building and construction",
  electrical: "Electrical and energy",
  mechanics: "Mechanics and transportation",
  manufacturing: "Manufacturing and welding",
  health: "Health care",
  beauty: "Beauty and personal care",
  safety: "Public safety",
  tech: "Computers and technology",
  animals: "Animals, farms and outdoors",
  food: "Food and cooking",
} as const;
export type TradeCategory = keyof typeof TRADE_CATEGORIES;

export const PATH_KINDS = {
  college: "Technical or community college",
  apprenticeship: "Apprenticeship (paid job + classes)",
  union: "Union apprenticeship",
  school: "Private or specialty school",
  job: "Employer training on the job",
  military: "Military training",
  academy: "Academy",
} as const;

/** Interests the quiz asks about; each trade lists the ones it fits. */
export const TRADE_INTERESTS = {
  hands: "Building and fixing things with my hands",
  outdoors: "Working outdoors",
  machines: "Engines, machines and vehicles",
  electric: "Electricity and how things are wired",
  people: "Helping and caring for people",
  animals: "Animals and horses",
  computers: "Computers and technology",
  design: "Art, style and making things look good",
  heights: "Heights, big projects and teamwork",
  driving: "Driving and travel",
  precise: "Careful, precise work",
  action: "Fast-paced, emergency or action work",
  water: "The ocean, boats and water",
  cooking: "Cooking and food",
} as const;
export type TradeInterest = keyof typeof TRADE_INTERESTS;

const Money = z.number().int().positive().nullable();

export const TradePath = z.object({
  kind: z.enum(Object.keys(PATH_KINDS) as [keyof typeof PATH_KINDS, ...(keyof typeof PATH_KINDS)[]]),
  label: z.string().min(3),
  length: z.string().min(2),
  cost: z.string().min(2),
  note: z.string().optional(),
  checklist: z.string().optional(),
});
export type TradePath = z.infer<typeof TradePath>;

export const Trade = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  category: z.enum(Object.keys(TRADE_CATEGORIES) as [TradeCategory, ...TradeCategory[]]),
  summary: z.string().min(20),
  work: z.string().min(20),
  soc: z.string().regex(/^\d\d-\d{4}$/).nullable(),
  /** 4-digit CIP codes (no dot) of training programs, to find schools that teach it. */
  cips: z.array(z.string().regex(/^\d{4}$/)),
  pay: z.object({ ga_start: Money, ga_typical: Money, us_typical: Money, note: z.string().optional() }),
  outlook: z.string().optional(),
  paths: z.array(TradePath).min(1),
  license: z.object({
    needed: z.boolean(),
    georgia: z.string().min(3),
    other_states: z.string().optional(),
    url: z.string().url().optional(),
  }),
  /** On Georgia's HOPE Career Grant list: tuition covered at Georgia technical colleges with the HOPE Grant. */
  hope_career_grant: z.boolean(),
  /** Set when few Georgia programs or jobs exist: where the trade is strong instead. */
  thin_in_georgia: z.string().optional(),
  interests: z.array(z.enum(Object.keys(TRADE_INTERESTS) as [TradeInterest, ...TradeInterest[]])).min(1),
  /** Where to apply for union or employer apprenticeships, in any state. */
  finders: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  /** Related four-year majors (4-digit CIP) for students who may want a degree later. */
  related_majors: z.array(z.string().regex(/^\d{4}$/)).default([]),
  min_age: z.number().int().min(14).max(25).optional(),
  sources: z.array(z.string().url()).min(1),
});
export type Trade = z.infer<typeof Trade>;

export const ChecklistStep = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(5),
  /** Days from the day the student adds the checklist. */
  days: z.number().int().min(0).max(400),
  url: z.string().url().optional(),
  /** Georgia only (HOPE, GAfutures): left out for other states. */
  georgia: z.boolean().optional(),
});
export const ApplyChecklist = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(5),
  summary: z.string().min(10),
  steps: z.array(ChecklistStep).min(2),
});
export type ApplyChecklist = z.infer<typeof ApplyChecklist>;

export const TradesPack = z.object({
  kind: z.literal("trades"),
  version: z.string(),
  pay_source: z.string(),
  trades: z.array(Trade).min(1),
  checklists: z.array(ApplyChecklist).min(1),
});
export type TradesPack = z.infer<typeof TradesPack>;

/** Problems a person should fix in the pack: unknown checklists, duplicate slugs. */
export function checkTradesPack(p: TradesPack): string[] {
  const out: string[] = [];
  const ids = new Set(p.checklists.map((c) => c.id));
  const seen = new Set<string>();
  for (const t of p.trades) {
    if (seen.has(t.slug)) out.push(`duplicate trade ${t.slug}`);
    seen.add(t.slug);
    for (const path of t.paths) if (path.checklist && !ids.has(path.checklist)) out.push(`${t.slug}: unknown checklist ${path.checklist}`);
  }
  for (const c of p.checklists) {
    const keys = new Set<string>();
    for (const s of c.steps) {
      if (keys.has(s.key)) out.push(`checklist ${c.id}: duplicate step ${s.key}`);
      keys.add(s.key);
    }
  }
  return out;
}

/** The task id for a checklist step, so adding the same checklist twice adds nothing new. */
export const tradeTaskId = (checklist: string, step: string) => `tr:${checklist}:${step}`;
export const isTradeTaskId = (id: string | null | undefined) => !!id && id.startsWith("tr:");

/** Steps for a student's home state: Georgia-only steps (HOPE, GAfutures) only for Georgia. */
export function checklistSteps(c: ApplyChecklist, homeState: string | null | undefined) {
  return c.steps.filter((s) => !s.georgia || homeState === "GA");
}

/** Adds days to a yyyy-mm-dd date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Quiz: trades ranked by how many of the student's picked interests they fit.
 * Ties go to higher typical pay. Only trades that fit at least one interest.
 */
export function matchTrades(trades: Trade[], picked: TradeInterest[], limit = 8): { trade: Trade; score: number }[] {
  const want = new Set(picked);
  return trades
    .map((trade) => ({ trade, score: trade.interests.filter((i) => want.has(i)).length }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || (b.trade.pay.ga_typical ?? b.trade.pay.us_typical ?? 0) - (a.trade.pay.ga_typical ?? a.trade.pay.us_typical ?? 0))
    .slice(0, limit);
}

/** Short pay line for cards: "$58,320 typical in Georgia" or the US figure when Georgia has none. */
export function payLine(t: Trade): string {
  const f = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (t.pay.ga_typical) return `${f(t.pay.ga_typical)} typical in Georgia`;
  if (t.pay.us_typical) return `${f(t.pay.us_typical)} typical in the US`;
  return "Pay varies";
}

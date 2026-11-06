/**
 * Five-year outlook (2027-2031): possible revenue, profit and company value if ScholarTasks
 * becomes competitive. Every number on the page is worked out from the assumptions below,
 * so change an assumption here and the page and the shareable report follow.
 * These are planning estimates, not promises. Prices are not final.
 */

export const YEARS = [2027, 2028, 2029, 2030, 2031] as const;

/** What one family or school student brings in a year, and what it costs to serve. */
export const ASSUME = {
  familyPlanPerYear: 85,      // mix of $79/yr and $9.99/mo plans, after discounts
  homeworkPerYear: 80,        // Homework Helper add-on, $79/yr or $9.99/mo
  homeworkShare: 0.3,         // share of paying families who also buy Homework Helper
  packsPerYear: 5,            // extra AI message packs per paying family
  schoolPerStudent: 5,        // School Plus, per student per year (minimum about $1,500 a school)
  costPerPayingFamily: 24,    // AI plus card fees, about $2 a month (running cost estimate)
  costPerHomework: 30,        // AI for Homework Helper within fair use
  freePerPaying: 6,           // free families for every paying family
  costPerFreeFamily: 1.5,     // free families use 3 AI uses a day at most, most use far fewer
  costPerSchoolStudent: 1.5,  // AI for School Plus students
  teamShare: 0.25,            // people, hosting, tools, legal, insurance: share of revenue...
  teamBase: 25000,            // ...plus this much a year
  usFamilies: 15_000_000,     // US households with a child in grades 8 to 12 (about 20 million students)
};

export interface Case {
  id: "careful" | "expected" | "strong";
  name: string;
  summary: string;
  /** Paying families at the end of each year. */
  families: number[];
  /** School Plus students at the end of each year. */
  schoolStudents: number[];
  marketingShare: number;
  /** Company value as a multiple of yearly revenue at the end of the year. */
  multiple: number;
}

export const CASES: Case[] = [
  {
    id: "careful", name: "Careful",
    summary: "Grows mostly by word of mouth in the Southeast. Close to the goals already on the plan.",
    families: [300, 1200, 3500, 7000, 12000],
    schoolStudents: [0, 0, 10000, 30000, 60000],
    marketingShare: 0.15, multiple: 2,
  },
  {
    id: "expected", name: "Expected",
    summary: "The Southeast in 2027, every state in 2028, and schools buying School Plus from 2028. About 1 in 250 US families with a teen pays by 2031.",
    families: [600, 4000, 15000, 35000, 60000],
    schoolStudents: [0, 5000, 40000, 120000, 250000],
    marketingShare: 0.2, multiple: 4,
  },
  {
    id: "strong", name: "Strong",
    summary: "Becomes the app families and counselors recommend nationwide. About 1 in 100 US families with a teen pays by 2031.",
    families: [1000, 8000, 35000, 90000, 150000],
    schoolStudents: [0, 15000, 100000, 300000, 600000],
    marketingShare: 0.2, multiple: 6,
  },
];

export interface YearRow {
  year: number;
  families: number;
  schoolStudents: number;
  familyRevenue: number;
  schoolRevenue: number;
  revenue: number;
  costs: number;
  profit: number;
  /** Yearly revenue at the end of the year (what the business brings in a year from then on). */
  runRate: number;
  value: number;
}

const perPayingFamily = () => ASSUME.familyPlanPerYear + ASSUME.homeworkShare * ASSUME.homeworkPerYear + ASSUME.packsPerYear;

/** Works out each year: revenue uses the average customers during the year (start plus end, halved). */
export function project(c: Case): YearRow[] {
  let prevF = 0, prevS = 0;
  return YEARS.map((year, i) => {
    const f = c.families[i] ?? 0, s = c.schoolStudents[i] ?? 0;
    const avgF = (prevF + f) / 2, avgS = (prevS + s) / 2;
    const familyRevenue = avgF * perPayingFamily();
    const schoolRevenue = avgS * ASSUME.schoolPerStudent;
    const revenue = familyRevenue + schoolRevenue;
    const serving =
      avgF * (ASSUME.costPerPayingFamily + ASSUME.homeworkShare * ASSUME.costPerHomework) +
      avgF * ASSUME.freePerPaying * ASSUME.costPerFreeFamily +
      avgS * ASSUME.costPerSchoolStudent;
    const costs = serving + revenue * (ASSUME.teamShare + c.marketingShare) + ASSUME.teamBase;
    const runRate = f * perPayingFamily() + s * ASSUME.schoolPerStudent;
    prevF = f; prevS = s;
    return {
      year, families: f, schoolStudents: s, familyRevenue, schoolRevenue, revenue,
      costs, profit: revenue - costs, runRate, value: runRate * c.multiple,
    };
  });
}

/** Most money the business is down before it earns it back (the money to raise or put in). */
export function cashNeeded(rows: YearRow[]): number {
  let cash = 0, low = 0;
  for (const r of rows) { cash += r.profit; low = Math.min(low, cash); }
  return -low;
}

export const VALUE_NOTES = [
  "Company value here = yearly revenue at the end of 2031 times a multiple. Buyers and investors pay about 2 to 6 times yearly revenue for a growing education subscription business; family and K-12 subscription apps often sell below 5 times, and fast-growing school software for more.",
  "PowerSchool (owner of Naviance) was bought for about $5.6 billion in 2024, roughly 8 times its yearly revenue. That is the top of the range, for a company most US schools already pay.",
  "What raises the multiple: families who stay year after year, schools that renew, real profit, and data showing students won more aid. What lowers it: families who leave after senior year, high marketing costs, and dependence on one state.",
];

export const MARKET_NOTES = [
  "About 20 million US students are in grades 8 to 12 (about 15 million families). Each year about 3.5 to 3.8 million students start each high school grade.",
  "Families spend about $34,000 a year on college. A $79 to $160 a year plan that finds even one $1,000 scholarship pays for itself many times over.",
  "Schools: Georgia alone has about 700,000 students in grades 8 to 12, and US public schools about 18 million. Competitors charge schools $3.50 to $8.50 per student.",
  "Others in the field: College Board took in about $1.17 billion (2024), Khan Academy about $117 million, Common App about $66 million (FY2025). CollegeVine raised about $31 million. The money in this market is real.",
];

export const LEVERS = [
  { title: "Keep families after senior year", text: "Start in 8th grade and add college-year help (keeping HOPE and Zell, internships, transfer) so a family pays for 5 to 8 years instead of 1." },
  { title: "Schools and districts", text: "School Plus turns one yes into hundreds of students. Each 10,000 students is about $50,000 a year." },
  { title: "Homework Helper", text: "The add-on families will pay for every school year, not just during applications." },
  { title: "Open every state fast", text: "State packs are data, not new code, so national reach costs little once the playbook works." },
  { title: "Prove results", text: "Track scholarships won and aid gained per family. Proof sells to parents, schools and buyers." },
];

export const OUTLOOK_RISKS = [
  "Projections are estimates. Real numbers will come from the first year of paying families.",
  "The model pays the team out of revenue as it grows (no outside money), so early losses are small. Hiring ahead of revenue or raising money to grow faster means bigger early losses, and usually faster growth.",
  "Prices are not final; a lower family price would cut revenue but might grow families faster.",
  "Marketing could cost more than planned if word of mouth is slow.",
  "Families may leave after senior year unless the younger-grade and college-year features keep them.",
  "Big players (College Board, Naviance, Common App) could copy features; our edge is parents, Georgia and Southeast depth, trades and honest AI.",
];

export const OUTLOOK_SOURCES = [
  { label: "EdTech valuation multiples, Q4 2025", url: "https://algae-iris-yf4g.squarespace.com/news/edtech-multiples-q4-2025" },
  { label: "US public high school enrollment by grade (HolonIQ)", url: "https://index.holoniq.com/charts/HCHZQ6DCVCF0J1NO2BPL/Enrollment-in-public-high-schools-in-the-United-States-by-grade%2C-2000-2031F-(Millions-of-Students)" },
  { label: "Sallie Mae, How America Pays for College 2025", url: "https://www.salliemae.com/research/how-america-pays-for-college/" },
  { label: "Competitor comparison (revenue and funding figures)", url: "https://claude.ai/artifact/574Z5pmkKJdgmCQ6LZyEq9" },
  { label: "Running cost estimate", url: "https://claude.ai/artifact/PSSH43HTMhA21Wp7fDNWz8" },
];

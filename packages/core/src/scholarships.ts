// Scholarship matching: compares one scholarship's rules with what we know
// about a student. Anything we don't know yet makes it a "maybe" (with the
// question to answer), never a silent "no". Advice only: families should
// always confirm on the sponsor's own site.

export type IncomeBand = "under_30k" | "30_60k" | "60_110k" | "110_200k" | "over_200k" | "prefer_not";

export const INTERESTS = [
  "STEM", "Health", "Business", "Education", "Arts", "Music", "Writing",
  "Sports", "Community service", "Leadership", "Government", "Trades",
] as const;
export const GROUPS = [
  "Black or African American", "Hispanic or Latino", "American Indian or Alaska Native",
  "Asian American or Pacific Islander", "Woman", "First-generation college student",
  "Military family", "Student with a disability", "Foster care experience",
] as const;

export interface Scholarship {
  id: string;
  name: string;
  /** "GA" or another state code, or "US" for national awards. */
  scope: string;
  /** Grade levels that can apply (e.g. [12] for seniors). */
  grades: number[];
  min_gpa?: number | null;
  /** Which GPA the minimum uses. */
  gpa_kind?: "hope" | "unweighted" | "weighted" | null;
  /** Either score qualifies. */
  min_sat?: number | null;
  min_act?: number | null;
  /** Family income limit in dollars. */
  max_income?: number | null;
  need_based?: boolean | null;
  citizen_required?: boolean | null;
  /** Restricted to students with one of these interests. */
  interests?: string[] | null;
  /** Restricted to students in one of these groups. */
  groups?: string[] | null;
  college_type?: "any" | "four_year" | "technical" | null;
  /** Only for students attending this college. */
  college?: string | null;
  /** Rules that don't fit a field, in plain words (always shown as something to check). */
  other_requirements?: string | null;
  /** Deadline for the current cycle, if known (YYYY-MM-DD). */
  deadline?: string | null;
}

export interface MatchProfile {
  interests?: string[];
  groups?: string[];
  /** True once the family has answered the groups question (even with none). */
  groups_answered?: boolean;
  citizen?: "yes" | "no" | "unsure";
  plan?: "four_year" | "technical" | "unsure";
}

export interface MatchStudent {
  gradeLevel: number;
  state: string;
  hopeGpa: number | null;
  unweightedGpa: number | null;
  weightedGpa: number | null;
  sat?: number | null;
  act?: number | null;
  /** Null when unknown or hidden from the viewer. */
  incomeBand: IncomeBand | null;
  profile: MatchProfile;
  /** Names on the student's college list. */
  colleges?: string[];
}

export type MatchStatus = "match" | "maybe" | "later" | "no";
export interface MatchResult {
  status: MatchStatus;
  /** Requirements the student meets. */
  met: string[];
  /** Things to check or answer before it's a sure match. */
  unknown: string[];
  /** Requirements not met right now (what to work on). */
  missing: string[];
}

const BANDS: Record<Exclude<IncomeBand, "prefer_not">, [number, number]> = {
  under_30k: [0, 30000], "30_60k": [30000, 60000], "60_110k": [60000, 110000],
  "110_200k": [110000, 200000], over_200k: [200000, Infinity],
};
const GPA_NAME = { hope: "HOPE GPA", unweighted: "unweighted GPA", weighted: "weighted GPA" } as const;
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmt = (n: number) => n.toFixed(2).replace(/0$/, "");

export function matchScholarship(s: Scholarship, st: MatchStudent, today = new Date()): MatchResult {
  const met: string[] = [], unknown: string[] = [], missing: string[] = [];
  let later = false;
  // A "hard" miss can't be fixed by working on grades or scores (residency, group, grade already past).
  let hard = false;
  const miss = (text: string, isHard = true) => { missing.push(text); if (isHard) hard = true; };

  if (s.scope !== "US") {
    if (st.state === s.scope) met.push(`Lives in ${s.scope}`);
    else miss(`Only for ${s.scope} residents`);
  }

  if (s.grades.length) {
    const first = Math.min(...s.grades);
    if (s.grades.includes(st.gradeLevel)) met.push(gradeText(s.grades));
    else if (st.gradeLevel < first) { later = true; unknown.push(`Opens in ${ordinal(first)} grade`); }
    else miss(`For ${gradeText(s.grades).toLowerCase()}`);
  }

  if (s.min_gpa) {
    const kind = s.gpa_kind ?? "unweighted";
    const gpa = kind === "hope" ? st.hopeGpa : kind === "weighted" ? st.weightedGpa ?? st.unweightedGpa : st.unweightedGpa;
    const need = `${fmt(s.min_gpa)} ${GPA_NAME[kind]}`;
    if (gpa == null) unknown.push(`Needs a ${need}: add grades to check`);
    else if (gpa >= s.min_gpa) met.push(`${need} (you have ${fmt(gpa)})`);
    else miss(`Needs a ${need} (you have ${fmt(gpa)})`, false);
  }

  if (s.min_sat || s.min_act) {
    const want = [s.min_sat ? `${s.min_sat} SAT` : "", s.min_act ? `${s.min_act} ACT` : ""].filter(Boolean).join(" or ");
    const ok = (s.min_sat && st.sat != null && st.sat >= s.min_sat) || (s.min_act && st.act != null && st.act >= s.min_act);
    if (ok) met.push(`Test score: ${want}`);
    else if ((!s.min_sat || st.sat == null) && (!s.min_act || st.act == null)) unknown.push(`Needs ${want}: add a test score`);
    else miss(`Needs ${want}`, false);
  }

  if (s.max_income) {
    const band = st.incomeBand && st.incomeBand !== "prefer_not" ? BANDS[st.incomeBand] : null;
    const limit = `Family income up to ${money(s.max_income)}`;
    if (!band) unknown.push(`${limit}: check with a parent`);
    else if (band[1] <= s.max_income) met.push(limit);
    else if (band[0] >= s.max_income) miss(limit);
    else unknown.push(`${limit}: your range is close, check the exact limit`);
  } else if (s.need_based) {
    unknown.push("Based on financial need: the FAFSA shows if you qualify");
  }

  if (s.citizen_required) {
    if (st.profile.citizen === "yes") met.push("U.S. citizen or permanent resident");
    else if (st.profile.citizen === "no") miss("Must be a U.S. citizen or permanent resident");
    else unknown.push("Must be a U.S. citizen or permanent resident");
  }

  if (s.interests?.length) {
    const mine = st.profile.interests ?? [];
    const hit = s.interests.filter((i) => mine.includes(i));
    if (hit.length) met.push(`Interest: ${hit.join(", ")}`);
    // Interests never rule a student out: they may simply not have picked that chip.
    else unknown.push(`For students into ${s.interests.join(", ")}`);
  }

  if (s.groups?.length) {
    const mine = st.profile.groups ?? [];
    const hit = s.groups.filter((g) => mine.includes(g));
    if (hit.length) met.push(`Open to ${hit.join(", ")} students`);
    else if (!st.profile.groups_answered) unknown.push(`Open to ${s.groups.join(", ")} students`);
    else miss(`Open to ${s.groups.join(", ")} students`);
  }

  if (s.college_type && s.college_type !== "any") {
    const plan = st.profile.plan;
    const label = s.college_type === "technical" ? "Technical college programs" : "Four-year colleges";
    if (plan === s.college_type) met.push(label);
    else if (!plan || plan === "unsure") unknown.push(`${label} only`);
    else miss(`${label} only`);
  }

  if (s.college) {
    const norm = (x: string) => x.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
    const want = norm(s.college);
    const on = (st.colleges ?? []).some((c) => { const n = norm(c); return n === want || n.includes(want) || want.includes(n); });
    if (on) met.push(`${s.college} is on your college list`);
    else unknown.push(`Only for students at ${s.college}`);
  }

  if (s.other_requirements) unknown.push(s.other_requirements);

  if (s.deadline && !later && new Date(s.deadline + "T23:59:59") < today) {
    unknown.push("This year's deadline has passed: check when it opens again");
  }

  const status: MatchStatus = hard ? "no" : later ? "later" : missing.length ? "no" : unknown.length ? "maybe" : "match";
  return { status, met, unknown, missing };
}

function ordinal(n: number) { return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`; }
function gradeText(g: number[]) {
  const s = [...g].sort((a, b) => a - b);
  const lo = s[0] ?? 12, hi = s[s.length - 1] ?? 12;
  if (lo === hi) return lo === 12 ? "Seniors" : `${ordinal(lo)} graders`;
  return `Grades ${lo} to ${hi}`;
}

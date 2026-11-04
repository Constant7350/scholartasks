/** SAT and ACT practice: test sections, question picking and rough score estimates. */

export type Exam = "SAT" | "ACT";
export interface Section {
  subject: string;
  short: string;
  about: string;
  /** Questions and minutes in a ScholarTasks practice test (same time per question as the real test). */
  count: number;
  minutes: number;
  /** Questions come in sets that share a passage. */
  passages?: boolean;
  /** Not part of the total or composite (ACT Science). */
  optional?: boolean;
}

// Real-test pacing: SAT Reading and Writing 54 questions in 64 min, Math 44 in 70.
// ACT English 50 in 35, Math 45 in 50, Reading 36 in 40, Science 40 in 40.
export const BLUEPRINT: Record<Exam, Section[]> = {
  SAT: [
    { subject: "SAT Reading and Writing", short: "Reading and Writing", about: "Short passages: word choice, main ideas, evidence, grammar and transitions.", count: 16, minutes: 19 },
    { subject: "SAT Math", short: "Math", about: "Algebra, advanced math, data analysis, geometry and trig. Calculator allowed.", count: 14, minutes: 22 },
  ],
  ACT: [
    { subject: "ACT English", short: "English", about: "Grammar, punctuation and clear writing in short passages.", count: 15, minutes: 11 },
    { subject: "ACT Math", short: "Math", about: "Pre-algebra through trigonometry. Calculator allowed.", count: 12, minutes: 14 },
    { subject: "ACT Reading", short: "Reading", about: "Longer passages with several questions each.", count: 8, minutes: 9, passages: true },
    { subject: "ACT Science", short: "Science", about: "Reading tables, experiments and conflicting viewpoints.", count: 8, minutes: 8, passages: true, optional: true },
  ],
};

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/**
 * Picks about n questions at random. Questions that share a passage stay
 * together and in order, so a reading set is never split up.
 */
export function pickQuestions<T extends { passage: string | null }>(pool: T[], n: number): T[] {
  const groups = new Map<string, T[]>();
  pool.forEach((q, k) => {
    const key = q.passage && pool.filter((x) => x.passage === q.passage).length > 1 ? `p:${q.passage}` : `q:${k}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(q);
  });
  const out: T[] = [];
  for (const g of shuffle([...groups.values()])) {
    if (out.length >= n) break;
    if (out.length > 0 && out.length + g.length > n + 2) continue;
    out.push(...g);
  }
  return out;
}

/**
 * Rough section score from the share of questions right. Short practice
 * tests can't match official scaling, so the app always shows a range.
 * SAT sections: 200-800 in steps of 10. ACT sections: 1-36.
 */
export function estimate(exam: Exam, share: number): number {
  const s = Math.min(1, Math.max(0, share));
  if (exam === "SAT") return Math.round((200 + 600 * s) / 10) * 10;
  return Math.round(1 + 35 * s);
}

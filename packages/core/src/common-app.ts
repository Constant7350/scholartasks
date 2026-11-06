// "Common App ready": checks what a student already has in ScholarTasks
// against the Common App's own section limits, so pasting it in is the last,
// easy step. Counting and checking only; it never rewrites the student's words.

import { countWords } from "./application";

/** Common App limits (2026-27). Check commonapp.org each August; they rarely change. */
export const COMMON_APP = {
  activities: 10,
  honors: 5,
  position: 50,
  organization: 100,
  description: 150,
  honorTitle: 100,
  essayMin: 250,
  essayMax: 650,
  additionalInfo: 300,
  challenges: 250,
} as const;

/** The seven personal essay prompts. They have been the same for several years. */
export const COMMON_APP_PROMPTS: readonly string[] = [
  "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
  "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
  "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
  "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
  "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
  "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
  "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
];

export interface CaActivity { position: string; organization: string | null; description: string | null; grades: number[]; hours_per_week: number | null; weeks_per_year: number | null }
export interface CaHonor { position: string; grades: number[]; recognition: string | null }
export interface CaEssay { prompt: string | null; draft: string }

export type FieldIssue = { field: "position" | "organization" | "description" | "title"; length: number; limit: number };

export interface ActivityCheck { index: number; issues: FieldIssue[]; missing: string[]; ready: boolean }
export interface SectionStatus { key: string; label: string; done: number; total: number; ready: boolean; notes: string[] }

/** Characters as Common App counts them (spaces included). */
export const chars = (s: string | null | undefined) => (s ?? "").trim().length;

function over(field: FieldIssue["field"], value: string | null | undefined, limit: number): FieldIssue[] {
  const n = chars(value);
  return n > limit ? [{ field, length: n, limit }] : [];
}

/** One activity against Common App's fields: too long, or missing what the form requires. */
export function checkActivity(a: CaActivity, index: number): ActivityCheck {
  const issues = [
    ...over("position", a.position, COMMON_APP.position),
    ...over("organization", a.organization, COMMON_APP.organization),
    ...over("description", a.description, COMMON_APP.description),
  ];
  const missing: string[] = [];
  if (!chars(a.organization)) missing.push("organization name");
  if (!chars(a.description)) missing.push("description");
  if (!a.grades.length) missing.push("grades you took part");
  if (!a.hours_per_week || !a.weeks_per_year) missing.push("hours per week and weeks per year");
  return { index, issues, missing, ready: issues.length === 0 && missing.length === 0 };
}

export function checkHonor(h: CaHonor, index: number): ActivityCheck {
  const issues = over("title", h.position, COMMON_APP.honorTitle);
  const missing: string[] = [];
  if (!h.grades.length) missing.push("grade level");
  if (!h.recognition) missing.push("level of recognition");
  return { index, issues, missing, ready: issues.length === 0 && missing.length === 0 };
}

export function essayStatus(e: CaEssay | null): { words: number; hasPrompt: boolean; ready: boolean; note: string } {
  if (!e) return { words: 0, hasPrompt: false, ready: false, note: "Not started" };
  const words = countWords(e.draft);
  const hasPrompt = !!e.prompt && COMMON_APP_PROMPTS.includes(e.prompt);
  let note = `${words} of ${COMMON_APP.essayMin} to ${COMMON_APP.essayMax} words`;
  if (words > COMMON_APP.essayMax) note = `${words - COMMON_APP.essayMax} words over the ${COMMON_APP.essayMax}-word limit`;
  else if (words < COMMON_APP.essayMin) note = `${COMMON_APP.essayMin - words} more words needed (at least ${COMMON_APP.essayMin})`;
  if (!hasPrompt) note += "; pick one of the seven prompts";
  return { words, hasPrompt, ready: hasPrompt && words >= COMMON_APP.essayMin && words <= COMMON_APP.essayMax, note };
}

export interface ReadinessInput {
  profile: { highSchool: boolean; gradYear: boolean };
  hasGrades: boolean;
  hasTests: boolean;
  activities: CaActivity[];
  honors: CaHonor[];
  essay: CaEssay | null;
  supplements: { done: number; total: number };
}

/** Section by section, in Common App's own order, plus an overall percent. */
export function commonAppReadiness(input: ReadinessInput): { sections: SectionStatus[]; percent: number } {
  const acts = input.activities.slice(0, COMMON_APP.activities).map(checkActivity);
  const hons = input.honors.slice(0, COMMON_APP.honors).map(checkHonor);
  const essay = essayStatus(input.essay);
  const sections: SectionStatus[] = [
    {
      key: "education", label: "Education", total: 2,
      done: Number(input.profile.highSchool) + Number(input.profile.gradYear),
      ready: input.profile.highSchool && input.profile.gradYear, notes: [],
    },
    { key: "courses", label: "Courses and grades", total: 1, done: Number(input.hasGrades), ready: input.hasGrades, notes: [] },
    { key: "testing", label: "Testing (optional at many colleges)", total: 1, done: 1, ready: true, notes: input.hasTests ? [] : ["No scores saved. Fine if you apply test-optional."] },
    {
      key: "activities", label: "Activities", total: Math.max(1, acts.length), done: acts.filter((a) => a.ready).length,
      ready: acts.length > 0 && acts.every((a) => a.ready),
      notes: [
        ...(acts.length === 0 ? ["No activities yet."] : []),
        ...(input.activities.length > COMMON_APP.activities ? [`You have ${input.activities.length}; Common App takes the top ${COMMON_APP.activities}. Put the most important first.`] : []),
      ],
    },
    {
      key: "honors", label: "Honors (optional)", total: Math.max(1, hons.length), done: hons.length ? hons.filter((h) => h.ready).length : 1,
      ready: hons.every((h) => h.ready),
      notes: input.honors.length > COMMON_APP.honors ? [`You have ${input.honors.length}; Common App takes ${COMMON_APP.honors}. Keep the biggest.`] : [],
    },
    { key: "essay", label: "Personal essay", total: 1, done: Number(essay.ready), ready: essay.ready, notes: [essay.note] },
    {
      key: "supplements", label: "College essays (supplements)", total: Math.max(1, input.supplements.total),
      done: input.supplements.total ? input.supplements.done : 1, ready: input.supplements.done >= input.supplements.total, notes: [],
    },
  ];
  const parts = sections.map((s) => Math.min(1, s.done / s.total));
  const percent = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  return { sections, percent };
}

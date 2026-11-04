// The grade rescue check-in. Fixed questions (free, no AI) so a student can
// answer in under a minute; the answers go to the AI to draft the plan.

export interface Question { id: string; text: string; multi?: boolean; options: { v: string; label: string }[] }

export const CHECKIN: Question[] = [
  { id: "struggles", text: "What's making this class hard right now? Pick all that fit.", multi: true, options: [
    { v: "tests", label: "Tests and quizzes" },
    { v: "homework", label: "Homework or missing work" },
    { v: "understand", label: "I don't understand the material" },
    { v: "behind", label: "I fell behind and it piled up" },
    { v: "time", label: "Not enough time (sports, job, other classes)" },
    { v: "focus", label: "Hard to focus or stay motivated" },
    { v: "teacher", label: "The way it's taught doesn't click for me" },
    { v: "absent", label: "I missed school" },
  ] },
  { id: "missing", text: "Do you have missing or late assignments in this class?", options: [
    { v: "yes", label: "Yes" }, { v: "no", label: "No" }, { v: "unsure", label: "Not sure" },
  ] },
  { id: "hours", text: "How much time do you spend on this class outside school each week?", options: [
    { v: "lt1", label: "Under 1 hour" }, { v: "1to2", label: "1 to 2 hours" }, { v: "3to4", label: "3 to 4 hours" }, { v: "5plus", label: "5 hours or more" },
  ] },
  { id: "next_due", text: "When is the next test or big assignment?", options: [
    { v: "week", label: "This week" }, { v: "two_weeks", label: "In the next 2 weeks" }, { v: "later", label: "Later than that" }, { v: "unknown", label: "I don't know" },
  ] },
  { id: "talked_teacher", text: "Have you talked with the teacher about your grade?", options: [
    { v: "yes", label: "Yes" }, { v: "no", label: "Not yet" },
  ] },
  { id: "learns_best", text: "How do you learn best? Pick all that fit.", multi: true, options: [
    { v: "practice", label: "Doing practice problems" },
    { v: "videos", label: "Watching videos" },
    { v: "explain", label: "Someone explaining it to me" },
    { v: "group", label: "Studying with friends" },
    { v: "notes", label: "Notes and flashcards" },
  ] },
];

export interface Answers { struggles: string[]; missing: string; hours: string; next_due: string; talked_teacher: string; learns_best: string[]; note: string }

export const EMPTY_ANSWERS: Answers = { struggles: [], missing: "", hours: "", next_due: "", talked_teacher: "", learns_best: [], note: "" };

/** Keeps only known options, so nothing unexpected reaches the AI or the database. */
export function cleanAnswers(raw: unknown): Answers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const allowed = (id: string) => CHECKIN.find((q) => q.id === id)!.options.map((o) => o.v);
  const one = (id: string) => (typeof r[id] === "string" && allowed(id).includes(r[id] as string) ? (r[id] as string) : "unsure");
  const many = (id: string) => (Array.isArray(r[id]) ? (r[id] as unknown[]).filter((v): v is string => typeof v === "string" && allowed(id).includes(v)) : []);
  return {
    struggles: many("struggles"), missing: one("missing"), hours: one("hours"), next_due: one("next_due"),
    talked_teacher: one("talked_teacher"), learns_best: many("learns_best"),
    note: typeof r.note === "string" ? r.note.trim().slice(0, 500) : "",
  };
}

export interface RescuePlan {
  summary: string;
  likely_causes: string[];
  steps: { when: string; action: string; why: string }[];
  talk_to_teacher: string;
  parent_tip: string;
  study_tips: string[];
  check_back_days: number;
}

export interface SavedPlan { id: string | null; course: string; grade: string; plan: RescuePlan; done_steps: number[]; status: "active" | "done"; check_back: string | null; created_at: string; unsaved?: boolean }

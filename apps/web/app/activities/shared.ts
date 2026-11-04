/** Shared by the Activities page and the printable resume. */

export interface Activity {
  id: string; student_id: string; kind: "activity" | "honor"; category: string; position: string;
  organization: string | null; description: string | null; grades: number[];
  hours_per_week: number | null; weeks_per_year: number | null; recognition: string | null;
  ongoing: boolean; sort_order: number;
}

/** The Common App's own activity types, in plainer words. */
export const CATEGORIES: Record<string, string> = {
  club: "Club or organization",
  athletics: "Sport",
  arts: "Arts or music",
  work: "Job or paid work",
  community: "Volunteering or community service",
  leadership: "Student government or leadership",
  academic: "Academic (team, research, competition)",
  career: "Career-related (internship, FFA, 4-H)",
  family: "Family duties (caring for siblings, family business)",
  religious: "Religious group",
  other: "Other",
};

export const RECOGNITION: Record<string, string> = {
  school: "School", state: "State or regional", national: "National", international: "International",
};

/** Common App limits: 10 activities, 5 honors; position 50, organization 100, description 150 characters. */
export const LIMITS = { activities: 10, honors: 5, position: 50, honorTitle: 100, organization: 100, description: 150 };

export const gradeText = (g: number[]) => {
  const s = [...g].sort((a, b) => a - b);
  if (!s.length) return "";
  const runs: string[] = [];
  let start = s[0]!, prev = s[0]!;
  for (const n of [...s.slice(1), Infinity]) {
    if (n === prev + 1) { prev = n; continue; }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  }
  return `Grade${s.length > 1 ? "s" : ""} ${runs.join(", ")}`;
};

export const hoursPerYear = (a: Pick<Activity, "hours_per_week" | "weeks_per_year">) =>
  Math.round(Number(a.hours_per_week ?? 0) * Number(a.weeks_per_year ?? 0));

/** Quick, rule-based tips on a description. No AI: the student's own words stay theirs. */
export function descriptionTips(d: string): string[] {
  const t = d.trim();
  if (!t) return [];
  const tips: string[] = [];
  if (/^(i |i'm |my |was |did |helped )/i.test(t)) tips.push("Start with an action word, like Led, Built, Trained, Organized or Raised.");
  if (!/\d/.test(t)) tips.push("Add a number if you can: how many people, dollars, hours, animals or events.");
  if (/\b(very|really|a lot|lots of|various|many things|stuff)\b/i.test(t)) tips.push("Swap vague words (very, a lot, various) for specifics.");
  if (t.length > 0 && t.length < 60) tips.push("You have room for more detail: what you did and what changed because of it.");
  return tips;
}

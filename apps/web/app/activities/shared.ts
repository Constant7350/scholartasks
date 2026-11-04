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

// ---------- Beyond grades: service hours, recommenders, brag sheet ----------

export interface ServiceEntry { id: string; student_id: string; served_on: string; hours: number; organization: string; note: string | null }
export interface Recommender {
  id: string; student_id: string; name: string; role: string; subject: string | null;
  status: string; asked_on: string | null; notes: string | null;
}
export interface BragSheet { student_id: string; answers: Record<string, string>; updated_at: string }

export const REC_ROLES: Record<string, string> = {
  teacher: "Teacher", counselor: "School counselor", coach: "Coach or club sponsor", employer: "Boss or supervisor", other: "Other",
};
export const REC_STATUS: Record<string, string> = {
  thinking: "Thinking about asking", asked: "Asked", agreed: "Said yes", submitted: "Letter sent", thanked: "Thanked ✓",
};

/** Questions teachers and counselors use to write a strong letter. The student answers in their own words. */
export const BRAG_QUESTIONS: { key: string; q: string; hint: string }[] = [
  { key: "proud", q: "What are you proudest of from high school so far?", hint: "An achievement, a hard thing you finished, or someone you helped." },
  { key: "class", q: "Which class did you enjoy most, and why?", hint: "Teachers love knowing what clicked for you in their class." },
  { key: "challenge", q: "Tell about a challenge you faced and how you handled it.", hint: "A tough class, a setback, a busy season at work or at home." },
  { key: "outside", q: "What do you do outside school that people might not know about?", hint: "A job, family duties, animals, a hobby, faith or community groups." },
  { key: "future", q: "What do you want to study or do, and what got you interested?", hint: "A moment, a person or a job that sparked it." },
  { key: "words", q: "Three words that describe you, with an example for one of them.", hint: "Like: dependable (I open the barn at 6 a.m. every Saturday)." },
  { key: "know", q: "Anything a letter writer should know?", hint: "A hard year, a family situation, or a strength that doesn't show in grades. Optional." },
  { key: "stories", q: "Essay story ideas", hint: "Short notes on moments that show who you are. Only you see these unless you share them." },
];

export const isLeaderRole = (position: string, category: string) =>
  category === "leadership" ||
  /\b(captain|president|vice|officer|chair|founder|co-?founder|lead|leader|head|manager|editor|secretary|treasurer|director|organizer|coordinator|mentor|tutor|trainer|coach|supervisor)\b/i.test(position);

export interface CheckItem { key: string; ok: boolean; title: string; detail: string; link?: string }

/**
 * A plain profile check-up, no AI and no scores: the things colleges read
 * besides grades, and the next step for each. Grade-aware, so an 8th or 9th
 * grader isn't told to line up recommenders.
 */
export function checkup(grade: number, activities: Activity[], service: ServiceEntry[], recs: Recommender[], brag: BragSheet | null): CheckItem[] {
  const acts = activities.filter((a) => a.kind === "activity");
  const longest = acts.reduce((n, a) => Math.max(n, a.grades.length), 0);
  const leader = acts.find((a) => isLeaderRole(a.position, a.category));
  const work = acts.find((a) => a.category === "work" || a.category === "family");
  const serviceHours = service.reduce((n, s) => n + Number(s.hours), 0);
  const serviceAct = acts.some((a) => a.category === "community");
  const yes = recs.filter((r) => ["agreed", "submitted", "thanked"].includes(r.status)).length;
  const answered = brag ? Object.values(brag.answers).filter((v) => v.trim().length > 20).length : 0;
  const items: CheckItem[] = [];

  items.push(acts.length >= 3
    ? { key: "count", ok: true, title: `${acts.length} activities listed`, detail: "Colleges like 3 to 5 activities done well more than a long list. Keep your most important one first." }
    : { key: "count", ok: false, title: acts.length ? `${acts.length} activit${acts.length === 1 ? "y" : "ies"} listed` : "No activities yet", detail: "Add clubs, sports, jobs, volunteering and family duties. Most strong applicants have 3 to 5 they really care about.", link: "#activities" });
  if (grade >= 10)
    items.push(longest >= 2
      ? { key: "depth", ok: true, title: `Stuck with something for ${longest} years`, detail: "Staying with an activity shows commitment, which UGA calls depth over breadth." }
      : { key: "depth", ok: false, title: "Show staying power", detail: "Mark every grade you've done each activity. Keep going with the ones you care about most.", link: "#activities" });
  if (grade >= 10)
    items.push(leader
      ? { key: "lead", ok: true, title: `Leadership: ${leader.position}`, detail: "Write what changed because you led, with a number if you can." }
      : { key: "lead", ok: false, title: "No leadership role yet", detail: grade >= 12 ? "Leading doesn't need a title. Training new people at work, running a project or teaching others counts. Say so in your descriptions." : "Ask for a role in a club, team or job: officer, captain, project lead, or training new people.", link: "#activities" });
  items.push(serviceHours > 0 || serviceAct
    ? { key: "service", ok: true, title: serviceHours ? `${serviceHours.toLocaleString()} service hours logged` : "Service on your list", detail: "Steady service with one cause reads better than many one-day events." }
    : { key: "service", ok: false, title: "No service hours yet", detail: "Pick one cause you care about and log each shift below. Colleges and many scholarships look for it.", link: "#service" });
  if (grade >= 9)
    items.push(work
      ? { key: "work", ok: true, title: `${work.category === "work" ? "Job" : "Family duty"}: ${work.position}`, detail: "Jobs and family duties count. UGA and Georgia Tech both say so." }
      : { key: "work", ok: false, title: "Jobs and family duties count too", detail: "If you work, care for siblings or help a family business, add it as an activity with hours.", link: "#activities" });
  if (grade >= 11)
    items.push(yes >= 2
      ? { key: "recs", ok: true, title: `${yes} recommenders said yes`, detail: "Send each one your brag sheet and your deadlines, then thank them." }
      : { key: "recs", ok: false, title: `${yes ? `${yes} recommender said yes` : "No recommenders yet"}`, detail: "Pick two core-class teachers who know you well and ask them in person.", link: "#recs" });
  if (grade >= 10)
    items.push(answered >= 5
      ? { key: "brag", ok: true, title: "Brag sheet ready", detail: "Give it to your letter writers and use it for essay ideas." }
      : { key: "brag", ok: false, title: answered ? `Brag sheet: ${answered} of ${BRAG_QUESTIONS.length - 1} answered` : "Brag sheet not started", detail: "A few honest answers help teachers write a better letter, and give you essay ideas.", link: "#brag" });
  return items;
}

/**
 * "Beyond grades" milestones: the things colleges weigh besides GPA and test
 * scores (activities, roles, service, recommendations, essays), as one short
 * list per school year. The To-do page adds the current grade's list to each
 * student's to-do list once; students can tick them off or set them aside.
 *
 * Sources: UGA Common Data Set 2024-25 (C7) and first-year review criteria,
 * Georgia Tech "Contribution to Community", NACAC Factors in the Admission
 * Decision (fall 2023). Research: https://claude.ai/artifact/37qkdhay89fYkxRwSz5q4D
 */

export interface Milestone {
  key: string;
  title: string;
  /** Month and day in the school year (Aug-Jul), e.g. "09-30". */
  due: string;
  /** Where in ScholarTasks to do it. */
  link?: string;
}

const SUMMER: Milestone = { key: "summer", title: "Make a summer plan: a job, program, camp or volunteering", due: "04-15", link: "/activities" };

export const MILESTONES: Record<number, Milestone[]> = {
  6: [
    { key: "habits", title: "Pick one study habit to practice this fall (a planner, a homework spot, or 20 minutes of reading)", due: "09-30", link: "/study" },
    { key: "quiz6", title: "Take the career interest quiz together and talk about two careers that sound fun", due: "11-15", link: "/career-quiz" },
    { key: "try6", title: "Try a club, sport, instrument or volunteer project", due: "02-15", link: "/activities" },
  ],
  7: [
    { key: "habits7", title: "Learn how to study for a test: a study lesson and a few practice questions", due: "10-15", link: "/study" },
    { key: "quiz7", title: "Retake the career interest quiz and look up one college or trade path for a career you like", due: "12-15", link: "/career-quiz" },
    { key: "math8", title: "Ask the school about 8th grade math (some students take Algebra in 8th grade)", due: "03-01", link: "/grades" },
  ],
  8: [
    { key: "explore", title: "Try two or three clubs, sports or activities to see what you enjoy", due: "10-15", link: "/activities" },
    { key: "plan9", title: "Plan 9th grade classes with your counselor, with honors where you can keep strong grades", due: "03-01", link: "/grades" },
  ],
  9: [
    { key: "quiz9", title: "Take the career interest quiz, save the results, and pick high school classes that match", due: "10-31", link: "/career-quiz" },
    { key: "join", title: "Join 2 to 4 activities you can stick with for years (club, sport, service or job)", due: "09-30", link: "/activities" },
    { key: "log", title: "Start your service hours log and add every volunteer shift", due: "10-15", link: "/activities#service" },
    { key: "list", title: "Add your activities to ScholarTasks with hours per week", due: "11-15", link: "/activities" },
    SUMMER,
  ],
  10: [
    { key: "deeper", title: "Keep the activities you care about most and go deeper in them", due: "09-30", link: "/activities" },
    { key: "role", title: "Take on a responsibility: a committee, a project or a team role", due: "12-15", link: "/activities" },
    { key: "stories", title: "Start your brag sheet and jot down essay story ideas", due: "02-15", link: "/activities#brag" },
    { key: "hours", title: "Bring your service hours log up to date", due: "05-15", link: "/activities#service" },
    SUMMER,
  ],
  11: [
    { key: "quiz11", title: "Retake the career interest quiz (new questions) and check your college list or trade plan still fits", due: "09-30", link: "/career-quiz" },
    { key: "lead", title: "Run for or ask for a leadership role, or lead one project start to finish", due: "10-15", link: "/activities" },
    { key: "pick", title: "Pick two core-class teachers who know you well to write recommendation letters", due: "01-31", link: "/activities#recs" },
    { key: "brag", title: "Finish your brag sheet for your recommenders", due: "03-31", link: "/activities#brag" },
    { key: "ask", title: "Ask your teachers for recommendation letters and give them your brag sheet", due: "04-30", link: "/activities#recs" },
    { key: "visits", title: "Visit colleges and check what each one weighs besides grades", due: "04-15", link: "/colleges" },
    { key: "essay", title: "Draft your Common App essay this summer", due: "07-31", link: "/essays" },
  ],
  12: [
    { key: "confirm", title: "Confirm your recommenders and send them your brag sheet and deadlines", due: "09-15", link: "/activities#recs" },
    { key: "polish", title: "Polish your top 10 activity descriptions for the Common App", due: "09-30", link: "/activities" },
    { key: "resume", title: "Print your resume for colleges and scholarships that take one", due: "10-01", link: "/activities/resume" },
    { key: "thank", title: "Thank your recommenders and tell them where you got in", due: "04-15", link: "/activities#recs" },
  ],
};

export const milestoneId = (grade: number, key: string) => `bg:${grade}:${key}`;
export const isMilestoneId = (id: string | null | undefined) => !!id && id.startsWith("bg:");

/** The list for a grade. Grades 6 and 7 get the 8th grade list. */
export const milestonesFor = (grade: number) => MILESTONES[Math.max(6, Math.min(12, grade))] ?? [];

/** Looks up a milestone (for its link) from a task's deadline_id. */
export function milestoneById(id: string | null | undefined): Milestone | undefined {
  if (!isMilestoneId(id)) return undefined;
  const [, g, key] = id!.split(":");
  return MILESTONES[Number(g)]?.find((m) => m.key === key);
}

/**
 * The due date for a milestone this school year. The school year starts in
 * August, so "09-30" is this fall and "04-15" is next spring. A date that has
 * already passed moves to two weeks from today, so nothing lands as late.
 */
export function milestoneDue(due: string, today: string): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const start = m >= 8 ? y : y - 1;
  const month = Number(due.slice(0, 2));
  const date = `${month >= 8 ? start : start + 1}-${due}`;
  if (date >= today) return date;
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString().slice(0, 10);
}

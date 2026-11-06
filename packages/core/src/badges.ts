/** Weekly streaks and badges, worked out from what the student has done. */

export interface ProgressFacts {
  /** Days with progress, YYYY-MM-DD. */
  days: string[];
  collegesOnList: number;
  collegesSubmitted: number;
  scholarshipsSaved: number;
  activities: number;
  essaysFinished: number;
  coursesEntered: number;
  practiceAnswered: number;
  aidStepsDone: number;
  lessonsDone: number;
}

export interface Badge { id: string; icon: string; name: string; how: string; earned: boolean; progress?: string }

/** Monday of the week holding this date, as YYYY-MM-DD. */
export function weekOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
const addWeeks = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
};

/**
 * Weeks in a row with progress, counting back from this week. A week with no
 * progress yet doesn't break the streak until it's over, so Monday isn't scary.
 */
export function weeklyStreak(days: string[], today: string): { current: number; best: number; thisWeek: boolean } {
  const weeks = new Set(days.map(weekOf));
  const now = weekOf(today);
  const thisWeek = weeks.has(now);
  let current = 0;
  for (let w = thisWeek ? now : addWeeks(now, -1); weeks.has(w); w = addWeeks(w, -1)) current++;
  let best = 0;
  const sorted = [...weeks].sort();
  let run = 0;
  let prev: string | null = null;
  for (const w of sorted) {
    run = prev && addWeeks(prev, 1) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return { current, best: Math.max(best, current), thisWeek };
}

export function badges(f: ProgressFacts, today: string): Badge[] {
  const s = weeklyStreak(f.days, today);
  const step = (have: number, need: number) => (have >= need ? undefined : `${have} of ${need}`);
  const list: Badge[] = [];
  const add = (id: string, icon: string, name: string, how: string, earned: boolean, progress?: string) =>
    list.push({ id, icon, name, how, earned, progress: earned ? undefined : progress });
  add("first-step", "🌱", "First step", "Get one thing done in ScholarTasks.", f.days.length > 0);
  add("streak-3", "🔥", "On a roll", "Make progress 3 weeks in a row.", s.best >= 3, step(s.current, 3));
  add("streak-8", "🚀", "Unstoppable", "Make progress 8 weeks in a row.", s.best >= 8, step(s.current, 8));
  add("grades", "🎓", "Grades up to date", "Enter 4 or more courses and grades.", f.coursesEntered >= 4, step(f.coursesEntered, 4));
  add("resume", "🏅", "Resume ready", "Add 3 or more activities or awards.", f.activities >= 3, step(f.activities, 3));
  add("list", "🗂️", "College list builder", "Put 5 colleges on your list.", f.collegesOnList >= 5, step(f.collegesOnList, 5));
  add("hunter", "💰", "Scholarship hunter", "Save 5 scholarships to apply for.", f.scholarshipsSaved >= 5, step(f.scholarshipsSaved, 5));
  add("practice", "✏️", "Practice pays off", "Answer 50 practice questions.", f.practiceAnswered >= 50, step(f.practiceAnswered, 50));
  add("learner", "📚", "Study skills", "Finish 3 study lessons.", f.lessonsDone >= 3, step(f.lessonsDone, 3));
  add("essay", "✍️", "Essay done", "Finish a college essay.", f.essaysFinished >= 1);
  add("aid", "🧾", "Aid on track", "Check off 5 FAFSA and aid steps.", f.aidStepsDone >= 5, step(f.aidStepsDone, 5));
  add("applied", "📬", "Applied!", "Submit your first college application.", f.collegesSubmitted >= 1);
  return list;
}

// Words and lists for the "Social media" tab on /admin/marketing (team only).
// The weekly AI writer (social-writer.ts) uses the same topics and networks.

export const NETWORKS = {
  tiktok: { label: "TikTok", kind: "video", open: "https://www.tiktok.com/tiktokstudio/upload" },
  reels: { label: "Instagram Reels", kind: "video", open: "https://www.instagram.com/" },
  shorts: { label: "YouTube Shorts", kind: "video", open: "https://studio.youtube.com/" },
  facebook: { label: "Facebook", kind: "post", open: "https://www.facebook.com/" },
  instagram: { label: "Instagram", kind: "post", open: "https://www.instagram.com/" },
  x: { label: "X", kind: "post", open: "https://x.com/compose/post" },
  threads: { label: "Threads", kind: "post", open: "https://www.threads.net/" },
  linkedin: { label: "LinkedIn", kind: "post", open: "https://www.linkedin.com/feed/" },
  nextdoor: { label: "Nextdoor", kind: "post", open: "https://nextdoor.com/news_feed/" },
} as const;
export type Network = keyof typeof NETWORKS;
export const POST_NETWORKS = ["facebook", "instagram", "x", "threads", "linkedin", "nextdoor"] as const satisfies readonly Network[];

/**
 * Topics the writer picks from. `months` are the months (1-12) when the topic matters most;
 * an empty list means any time. The writer skips topics used in the last six weeks.
 */
export interface Topic { id: string; label: string; months: number[]; angle: string; page: string }
export const TOPICS: Topic[] = [
  { id: "fafsa-open", label: "The FAFSA is open", months: [10, 11, 12, 1, 2], angle: "File early; what you need before you start (FSA ID for student and parent, tax info); never pay to file.", page: "/aid" },
  { id: "hope-vs-zell", label: "HOPE vs Zell Miller", months: [8, 9, 10, 11, 12, 1, 2, 3], angle: "The difference between Georgia's HOPE and Zell Miller Scholarships, and why the HOPE GPA is not the same as the school GPA.", page: "/grades" },
  { id: "hope-gpa", label: "Your HOPE GPA is different", months: [], angle: "Only core classes count and grades are recalculated, so check the HOPE GPA early (grades 9 to 11).", page: "/grades" },
  { id: "local-scholarships", label: "Local scholarships get fewer applicants", months: [12, 1, 2, 3, 4], angle: "Community foundations, clubs and employers; smaller awards add up and fewer people apply.", page: "/scholarships" },
  { id: "scholarship-myths", label: "Scholarship myths", months: [], angle: "You don't need straight A's; you don't have to be a top athlete; never pay a fee to apply.", page: "/scholarships" },
  { id: "essay-reuse", label: "Write one essay, reuse it many times", months: [9, 10, 11, 12, 1, 2], angle: "Most scholarship prompts ask the same few questions; keep a bundle of essays you adapt.", page: "/scholarships" },
  { id: "early-action", label: "Early action vs early decision", months: [8, 9, 10], angle: "What each one means, which one is binding, and the dates to watch.", page: "/colleges" },
  { id: "college-list", label: "Build a balanced college list", months: [3, 4, 5, 6, 7, 8, 9], angle: "Reach, match and likely schools, and comparing real cost after aid.", page: "/colleges/compare" },
  { id: "aid-offers", label: "Read your aid offer", months: [3, 4], angle: "Free money vs loans vs work-study; compare offers side by side before May 1.", page: "/colleges" },
  { id: "may-1", label: "May 1 decision day", months: [4], angle: "Deposit deadline; double-check housing and orientation steps.", page: "/todo" },
  { id: "sat-act", label: "SAT or ACT: short daily practice", months: [1, 2, 3, 4, 5, 8, 9, 10], angle: "Ten minutes a day beats one cram session; take a full practice test first to see where you stand.", page: "/test-prep" },
  { id: "grade-rescue", label: "Rescue a slipping grade", months: [9, 10, 11, 2, 3, 4], angle: "Talk to the teacher early, find the missing work, and make a two-week plan.", page: "/grades" },
  { id: "study-habits", label: "Study habits that work", months: [8, 9, 1], angle: "Spaced practice, self-testing and short focused sessions instead of rereading.", page: "/study" },
  { id: "activities", label: "Activities that count", months: [], angle: "Jobs, caring for family and farm work count as activities too; keep a running list.", page: "/activities" },
  { id: "common-app", label: "Common App activities list", months: [7, 8, 9, 10, 11], angle: "150 characters per activity; lead with what you did and the result.", page: "/activities/common-app" },
  { id: "trades", label: "Trades and technical college", months: [], angle: "Good-paying trade careers, apprenticeships, and Georgia's HOPE Grant for technical college.", page: "/trades" },
  { id: "majors", label: "Pick a major by what you enjoy", months: [], angle: "Try the career quiz, then look at majors, careers and pay.", page: "/career-quiz" },
  { id: "weekend-jobs", label: "Weekend and summer jobs", months: [3, 4, 5, 10, 11], angle: "A job builds a resume and a reference letter; parents stay in the loop.", page: "/jobs" },
  { id: "junior-year", label: "Junior year checklist", months: [8, 9, 1, 2], angle: "The grades and tests that matter most, and when to start the college list.", page: "/todo" },
  { id: "middle-school", label: "Start in 8th grade", months: [5, 6, 7, 8], angle: "Course choices in 8th and 9th grade shape the HOPE GPA and rigor later.", page: "/grades" },
  { id: "parents-role", label: "For parents: how to help without nagging", months: [], angle: "Shared checklists and reminders so parents see progress without asking every day.", page: "/home" },
  { id: "deadlines", label: "Never miss a deadline", months: [], angle: "One calendar for applications, scholarships and aid, with reminders.", page: "/todo" },
  { id: "homework-help", label: "Homework help that teaches", months: [8, 9, 10, 11, 1, 2, 3, 4], angle: "A tutor that asks questions and builds reasoning, never just hands over answers.", page: "/homework" },
  { id: "counselor", label: "Ask the AI counselor", months: [], angle: "Quick answers on HOPE, FAFSA and admissions any time; the family still decides.", page: "/counselor" },
];

/** The topics for a week: in season first, not used in the last six weeks, rotating by week. */
export function topicsFor(weekOf: string, count: number, recentlyUsed: string[]): Topic[] {
  const month = Number(weekOf.slice(5, 7));
  const week = Math.floor(new Date(`${weekOf}T12:00:00Z`).getTime() / (7 * 24 * 3600 * 1000));
  const fresh = TOPICS.filter((t) => !recentlyUsed.includes(t.id));
  const pool = fresh.length >= count ? fresh : TOPICS;
  const inSeason = pool.filter((t) => t.months.includes(month));
  const anyTime = pool.filter((t) => !t.months.includes(month));
  const rot = <T,>(xs: T[]) => (xs.length ? xs.map((_, i) => xs[(i + week) % xs.length]!) : xs);
  return [...rot(inSeason), ...rot(anyTime)].slice(0, Math.max(1, count));
}

/** Monday of the week (America/New_York) for a date, as YYYY-MM-DD. */
export function mondayOf(d: Date, addWeeks = 0): string {
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = (ny.getDay() + 6) % 7;
  ny.setDate(ny.getDate() - day + addWeeks * 7);
  return `${ny.getFullYear()}-${String(ny.getMonth() + 1).padStart(2, "0")}-${String(ny.getDate()).padStart(2, "0")}`;
}

/** Tips shown on the tab. */
export const SOCIAL_TIPS = [
  "Short videos (TikTok, Reels, Shorts) are the best free way to reach students. Aim for 2 or 3 a week, 20 to 45 seconds each, with the hook in the first two seconds.",
  "Every script can be filmed by any student with just a phone held upright, by a window, in a quiet room. With the team's camera and DJI mic, follow the \"BETTER GEAR\" line in the shot notes: clip the mic 6 to 8 inches below the chin and record a few seconds of silence first.",
  "Post the same video on TikTok, Instagram Reels and YouTube Shorts. Download it without the TikTok watermark first (save the original from your phone).",
  "Written posts are for parents: Facebook, Nextdoor and local parent groups. Paid ads, when we start them, go to parents on Facebook and Instagram, not to teens.",
  "Every draft is written by AI and must be read by a person before it goes out. Check every fact against the official site (GAfutures.org, StudentAid.gov).",
  "Never show a student's name, school, town or workplace. Say \"our team\", and never use the word \"sponsor\".",
  "A student under 18 can be in a video only after a parent agrees in writing. Add them under People on camera with the parent's name and the date.",
];

/** A short permission note a parent can sign. Not legal advice; our lawyer should look it over. */
export const CONSENT_TEMPLATE = `Permission to appear in ScholarTasks videos

I am the parent or legal guardian of ____________________ (student).
I agree that my student may appear in short videos and photos that ScholarTasks posts on social media (such as TikTok, Instagram, YouTube and Facebook) to help families with college planning.

I understand that:
- My student's last name, school, town and workplace will not be shown or said.
- ScholarTasks will show me each video before it is posted if I ask.
- I can take back this permission at any time by emailing support@scholartasks.com. New videos will stop, and ScholarTasks will remove posted videos with my student within 7 days.
- No payment is made for appearing in the videos.

Parent or guardian name: ____________________
Signature: ____________________   Date: ____________
Student signature (if 13 or older): ____________________`;

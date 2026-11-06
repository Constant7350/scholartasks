// The ScholarTasks Essay Challenge: shared types, the game steps, the scoring guide and
// the official rules. Database: migration 0057 (database update 59).

export interface Prize { place: number; label: string; kind: "cash" | "scholarship" | "gift_card" | "certificate"; amount: number }

export interface Challenge {
  id: string; title: string; subject: string; prompt: string; tips: string | null;
  grade_min: number; grade_max: number; min_words: number; max_words: number;
  opens_at: string; closes_at: string; results_on: string | null; prizes: Prize[];
  status: "draft" | "open" | "judging" | "done";
}

export interface Entry {
  id: string; challenge_id: string; student_id: string; title: string | null; ideas: string | null; outline: string | null;
  body: string; words: number; checklist: Record<string, boolean>; active_seconds: number; writing_days: number;
  saves: number; paste_blocked: number; coach_checks: number; team_family: boolean;
  status: "draft" | "submitted" | "withdrawn"; submitted_at: string | null; result: "finisher" | "finalist" | "winner" | null;
  place: number | null; certificate_code: string | null; claimed_at: string | null; updated_at: string;
}

export const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export const grades = (c: Pick<Challenge, "grade_min" | "grade_max">) =>
  c.grade_min === c.grade_max ? `Grade ${c.grade_min}` : `Grades ${c.grade_min} to ${c.grade_max}`;

export const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

export const money = (n: number) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function prizeText(p: Prize): string {
  if (p.kind === "certificate" || !p.amount) return `${p.label}: winner's certificate`;
  if (p.kind === "scholarship") return `${p.label}: ${money(p.amount)} scholarship, paid to the college`;
  if (p.kind === "gift_card") return `${p.label}: ${money(p.amount)} gift card`;
  return `${p.label}: ${money(p.amount)} cash prize`;
}

/** The proofread list a student ticks before sending the essay in. */
export const POLISH = [
  { key: "answers", label: "My essay answers the topic." },
  { key: "own", label: "Every word is my own (no copying, no AI writing)." },
  { key: "aloud", label: "I read it out loud once and fixed what sounded wrong." },
  { key: "spelling", label: "I checked spelling, names and capital letters." },
  { key: "ending", label: "It has a clear ending." },
] as const;

/** The game: each step earns points and a badge. Points add up to levels. */
export interface Step { key: string; badge: string; icon: string; label: string; hint: string; points: number; done: boolean }

export function steps(c: Challenge, e: Entry | null, permission: boolean): Step[] {
  const ideas = (e?.ideas ?? "").split("\n").map((s) => s.trim()).filter((s) => s.length > 2).length;
  const outlineWords = countWords(e?.outline ?? "");
  const polished = POLISH.every((p) => e?.checklist?.[p.key]);
  return [
    { key: "read", badge: "Ready", icon: "📖", label: "Read the topic and the rules", hint: "Tick the box under the topic.", points: 10, done: !!e?.checklist?.read },
    { key: "ideas", badge: "Idea finder", icon: "💡", label: "Write down 3 ideas", hint: "One idea on each line. Short is fine.", points: 20, done: ideas >= 3 },
    { key: "plan", badge: "Planner", icon: "🗺️", label: "Plan it: beginning, middle, end", hint: "A few words for each part.", points: 20, done: outlineWords >= 15 },
    { key: "draft", badge: "Writer", icon: "✍️", label: `Write a first draft (${c.min_words}+ words)`, hint: "Don't worry about perfect. Just get it down.", points: 40, done: (e?.words ?? 0) >= c.min_words },
    { key: "comeback", badge: "Comeback", icon: "🔁", label: "Come back on another day and improve it", hint: "Fresh eyes find the best fixes.", points: 20, done: (e?.writing_days ?? 0) >= 2 },
    { key: "coach", badge: "Coached", icon: "🧑‍🏫", label: "Ask the coach for feedback", hint: "The coach gives tips. It never writes for you.", points: 20, done: (e?.coach_checks ?? 0) >= 1 },
    { key: "polish", badge: "Polisher", icon: "✨", label: "Polish it with the checklist", hint: "Tick every line when it's true.", points: 20, done: polished },
    { key: "permission", badge: "Family OK", icon: "✍️", label: "A parent signs permission", hint: "Your parent signs in their own ScholarTasks login.", points: 10, done: permission },
    { key: "submit", badge: "Finisher", icon: "🏁", label: "Send it in", hint: "Then claim your certificate.", points: 50, done: e?.status === "submitted" },
  ];
}

export const LEVELS = [
  { min: 0, name: "Rookie" },
  { min: 50, name: "Writer" },
  { min: 110, name: "Author" },
  { min: 160, name: "Pro" },
  { min: 210, name: "Champion" },
];
export function level(points: number) {
  let i = 0;
  LEVELS.forEach((l, n) => { if (points >= l.min) i = n; });
  return { name: LEVELS[i]!.name, next: LEVELS[i + 1] ?? null };
}

/** The scoring guide judges use (100 points). Same weights as challenge_points() in the database. */
export const RUBRIC = [
  { key: "prompt", label: "Answers the topic", weight: 25 },
  { key: "voice", label: "Own voice and real examples", weight: 25 },
  { key: "ideas", label: "Ideas and thinking", weight: 20 },
  { key: "organization", label: "Clear beginning, middle and end", weight: 15 },
  { key: "mechanics", label: "Spelling, grammar and word choice", weight: 15 },
] as const;

export const RULES_VERSION = "challenge-rules-2026-11-06";

/** The words a parent signs. */
export const permissionWording = (student: string, c: Challenge, publicOk: boolean) =>
  `I am ${student}'s parent or legal guardian. I give permission for ${student} to enter the ScholarTasks "${c.title}" essay challenge, and I have read the official rules (scholartasks.com/challenge/rules?id=${c.id}).\n` +
  `I understand: ${student} must write the essay in the ScholarTasks app in their own words; the essay is read only by our review team; if ${student} wins, a cash prize is paid to me as parent or guardian and may count as taxable income; and I may be asked for a tax form before a larger prize is paid.\n` +
  (publicOk
    ? `If ${student} wins, ScholarTasks may share ${student}'s first name, grade and state with the result. Never the essay, last name, school or photo without asking me again.`
    : `If ${student} wins, ScholarTasks will not share ${student}'s name in public.`);

/** The official rules, built from the challenge's own settings. */
export function rulesFor(c: Challenge): { title: string; lines: string[] }[] {
  const cash = c.prizes.filter((p) => p.kind !== "certificate" && p.amount > 0);
  return [
    { title: "Who can enter", lines: [
      `${grades(c)} students who live in the United States and have a ScholarTasks student account. A free account is enough. No purchase or paid plan is needed, and paying does not improve the chance of winning.`,
      "Students under 18 need a parent or guardian to sign permission in the app. Students 18 or older sign for themselves.",
      "Families of the ScholarTasks team may write an essay for practice and get a certificate, but cannot win a prize.",
    ] },
    { title: "Dates", lines: [
      `Entries open ${day(c.opens_at)} and close ${new Date(c.closes_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" })} (Eastern time).`,
      c.results_on ? `Results are shared by ${day(c.results_on)}.` : "Results are shared after judging is done.",
    ] },
    { title: "How to enter", lines: [
      `Write an essay of ${c.min_words} to ${c.max_words} words on the topic below, inside the ScholarTasks app, in the student's own login. Pasting is turned off in the challenge, and the app keeps a writing history.`,
      "The essay must be the student's own work. The ScholarTasks coach can give tips but never writes. An essay written by another person or by an AI tool, or copied from anywhere, is disqualified.",
      "One entry per student for each challenge. After it is sent in, it can't be changed.",
      `Topic: ${c.prompt}`,
    ] },
    { title: "How winners are picked", lines: [
      "This is a contest of skill, not luck. Our review team reads every essay with the student's name hidden and scores it out of 100:",
      ...RUBRIC.map((r) => `${r.label}: ${r.weight} points`),
      "Ties are settled by a second reading. Our team's decisions are final. If there are too few entries that meet the rules, we may award fewer prizes.",
    ] },
    { title: "Prizes", lines: [
      ...(c.prizes.length ? c.prizes.map(prizeText) : ["Winners get a winner's certificate."]),
      "Every student who sends in a finished essay gets a certificate to claim and print.",
      ...(cash.length ? [
        "Cash prizes are paid to the parent or guardian (or to a student who is 18 or older) within 30 days after we confirm the winner, by check or bank transfer. Prize money is separate from any scholarship.",
        "Prizes may count as taxable income. If the law requires a tax form for the amount won, we will ask for one (Form W-9) before paying.",
      ] : []),
      "Prizes can't be traded or swapped. If a winner can't be reached within 30 days, the prize may go to the next-highest essay.",
    ] },
    { title: "Privacy", lines: [
      "Essays are private. Only the student, their parents and our review team can read them.",
      "We share a winner's first name, grade and state only if the parent said yes when signing. We never share the essay, last name, school or a photo without asking again.",
    ] },
    { title: "Other rules", lines: [
      "Apple and Google are not part of this challenge and are not responsible for it in any way.",
      "We may change or cancel a challenge if something outside our control stops it from running fairly. Void where the law does not allow it.",
      "Questions: support@scholartasks.com.",
    ] },
  ];
}

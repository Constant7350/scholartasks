// Applying to a scholarship inside ScholarTasks: one workspace per saved award
// with the form questions, letters and papers, the hand-off to the official
// site (or, for a school's own local award, sending it to the school in the app)
// and what happened after. Pure helpers; the page and the database do the rest.

import { countWords, essayTheme, wordLimitFrom } from "./application";

export type ApplicationStatus = "getting_ready" | "submitted" | "won" | "not_won";

export const APPLICATION_STATUS: Record<ApplicationStatus, string> = {
  getting_ready: "Getting ready",
  submitted: "Sent, waiting to hear",
  won: "Won",
  not_won: "Not this time",
};

/** One question the application form asks, and the student's answer. */
export interface FormAnswer { q: string; a: string; limit?: number | null }
/** A paper the application needs: transcript, resume, FAFSA page, photo... */
export interface DocItem { name: string; done: boolean; link?: string | null }
/** Someone writing a letter of recommendation. */
export interface Recommender { name: string; email?: string | null; role?: string | null; asked_on?: string | null; received: boolean }

export interface ApplicationState {
  status: ApplicationStatus;
  answers: FormAnswer[];
  docs: DocItem[];
  recommenders: Recommender[];
  /** How many letters the award asks for (0 when none). */
  lettersNeeded: number;
  submitted_on?: string | null;
}

const has = (text: string, re: RegExp) => re.test(text);

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, "1": 1, "2": 2, "3": 3, "4": 4 };

/** How many recommendation letters the award's text asks for. 0 when it doesn't say. */
export function lettersNeeded(text: string | null | undefined): number {
  const t = (text ?? "").toLowerCase();
  if (!/\b(recommendation|reference letter|letters? of (recommendation|reference|support)|recommender)/.test(t)) return 0;
  const m = t.match(/\b(one|two|three|four|[1-4])\s+(?:\w+\s+){0,2}(?:letters?|recommendations?|references?|recommenders?)/);
  return m ? NUMBER_WORDS[m[1]!] ?? 1 : 1;
}

/**
 * The papers to gather, read from the award's own words (how to apply, summary,
 * checklist steps). Each one links to the ScholarTasks page that makes it, when there is one.
 */
export function suggestedDocs(text: string | null | undefined, opts: { needBased?: boolean } = {}): DocItem[] {
  const t = (text ?? "").toLowerCase();
  const out: DocItem[] = [];
  const add = (name: string, link: string | null = null) => { if (!out.some((d) => d.name === name)) out.push({ name, done: false, link }); };
  if (has(t, /transcript|grades|gpa/)) add("Transcript (ask your school counselor for the official one)", "/grades/record");
  if (has(t, /resume|résumé|activities list|activity list|extracurricular/)) add("Resume or activities list", "/activities/resume");
  if (opts.needBased || has(t, /fafsa|financial need|student aid index|\bsai\b|need-based|need based|tax return|income/)) add("FAFSA summary page that shows your Student Aid Index (SAI)", "/aid");
  if (has(t, /test score|sat\b|act\b/)) add("SAT or ACT score report");
  if (has(t, /photo|headshot|picture of you/)) add("A recent photo of you");
  if (has(t, /acceptance letter|admission letter|proof of (enrollment|acceptance)/)) add("College acceptance letter");
  if (has(t, /video/)) add("Short video (check the length limit)");
  if (has(t, /portfolio|work samples?|artwork/)) add("Portfolio or work samples");
  if (has(t, /proof of (residen|citizen)|birth certificate|green card|permanent resident card/)) add("Proof of residency or citizenship (show it, never type the number in ScholarTasks)");
  if (has(t, /interview/)) add("Get ready for an interview");
  return out;
}

/** The essay prompts become form questions with their word limits, so the student sees them all in one list. */
export function questionsFromPrompts(prompts: string[]): FormAnswer[] {
  return prompts.map((p) => p.trim()).filter(Boolean).map((q) => ({ q, a: "", limit: wordLimitFrom(q) }));
}

export interface SavedAnswer { id: string; title: string; prompt: string | null; draft: string }

/**
 * Saved short answers that fit a form question: same theme first (career goals,
 * a challenge, service...), then the most shared words. Only answers with text.
 */
const STOP = new Set(["your", "you're", "with", "what", "that", "this", "have", "about", "describe", "tell", "would", "will", "from", "they", "them", "when", "where", "which", "words", "please", "explain"]);
const keyWords = (t: string) => (t.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w));

export function suggestAnswers(question: string, saved: SavedAnswer[], max = 3): SavedAnswer[] {
  const theme = essayTheme(question);
  const words = new Set(keyWords(question));
  const score = (s: SavedAnswer) => {
    const t = essayTheme(`${s.title}. ${s.prompt ?? ""}`);
    const shared = keyWords(`${s.title} ${s.prompt ?? ""}`).filter((w) => words.has(w)).length;
    return (theme !== "other" && t === theme ? 10 : 0) + shared;
  };
  return saved.filter((s) => s.draft.trim()).map((s) => ({ s, n: score(s) })).filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, max).map((x) => x.s);
}

/** Whole days from today to the deadline. Negative once it has passed; null when there is no date. */
export function daysLeft(deadline: string | null | undefined, today: Date = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(deadline + "T12:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export interface Progress { done: number; total: number; next: string | null }

/** How far along an application is, and the one next thing to do. */
export function applicationProgress(a: ApplicationState): Progress {
  const items: [boolean, string][] = [];
  for (const x of a.answers) {
    const ok = !!x.a.trim() && (!x.limit || countWords(x.a) <= x.limit);
    items.push([ok, x.a.trim() ? `Shorten your answer to "${short(x.q)}"` : `Answer "${short(x.q)}"`]);
  }
  for (const d of a.docs) items.push([d.done, `Get: ${d.name}`]);
  const letters = Math.max(a.lettersNeeded, a.recommenders.length);
  for (let i = 0; i < letters; i++) {
    const r = a.recommenders[i];
    items.push([!!r?.received, !r ? "Choose who will write a letter for you" : !r.asked_on ? `Ask ${r.name} for a letter` : `Check that ${r.name} sent the letter`]);
  }
  const sent = a.status !== "getting_ready";
  items.push([sent, "Send the application"]);
  const done = items.filter(([ok]) => ok).length;
  const next = sent ? null : items.find(([ok]) => !ok)?.[1] ?? null;
  return { done, total: items.length, next };
}

const short = (q: string) => (q.length > 60 ? q.slice(0, 57).trimEnd() + "…" : q);

/** A polite letter request the student sends from their own email. */
export function letterRequest(p: { student: string; recommender: string; award: string; deadline?: string | null; howToSend?: string | null }): { subject: string; body: string } {
  const due = p.deadline ? new Date(p.deadline + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const ask = due ? new Date(new Date(p.deadline + "T12:00:00").getTime() - 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
  const body = [
    `Dear ${p.recommender},`,
    "",
    `I am applying for the ${p.award}, and it asks for a letter of recommendation. Would you be willing to write one for me?`,
    due ? `The application is due ${due}, so it would help a lot to have the letter by ${ask}.` : "I will send you the deadline as soon as I have it.",
    p.howToSend?.trim() ? `How to send it: ${p.howToSend.trim()}` : "I will send you the details on how to submit it.",
    "I can share my resume and a few notes about what I have worked on, if that helps.",
    "",
    "Thank you so much for thinking about it.",
    "",
    p.student,
  ].join("\n");
  return { subject: `Letter of recommendation for the ${p.award}`, body };
}

/** A short thank-you note after a win, for the student to finish in their own words. */
export function thankYouStarter(p: { student: string; award: string; giver: string }): string {
  return [
    `Dear ${p.giver},`,
    "",
    `Thank you for choosing me for the ${p.award}. [Say in your own words what this award means to you and what you plan to study.]`,
    "",
    "Sincerely,",
    p.student,
  ].join("\n");
}

export interface SummaryRow { status: ApplicationStatus; amount_won?: number | null }
/** Counts for the "My applications" line: how many getting ready, sent, won, and the total won. */
export function summarizeApplications(rows: SummaryRow[]) {
  const n = (s: ApplicationStatus) => rows.filter((r) => r.status === s).length;
  return {
    gettingReady: n("getting_ready"), sent: n("submitted"), won: n("won"), notWon: n("not_won"),
    totalWon: rows.filter((r) => r.status === "won").reduce((t, r) => t + (r.amount_won ?? 0), 0),
  };
}

/** What a school receives when a student sends an application for that school's own scholarship. */
export interface SchoolPacket {
  full_name: string;
  email?: string | null;
  grade_level: number;
  high_school?: string | null;
  gpa?: string | null;
  sat?: number | null;
  act?: number | null;
  activities?: string[];
  honors?: string[];
  answers: { q: string; a: string }[];
  essay?: { prompt: string; text: string } | null;
  letters?: string[];
}

/** Checks a packet before it is sent. Returns the problems in plain words (empty when it is ready). */
export function packetProblems(p: SchoolPacket): string[] {
  const out: string[] = [];
  if (p.full_name.trim().length < 2) out.push("Type your full name.");
  const blank = p.answers.filter((x) => x.q.trim() && !x.a.trim()).length;
  if (blank) out.push(blank === 1 ? "One question has no answer yet." : `${blank} questions have no answer yet.`);
  if (p.essay && p.essay.prompt.trim() && !p.essay.text.trim()) out.push("The essay is empty.");
  if (JSON.stringify(p).length > 60000) out.push("This is too long to send. Shorten the essay or answers.");
  return out;
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { limitReached } from "../../../lib/billing";
import { CHURCH_FAMILIES, displayGpa, primaryGpa, type CourseGrade } from "@scholartasks/core";
import { after } from "next/server";
import { PACKED_STATES, aidOfficeFor, checkStatePrograms, packFor, stateName } from "../../../lib/state-packs";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../lib/ai-consent";
import { aiDailyLimit } from "../../../lib/ai-limit";
import { TRADES, TRADE_AID } from "../../../lib/trades";
import { aiLanguageNote, langOf } from "../../../lib/lang";
import { aiOffMessage } from "../../../lib/ai-off";

// AI counselor chat. The browser sends the signed-in person's Supabase token;
// every read below runs under that token, so row-level security decides what
// the AI may see. ANTHROPIC_API_KEY is set in Vercel and never reaches the browser.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sonnet keeps each answer around a cent; the daily cap bounds the worst case per person.
const MODEL = "claude-sonnet-5-5";
const MAX_TURNS = 20;
const MAX_CHARS = 4000;

interface ChatMessage { role: "user" | "assistant"; content: string }
interface Student {
  id: string; first_name: string; birth_date: string; grade_level: number; state: string;
  sat: number | null; act: number | null; income_band: string | null; permissions: Record<string, boolean>;
  goal_gpa?: number | null; min_grade?: string | null; match_profile?: { college_type?: string; church?: string | null } | null;
}

const json = (status: number, error: string) => Response.json({ error }, { status });

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function age(birth: string, today: string): number {
  const [by, bm, bd] = birth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Reads a table, treating "table not created yet" as empty so the chat still works. */
async function rows<T>(q: PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error && error.code !== "PGRST205" && error.code !== "42P01") throw new Error("Could not load your plan.");
  return (data as T[]) ?? [];
}

async function studentContext(sb: SupabaseClient, s: Student, isParent: boolean, today: string): Promise<string> {
  const [grades, colleges, tasks, activities, service, recs, brag] = await Promise.all([
    rows<{ term: string; course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number }>(
      sb.from("course_grades").select("term, course, grade, level, core, grade_level").eq("student_id", s.id).order("grade_level"),
    ),
    rows<{ name: string; plan: string; deadline: string | null; status: string; notes: string | null }>(
      sb.from("student_colleges").select("name, plan, deadline, status, notes").eq("student_id", s.id).order("deadline"),
    ),
    rows<{ title: string; kind: string | null; due_on: string | null; status: string; amount: number | null }>(
      sb.from("tasks").select("title, kind, due_on, status, amount").eq("student_id", s.id).order("due_on"),
    ),
    rows<{ kind: string; category: string; position: string; organization: string | null; description: string | null; grades: number[]; hours_per_week: number | null; recognition: string | null }>(
      sb.from("student_activities").select("kind, category, position, organization, description, grades, hours_per_week, recognition").eq("student_id", s.id).order("sort_order"),
    ),
    rows<{ served_on: string; hours: number; organization: string }>(
      sb.from("service_hours").select("served_on, hours, organization").eq("student_id", s.id),
    ),
    rows<{ name: string; role: string; subject: string | null; status: string }>(
      sb.from("recommenders").select("name, role, subject, status").eq("student_id", s.id).order("created_at"),
    ),
    rows<{ answers: Record<string, string> }>(sb.from("brag_sheets").select("answers").eq("student_id", s.id)),
  ]);

  const pack = packFor(s.state);
  const main = primaryGpa(pack);
  const gpaName = main?.label ?? "GPA";
  const lines: string[] = [
    `Student: ${s.first_name}, age ${age(s.birth_date, today)}, grade ${s.grade_level}, lives in ${stateName(s.state)} (${s.state}).`,
    `Test scores: SAT ${s.sat ?? "not entered"}, ACT ${s.act ?? "not entered"}.`,
    s.goal_gpa != null
      ? `Family's goal: ${gpaName} ${Number(s.goal_gpa).toFixed(2)}; lowest grade they're OK with in a core class: ${s.min_grade ?? "B"}.`
      : `Family's goal: not set yet (the app assumes ${(main?.target ?? 3).toFixed(1)}${main ? ` for ${main.program.name}` : ""} and a B standard).`,
  ];
  const pref = s.match_profile ?? null;
  if (pref?.college_type && pref.college_type !== "any") {
    const church = CHURCH_FAMILIES.find((f) => f.id === pref.church)?.label;
    lines.push(`College preference (picked on Find colleges): ${pref.college_type === "christian" ? `private Christian colleges and universities${church ? ` (church family: ${church})` : ""}` : `${pref.college_type} colleges`}. Suggest colleges of this kind first, in ${stateName(s.state)} and nationwide.`);
  }
  if (isParent || s.permissions?.see_income_and_costs) {
    lines.push(`Family income band: ${s.income_band ?? "not entered"}.`);
  }

  const cg: CourseGrade[] = grades.map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level }));
  const results = checkStatePrograms(s, cg, today);
  if (pack && results.length) {
    lines.push(`${pack.name} scholarship check (from the grades saved in ScholarTasks; the official ${gpaName} comes from the ${pack.agency.name}):`);
    for (const r of results) {
      const gpa = r.gpa === null ? "no core grades saved" : `GPA ${displayGpa(r.gpa)}`;
      lines.push(`- ${r.programName}: ${r.status === "eligible" ? "meets every rule the app can check" : "not yet"} (${gpa})${r.gaps.length ? ". " + r.gaps.map((g) => g.message).join(" ") : ""}${r.checks.length ? ` Also needed: ${r.checks.join("; ")}.` : ""}`);
    }
  }

  lines.push(
    grades.length
      ? "Saved courses:\n" + grades.map((g) => `- Grade ${g.grade_level} ${g.term}: ${g.course} (${g.level}${g.core ? ", core" : ""}) ${g.grade}`).join("\n")
      : "Saved courses: none yet.",
  );
  lines.push(
    colleges.length
      ? "College list:\n" + colleges.map((c) => `- ${c.name}: ${c.plan}, deadline ${c.deadline ?? "not set"}, status ${c.status}${c.notes ? `, notes: ${c.notes}` : ""}`).join("\n")
      : "College list: empty.",
  );
  lines.push(
    tasks.length
      ? "Scholarships and other deadlines:\n" + tasks.map((t) => `- ${t.title} (${t.kind ?? "other"}): due ${t.due_on ?? "no date"}, ${t.status}${t.amount ? `, $${t.amount}` : ""}`).join("\n")
      : "Scholarships and other deadlines: none saved.",
  );
  lines.push(
    activities.length
      ? "Activities, jobs and awards (from the Activities page):\n" + activities.map((a) =>
          `- ${a.kind === "honor" ? "Award" : a.category}: ${a.position}${a.organization ? `, ${a.organization}` : ""}${a.grades?.length ? ` (grades ${a.grades.join(", ")})` : ""}${a.hours_per_week ? `, ${a.hours_per_week} hrs/week` : ""}${a.recognition ? `, ${a.recognition} level` : ""}${a.description ? `: ${a.description}` : ""}`).join("\n")
      : "Activities, jobs and awards: none entered yet (the Activities and resume page).",
  );
  if (service.length) {
    const byOrg = new Map<string, number>();
    for (const h of service) byOrg.set(h.organization, (byOrg.get(h.organization) ?? 0) + Number(h.hours));
    const total = [...byOrg.values()].reduce((a, b) => a + b, 0);
    lines.push(`Service hours log: ${total} hours in all (${[...byOrg].map(([o, n]) => `${o} ${n}`).join(", ")}).`);
  } else lines.push("Service hours log: nothing logged yet.");
  lines.push(
    recs.length
      ? "Recommendation letters: " + recs.map((r) => `${r.name} (${r.role}${r.subject ? `, ${r.subject}` : ""}): ${r.status}`).join("; ") + "."
      : "Recommendation letters: no recommenders added yet.",
  );
  const answered = brag[0] ? Object.values(brag[0].answers).filter((v) => v?.trim()).length : 0;
  lines.push(`Brag sheet: ${answered ? `${answered} questions answered` : "not started"}.`);
  return lines.join("\n");
}

// The first block is the same for every family, so it is cached on the AI side
// (cheaper repeat questions). Family-specific details go in the second block.
/** The home-state part of the prompt: programs, dates and notes from the state pack (or where to look). */
function stateSection(state: string | null): string {
  const pack = packFor(state);
  if (!pack) {
    const covered = PACKED_STATES.map((p) => p.name).join(", ");
    if (!state) return `No home state yet. ScholarTasks has state aid details for ${covered}; ask which state they live in when it matters.`;
    const office = aidOfficeFor(state);
    return `This family lives in ${stateName(state)}. ScholarTasks doesn't have ${stateName(state)}'s state aid rules yet (it has ${covered}). Don't guess state rules or amounts: point them to the ${office.name} (${office.url})${office.programs.length ? `, which runs programs such as ${office.programs.join(", ")}` : ""}, and focus on federal aid, college aid and national scholarships.`;
  }
  const deadlines = pack.deadlines.map((d) => `- ${d.date}${d.class_of ? ` (class of ${d.class_of})` : ""}: ${d.title} (${d.where})`).join("\n");
  const programs = pack.programs.map((p) => `- ${p.name}: ${p.summary} ${p.award?.summary ?? ""} Source: ${p.source_url}`).join("\n");
  return `${pack.name} programs in ScholarTasks (draft data still being verified with the ${pack.agency.name}):
${programs}

${pack.name} dates in ScholarTasks (draft):
${deadlines}
${pack.counselor_notes.length ? `\n${pack.name} notes:\n${pack.counselor_notes.map((n) => `- ${n}`).join("\n")}\n` : ""}`;
}

const PROMPTS = new Map<string, string>();
function staticPrompt(state: string | null): string {
  const key = packFor(state)?.state ?? state ?? "";
  const hit = PROMPTS.get(key);
  if (hit) return hit;
  const ga = key === "GA";
  const home = stateName(state);
  const site = packFor(state)?.aid_site?.url.replace(/^https?:\/\/(www\.)?/, "") ?? null;
  const text = `You are the ScholarTasks counselor, a warm, practical college and financial-aid advisor for families. Write in plain, friendly language a busy parent or a teenager can act on. Keep answers short (a few sentences or a short list) unless asked for more, and end with the single most useful next step when there is one.

${stateSection(state)}

How to help:
- Build advice around this student's actual grades, scores, college list and deadlines in the family details that follow. If something important is missing, say what to add in ScholarTasks (Grades page, or College list and deadlines page).
- Dates, amounts and rules change every year. When you state one, say it should be confirmed on the official site (studentaid.gov, ${site ?? "the state aid office's site"}, or the college's own admissions or aid page). Never invent a scholarship, deadline or amount; if you aren't sure, say so.
- For essays, help the student brainstorm, outline and improve their own writing, and give feedback. Don't write a whole essay for them to submit as their own.
- The family sets the student's GPA goal and grade standard. Measure progress and advice against their goal, not against straight A's. If the goal is below what a scholarship needs${ga ? " (HOPE needs a 3.0 HOPE GPA; Zell Miller 3.7)" : ""}, say so kindly and explain the tradeoff, but the choice is theirs.
- When a grade is below the family's standard, ask a few short questions to find the cause (tests or homework, missing work, a hard topic, time, the teacher) before suggesting a small step-by-step plan.
- Don't do homework, projects or graded work for the student. Teach instead: ask what they've tried, give a hint, and work a similar example.
- Families file the FAFSA${ga ? " and GSFAPP" : " and any state aid form"} themselves with their own accounts. Never ask for or accept Social Security numbers, FSA IDs, passwords or bank details; if someone shares one, tell them not to and don't repeat it.
- You are not a lawyer, tax preparer or the college's official aid office. For appeals, tax questions or special circumstances, explain the options and point them to the college's financial aid office or the school counselor.
- If a student seems stressed or overwhelmed, be kind and encouraging, and suggest talking with a parent or school counselor. If anyone mentions thoughts of self-harm or being unsafe, tell them they can call or text 988 (Suicide and Crisis Lifeline) right now, and encourage them to reach a trusted adult.
- Beyond grades: grades and course rigor come first everywhere. After that, colleges read character (about two in three colleges weigh it, mostly through essays, recommendation letters and the activities list), activities, leadership, service, jobs and family duties. Depth beats a long list.${ga ? ` UGA says "depth over breadth"; Georgia Tech says most admits have 3 to 5 activities done in a meaningful way and counts work and family responsibilities. UGA (Common Data Set 2024-25) rates rigor and GPA very important, test scores important, and essay, recommendations, activities, character, volunteer work and work experience as considered; it does not consider interviews or demonstrated interest (campus visits). UGA takes one optional teacher letter (ideally from a challenging class) and an optional resume; Georgia Tech accepts no resumes. Many Georgia public colleges, like Kennesaw State, admit mostly on GPA, where these things matter more for scholarships and honors programs.` : " Many public colleges admit mostly on GPA, where these things matter more for scholarships and honors programs."}
- Start at a two-year college, then transfer: often much cheaper, and transfer admission to big universities is usually easier than first-year admission ${ga ? `(UGA Fall 2026: roughly 63% of transfer applicants admitted vs about 30% of first-year applicants; UGA wants one transfer for every two freshmen). UGA's minimum to be considered: 30-59 transferable hours with a 3.30 college GPA, or 60+ hours with 3.00 (no SAT/ACT or high school grades for transfers; all college grades count, including D's and F's; some majors like business need more). Core classes (Areas A-E, 42 hours) at any University System of Georgia college transfer in full to another USG college, and 38 general education classes at Georgia's technical colleges transfer to every USG college. Georgia Tech's Regents' Engineering Pathway lets students take two years at a partner USG college, then finish engineering at Tech. HOPE pays at two-year colleges too.` : `. Many states guarantee that an associate degree from a public two-year college transfers to the state's public universities; check the state's transfer agreement and each university's transfer page.`} Cautions: take the prerequisites for the intended major, keep grades high, and check each university's transfer page; nursing and engineering have strict course sequences. The search-by-major page shows the savings. Never limit advice to ${home}: families can choose schools anywhere in the U.S.
- Use the student's activities, service hours, recommenders and brag sheet above to suggest the next step for their grade: 9th, join 2-4 activities and start a service log; 10th, go deeper and take on a responsibility; 11th, seek a leadership role, pick two core-class teachers and ask for letters in spring, finish the brag sheet; 12th, confirm recommenders, polish the 10 Common App activity descriptions, and thank recommenders. Point them to the Activities and resume page and their To-do list. Help them describe what they did, but the activity descriptions, brag sheet and essays stay in their own words.
- Christian and private colleges: Find colleges (/colleges, question 3 "What kind of college?") and Search colleges by major (/majors) can show only public, only private, or only Christian colleges and universities (from the federal College Scorecard's religious affiliation), narrowed to a church family (Baptist, Catholic, Methodist, Presbyterian, Lutheran, Pentecostal, nondenominational and more) if the family wants; the choice is saved for the student. When the family prefers Christian colleges, suggest Christian colleges first, home state and nationwide, name each one's affiliation, and mention that many private colleges give large merit scholarships${ga ? " and that the HOPE Scholarship pays a set amount per year at eligible private Georgia colleges, including many Christian ones" : ""}. Never push a family toward or away from religious colleges; it is their choice.
- Trades are an equal path to college, not a fallback. The Trades page (/trades) has a page for each trade with pay, ways to train, licensing, schools in every state and apply checklists, plus a quiz at /trades/quiz. ${ga ? `In Georgia, the HOPE Grant ($107 per credit hour in 2026-27, no high school GPA needed, keep a 2.0 at 30 and 60 hours) plus the HOPE Career Grant ($500 a term at 9+ hours; truck driving up to $1,100; police academy up to $3,750) cover tuition in high-demand programs at the 22 technical colleges; students still pay fees, books and tools. Dual Enrollment pays tuition, fees and books for up to 30 hours (10th graders can take career-tech classes).` : `Check the state's own technical college and dual enrollment programs in the notes above.`} Registered and union apprenticeships pay a wage while you train (IBEW electrical needs a year of algebra and an aptitude test; ranked lists last 2 years). Workforce Pell (from July 1, 2026) covers 8 to 15 week programs once a state approves them. The Pell Grant (up to $7,395 in 2026-27) and trade scholarships like mikeroweWORKS (programs of 2 years or less; apply by Apr 30, Jun 30, Aug 30 or Oct 31) work in any state, but state awards like ${ga ? "HOPE" : "these"} only work at schools in the home state and out-of-state tuition is usually 2 to 4 times higher. Some trades are mostly in a few states (wind turbines, commercial diving, boilermakers, farriers). Always show options in ${home} and in other states and let the family choose. Other states have their own free or low-cost training for residents (usually a year of living there first): ${TRADE_AID.filter((a) => a.state !== "US" && a.state !== "GA").map((a) => `${a.name} (${a.state}): ${a.amount}`).join("; ")}. All ways to pay are on /aid#trades and each trade page. Students in grades 8 to 12 can add trade-path steps (career pathway classes, SkillsUSA or similar clubs, job shadowing, Dual Enrollment, youth apprenticeship) from /trades#grades. Trades in the app (Georgia typical pay; * = tuition-free with HOPE): ${TRADES.map((t) => `${t.name} ${t.pay.ga_typical ? `$${Math.round(t.pay.ga_typical / 1000)}k` : "n/a"}${t.hope_career_grant ? "*" : ""} (/trades/${t.slug})`).join("; ")}.
- Stay on school, college, careers, test prep, scholarships and paying for college. Politely steer other topics back.`;
  PROMPTS.set(key, text);
  return text;
}

function systemPrompt(talkingTo: "parent" | "student", context: string, today: string, state: string | null, langNote = "") {
  const who = talkingTo === "parent" ? "the student's parent or guardian" : "the student themself";
  return [
    { type: "text" as const, text: staticPrompt(state), cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: `Today is ${today}. You are talking with ${who}.\n\nWhat you know about this family (from their ScholarTasks account):\n${context}${langNote}` },
  ];
}

const BANK_SCHEMA = {
  type: "object",
  properties: {
    general: { type: "boolean" },
    question: { type: "string" },
    answer: { type: "string" },
  },
  required: ["general", "question", "answer"],
  additionalProperties: false,
};

/**
 * Asks a small, cheap model whether a question is general (the same answer
 * would fit any family in the same state). If so, saves a version with every personal
 * detail removed, as "pending" until ScholarTasks staff approve it.
 */
async function suggestForBank(client: Anthropic, sb: SupabaseClient, studentId: string | null, question: string, answer: string, state: string) {
  const fam = `${stateName(state)} families`;
  const example = state === "GA" ? `"How do the FAFSA and the GSFAPP differ?"` : `"When does the FAFSA open?"`;
  try {
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: BANK_SCHEMA } },
      system: `You maintain a library of reusable answers for a college and financial-aid app for ${fam}. You are given one family's question and the counselor's answer. Set general to true only if the question itself is general, meaning the same answer would help any of the ${fam} (for example "What is Early Action?" or ${example}). Set it to false if the question is about this student's own grades, scores, colleges, deadlines, money or situation, or depends on earlier conversation. When general is true, rewrite the question as a short generic question, and rewrite the answer for any family: remove every name, grade, score, college list, date tied to this family, and anything else personal, keeping the general facts, the advice to confirm on official sites, and the same friendly tone. When general is false, return empty strings for question and answer.`,
      messages: [{ role: "user", content: `<question>\n${question}\n</question>\n<answer>\n${answer}\n</answer>` }],
    });
    if (res.stop_reason !== "end_turn") return;
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const out = JSON.parse(text) as { general: boolean; question: string; answer: string };
    if (!out.general || out.question.trim().length < 5 || out.answer.trim().length < 20) return;
    await sb.rpc("answer_bank_submit", { p_student: studentId, p_question: out.question.trim().slice(0, 500), p_answer: out.answer.trim().slice(0, 6000) });
  } catch (e) {
    console.error("answer bank suggestion failed", e);
  }
}

const MATCH_SCHEMA = {
  type: "object",
  properties: { match: { type: "integer" } },
  required: ["match"],
  additionalProperties: false,
};

/**
 * When the wording differs, a small, cheap model checks whether one of the
 * closest reviewed questions asks the same thing. Returns its id, or null.
 */
async function matchBank(client: Anthropic, candidates: { id: string; question: string }[], question: string): Promise<string | null> {
  if (candidates.length === 0) return null;
  try {
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 200,
      output_config: { effort: "low", format: { type: "json_schema", schema: MATCH_SCHEMA } },
      system: `You match a family's question to a library of reviewed answers for a college and financial-aid app (answers for families in one state). Return the number of the library question that asks the same thing, so its saved answer fully answers the family's question. Return 0 if none does, if the family's question is about their own student (their grades, scores, colleges, deadlines or money), or if it asks for more than the saved question covers. When unsure, return 0.`,
      messages: [{ role: "user", content: `<library>\n${candidates.map((c, i) => `${i + 1}. ${c.question}`).join("\n")}\n</library>\n<family_question>\n${question}\n</family_question>` }],
    });
    if (res.stop_reason !== "end_turn") return null;
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const n = (JSON.parse(text) as { match: number }).match;
    return Number.isInteger(n) && n >= 1 && n <= candidates.length ? candidates[n - 1]!.id : null;
  } catch (e) {
    console.error("answer bank match failed", e);
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The AI counselor isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; messages?: unknown };
  try { body = await req.json(); } catch { return json(400, "Bad request."); }
  // No student yet means a general chat (families can try it before adding a child).
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]).slice(-MAX_TURNS) : [];
  const valid =
    messages.length > 0 && messages[messages.length - 1]?.role === "user" &&
    messages.every((m, i) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0 && m.content.length <= MAX_CHARS && (i === 0 ? m.role === "user" : m.role !== messages[i - 1]!.role));
  if (!valid) return json(400, "Messages must be under 4,000 characters.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  // A first question that matches a reviewed answer is answered from the bank,
  // free and instantly, without using the daily allowance.
  // Reviewed answers are in English, so Spanish chats always get a fresh answer (and are not saved to the library).
  const spanish = langOf(req) === "es";
  const firstQuestion = messages.length === 1 && !spanish ? messages[0]!.content.trim() : null;
  if (firstQuestion) {
    const hit = await sb.rpc("answer_bank_lookup", { p_student: studentId, p_question: firstQuestion });
    if (hit.error && /not allowed/.test(hit.error.message)) return json(403, "AI chat is turned off for this student. A parent can turn it on in Family and permissions.");
    let saved = (hit.data as { answer: string }[] | null)?.[0];
    if (!saved && !hit.error) {
      const cands = await sb.rpc("answer_bank_candidates", { p_student: studentId, p_question: firstQuestion, p_limit: 25 });
      const id = cands.error ? null : await matchBank(new Anthropic({ apiKey }), (cands.data as { id: string; question: string }[]) ?? [], firstQuestion);
      if (id) saved = ((await sb.rpc("answer_bank_take", { p_student: studentId, p_id: id })).data as { answer: string }[] | null)?.[0];
    }
    if (saved) return new Response(saved.answer, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Answer-Source": "bank" } });
  }

  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (turn.error) {
    if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
    if (turn.error.code === "PGRST202" || turn.error.code === "42883") return json(503, "The AI counselor needs the latest database update first.");
    if (/not allowed/.test(turn.error.message)) return json(403, aiOffMessage(turn.error, "AI chat is turned off for this student. A parent can turn it on in Family and permissions."));
    return json(500, "Something went wrong. Please try again.");
  }
  if (turn.data === false) return json(429, limitReached(limit, "counselor messages"));

  const [st, mem] = await Promise.all([
    studentId
      ? sb.from("students").select("*").eq("id", studentId).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from("family_members").select("role, student_id").eq("user_id", user.user.id),
  ]);
  const student = st.data as Student | null;
  if (studentId && !student) return json(403, "You don't have access to this student.");
  const isParent = ((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent");

  const today = todayEastern();
  let system: ReturnType<typeof systemPrompt>;
  try {
    const context = student
      ? await studentContext(sb, student, isParent, today)
      : "No student has been added yet; this parent is looking around first. Give general guidance, and when personal details (grades, scores, colleges) would change the answer, say that adding their student in ScholarTasks lets you tailor it.";
    system = systemPrompt(student && !isParent ? "student" : "parent", context, today, student?.state ?? null, aiLanguageNote(req));
  } catch (e) {
    return json(500, (e as Error).message);
  }

  const client = new Anthropic({ apiKey });
  const request = {
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" as const },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  // Server-side fallback re-runs a declined question on a backup model. If the API
  // ever rejects the option for this model, retry once without it.
  const open = (withFallback: boolean) =>
    withFallback
      ? client.beta.messages.stream({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : client.beta.messages.stream(request);
  let stream = open(true);

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        try {
          await stream.emitted("connect");
        } catch (e) {
          if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) stream = open(false);
          else throw e;
        }
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            sent = true;
          }
        }
        const final = await stream.finalMessage();
        if (firstQuestion && final.stop_reason === "end_turn") {
          const answer = final.content.map((b) => (b.type === "text" ? b.text : "")).join("");
          try {
            after(() => suggestForBank(client, sb, studentId, firstQuestion, answer, student?.state ?? "GA"));
          } catch {
            await suggestForBank(client, sb, studentId, firstQuestion, answer, student?.state ?? "GA");
          }
        }
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nSorry, I can't help with that one. Try asking another way, or ask about colleges, scholarships or deadlines."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n(That answer got cut off. Ask me to continue.)"));
        }
      } catch (e) {
        console.error("counselor stream failed", e);
        controller.enqueue(encoder.encode((sent ? "\n\n" : "") + "Sorry, the counselor hit a problem. Please try again in a minute."));
      } finally {
        controller.close();
      }
    },
    cancel() { stream.abort(); },
  });

  return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

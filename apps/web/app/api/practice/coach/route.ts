import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";
import { aiLanguageNote } from "../../../../lib/lang";
import { aiOffMessage } from "../../../../lib/ai-off";
import { levelName, subjectStates, type Attempt, type QMeta } from "../../../practice/levels";

// The practice coach, one AI use per tap:
//   mode "report"     a "where I stand" report for one class, from the student's own answers
//   mode "challenge"  three fresh Expert questions for a student who has reached Expert, so
//                     the hardest level never runs out. They're original, not saved to the bank.
// Levels are about how well the student knows the class now, never intelligence or IQ.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    work_on: { type: "array", items: { type: "string" } },
    next_level: { type: "string" },
  },
  required: ["summary", "strengths", "work_on", "next_level"],
  additionalProperties: false,
};
const CHALLENGE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["topic", "question", "options", "answer_index", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const REPORT_SYSTEM = `You coach a US middle or high school student on one class they practice in ScholarTasks. You get their level in the class (Foundation, Core, Strong, Advanced, Expert), how they did at each level and by topic.
Write to the student ("you"), warm and specific:
- summary: 2 to 3 sentences on where they stand in this class now and what that means.
- strengths: 1 to 3 short items, the topics they clearly understand.
- work_on: 1 to 3 short items, the topics to practice next, each with a concrete way to study it.
- next_level: 1 to 2 sentences on exactly how to reach the next level (or, at Expert, how to keep growing).
Rules: levels describe how well they know this class right now. Never mention IQ, intelligence, being smart or not smart, or compare them with other students. Everyone can move up with practice. Keep it short.`;

const CHALLENGE_SYSTEM = `You write original, very hard multiple-choice practice questions for a strong US high school student who has reached the top (Expert) level in a class. Write 3 new questions in the class given, at the level of an honors or AP final exam, each needing several steps of reasoning, not recall.
Rules: exactly 4 options each, one clearly correct; answer_index is the 0-based index of the right option; vary the position of the right option; explanation in 1 to 3 sentences shows the reasoning. Never copy real SAT, ACT, AP or other published test questions. Keep each question under 400 characters. topic is 1 to 3 words. For a world language class, write the question in English and the language being learned.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The coach isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; subject?: unknown; mode?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const subject = typeof body.subject === "string" ? body.subject.slice(0, 60) : "";
  const mode = body.mode === "challenge" ? "challenge" : "report";
  if (!studentId || !subject) return json(400, "Pick a class first.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");
  const { data: st } = await sb.from("students").select("grade_level").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");

  // The student's answers in this class, replayed the same way the page does.
  const { data: qs } = await sb.from("practice_questions").select("id, subject, topic, level, kind, status").eq("subject", subject).is("exam", null);
  const meta = new Map(((qs as QMeta[] | null) ?? []).map((q) => [q.id, q]));
  if (meta.size === 0) return json(404, "That class wasn't found.");
  const { data: at } = await sb.from("practice_attempts").select("question_id, correct, created_at").eq("student_id", studentId).in("question_id", [...meta.keys()]).limit(5000);
  const state = subjectStates(meta, (at as Attempt[] | null) ?? []).get(subject);
  if (mode === "report" && (!state || state.answered < 10)) return json(400, "Answer at least 10 questions in this class first, so the report has something to go on.");
  if (mode === "challenge" && (!state || state.best < 5)) return json(400, "AI challenge questions open up when you reach Expert in this class.");

  const limit = await aiDailyLimit(sb, studentId, true);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? aiOffMessage(turn.error) : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const grade = (st as { grade_level: number }).grade_level;
  let context: string;
  if (mode === "report" && state) {
    const levels = Object.entries(state.byLevel).map(([l, v]) => `${levelName(Number(l))}: ${v.right} of ${v.total} right`).join("; ");
    const topics = Object.entries(state.topics).map(([t, v]) => `${t}: ${v.right}/${v.total}`).join("; ");
    context = `Class: ${subject}. Grade ${grade}. Current level: ${levelName(state.level)} (highest reached: ${levelName(state.best)}). Answered ${state.answered}, ${state.right} right.\nBy level: ${levels}\nBy topic: ${topics}`;
  } else {
    context = `Class: ${subject}. Student grade ${grade}. Write 3 Expert questions.`;
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      output_config: { effort: mode === "challenge" ? "medium" : "low", format: { type: "json_schema", schema: mode === "report" ? REPORT_SCHEMA : CHALLENGE_SCHEMA } },
      system: (mode === "report" ? REPORT_SYSTEM : CHALLENGE_SYSTEM) + aiLanguageNote(req),
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, the coach can't help with that one.");
    const out = JSON.parse(res.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
    if (mode === "challenge") {
      type Q = { topic: string; question: string; options: string[]; answer_index: number; explanation: string };
      out.questions = ((out.questions as Q[]) ?? []).filter((q) => q.options?.length === 4 && q.answer_index >= 0 && q.answer_index < 4).slice(0, 3);
      if (out.questions.length === 0) return json(502, "Sorry, the coach couldn't write questions. Please try again in a minute.");
    }
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("practice coach failed", e);
    return json(502, "Sorry, the coach couldn't answer. Please try again in a minute.");
  }
}

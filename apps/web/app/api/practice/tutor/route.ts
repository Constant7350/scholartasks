import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";

// The practice tutor: checks a written answer to a bank question, or helps a
// student who is stuck on one. It only ever talks about questions from the
// practice bank, coaches instead of handing out answers, and costs one of
// the day's AI uses.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["correct", "partly", "not yet", "none"] },
    feedback: { type: "string" },
    next_step: { type: "string" },
  },
  required: ["verdict", "feedback", "next_step"],
  additionalProperties: false,
};

const SYSTEM = `You are a patient tutor for a US middle or high school student practicing with ScholarTasks' question bank. You only discuss the practice question you are given.

Mode "check": the student wrote an answer to a written question. Compare it with the reference answer for meaning, not exact wording.
- verdict: "correct" if the key ideas are there, "partly" if some are, "not yet" if not.
- feedback: 2 to 4 sentences to the student ("you"): what they got right first, then what is missing or wrong. Don't paste the reference answer; point to the missing idea.
- next_step: one short suggestion (try again with a hint, or a related idea to review).

Mode "help": the student is stuck or asks about the question. Teach the idea behind it step by step with a guiding question or a similar worked example, so they can get there themselves.
- verdict: "none".
- feedback: 3 to 6 sentences of explanation in plain words.
- next_step: one question for the student to try.

Rules: you're a tutor, not an answer machine. If the student asks you to do homework, an assignment, a test or anything outside this practice question, say kindly that you can only help with practice questions here and suggest they ask their teacher. Keep it encouraging and short. If they mention feeling hopeless or unsafe, suggest talking with a parent, school counselor or trusted adult.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The tutor isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; questionId?: unknown; mode?: unknown; answer?: unknown; message?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const mode = body.mode === "check" ? "check" : "help";
  const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 2000) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!studentId || !questionId) return json(400, "Pick a question first.");
  if (mode === "check" && answer.length < 2) return json(400, "Write your answer first.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  const { data: st } = await sb.from("students").select("first_name, grade_level").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");
  const { data: q } = await sb.from("practice_questions").select("exam, subject, topic, kind, passage, question, options, answer_index, model_answer, explanation").eq("id", questionId).maybeSingle();
  if (!q) return json(404, "That question wasn't found.");
  const question = q as { exam: string | null; passage: string | null; subject: string; topic: string; kind: "mc" | "written"; question: string; options: string[] | null; answer_index: number | null; model_answer: string | null; explanation: string | null };
  if (mode === "check" && question.kind !== "written") return json(400, "Only written questions can be checked.");

  // Families with the Study Coach add-on get more tutor help each day.
  const limit = await aiDailyLimit(sb, studentId, true);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? "AI features are turned off for this student. A parent can turn on AI chat in Family and permissions." : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const student = st as { first_name: string; grade_level: number };
  const context = [
    `Mode: ${mode}. Student: grade ${student.grade_level}.`,
    `Subject: ${question.subject}. Topic: ${question.topic}.${question.exam ? ` This is an original ${question.exam}-style practice question; you may mention test strategy.` : ""}`,
    question.passage ? `Passage (text in [[double brackets]] is the underlined part):\n${question.passage}` : "",
    `Question: ${question.question}`,
    question.options ? `Choices: ${question.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("  ")}` : "",
    question.kind === "mc" && question.answer_index != null ? `Correct choice: ${question.options?.[question.answer_index]}. ${question.explanation ?? ""}` : "",
    question.model_answer ? `Reference answer: ${question.model_answer}` : "",
    answer ? `Student's answer: ${answer}` : "",
    message ? `Student's message: ${message}` : "",
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, the tutor can't help with that one.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json(JSON.parse(text), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("practice tutor failed", e);
    return json(502, "Sorry, the tutor couldn't answer. Please try again in a minute.");
  }
}

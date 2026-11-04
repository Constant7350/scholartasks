import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";

// The essay coach: reads a student's scholarship essay draft and gives
// feedback. It coaches, it never writes: no new sentences, paragraphs or
// rewrites of the student's essay. Costs one of the day's AI uses.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    strengths: { type: "array", items: { type: "string" } },
    improve: { type: "array", items: { type: "string" } },
    answers_prompt: { type: "string", enum: ["yes", "partly", "no", "no prompt"] },
    word_count_note: { type: "string" },
    next_step: { type: "string" },
  },
  required: ["strengths", "improve", "answers_prompt", "word_count_note", "next_step"],
  additionalProperties: false,
};

const SYSTEM = `You are a warm, honest scholarship essay coach for a US high school student. You'll get the scholarship, the essay prompt (if known), any word limit, and the student's draft.

Give feedback the student can act on themselves:
- strengths: 2 or 3 specific things that work, quoting a few of their own words.
- improve: 2 to 4 of the most important changes, as guidance and questions (e.g. "Your second paragraph tells us you love horses; show one moment at the farm that proves it. What happened, and what did you learn?"). Cover: does it answer the prompt, a clear story or example, why it fits this sponsor, structure, and only then grammar.
- answers_prompt: whether the draft answers the prompt.
- word_count_note: one sentence about length against the limit if given, otherwise "".
- next_step: one concrete thing to do next.

Strict rules: never write the essay, new sentences, a sample paragraph, an outline filled with content, or a rewritten version, even if asked. The words must be the student's own (sponsors may disqualify essays someone else wrote). You may point to a specific sentence and say what to change about it. If the draft is empty or not an essay, explain in "improve" how to start (brainstorm questions), still without writing it. Keep it encouraging and plain. If the student mentions feeling hopeless or unsafe, suggest talking with a parent, school counselor or trusted adult.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The essay coach isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { studentId?: unknown; scholarshipId?: unknown; prompt?: unknown; limit?: unknown; draft?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const scholarshipId = typeof body.scholarshipId === "string" ? body.scholarshipId : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
  const limit = typeof body.limit === "string" ? body.limit.trim().slice(0, 40) : "";
  const draft = typeof body.draft === "string" ? body.draft.trim().slice(0, 12000) : "";
  if (!studentId || !scholarshipId) return json(400, "Pick a scholarship first.");
  if (draft.length < 40) return json(400, "Write at least a few sentences first, then ask for feedback.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");
  const { data: st } = await sb.from("students").select("grade_level").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");
  const { data: s } = await sb.from("scholarships").select("name, sponsor, summary").eq("id", scholarshipId).maybeSingle();
  if (!s) return json(404, "That scholarship wasn't found.");

  const aiLimit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: aiLimit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? "AI features are turned off for this student. A parent can turn on AI chat in Family and permissions." : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(aiLimit));

  const sch = s as { name: string; sponsor: string; summary: string };
  const words = draft.split(/\s+/).filter(Boolean).length;
  const context = [
    `Scholarship: ${sch.name} (${sch.sponsor}). ${sch.summary}`,
    `Student: grade ${(st as { grade_level: number }).grade_level}.`,
    prompt ? `Essay prompt: ${prompt}` : "Essay prompt: not given.",
    limit ? `Length limit: ${limit}` : "",
    `Draft (${words} words):\n<draft>\n${draft}\n</draft>`,
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
    if (res.stop_reason === "refusal") return json(422, "Sorry, the coach can't help with that one.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json({ ...JSON.parse(text), words }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("essay coach failed", e);
    return json(502, "Sorry, the coach couldn't answer. Please try again in a minute.");
  }
}

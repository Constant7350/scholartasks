import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";

// The college essay coach: feedback on a Common App personal statement or a
// college's supplemental essay, or brainstorming questions before a draft
// exists. It coaches, it never writes. Costs one of the day's AI uses.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const FEEDBACK_SCHEMA = {
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
const BRAINSTORM_SCHEMA = {
  type: "object",
  properties: {
    questions: { type: "array", items: { type: "string" } },
    next_step: { type: "string" },
  },
  required: ["questions", "next_step"],
  additionalProperties: false,
};

const RULES = `Strict rules: never write the essay, new sentences, a sample paragraph, an opening line, an outline filled with content, or a rewritten version, even if asked. The words must be the student's own: colleges treat an essay someone else wrote as dishonest. You may point to a specific sentence and say what to change about it. Keep it encouraging, specific and plain. If the student mentions feeling hopeless or unsafe, suggest talking with a parent, school counselor or trusted adult.`;

const FEEDBACK_SYSTEM = `You are a warm, honest college admissions essay coach for a US high school student. You'll get the essay type (Common App personal statement or a college's supplemental essay), the college if any, the prompt, any word limit, a short list of the student's activities, and the draft.

Give feedback the student can act on themselves:
- strengths: 2 or 3 specific things that work, quoting a few of their own words.
- improve: 2 to 4 of the most important changes, as guidance and questions. In order of importance: does it answer the prompt; does it show the student (a real moment, their voice, what they think and learned) rather than list achievements already in the activities list; for a "why this college" essay, is it specific to that college (programs, people, places) and to the student; structure and a clear ending; only then grammar.
- answers_prompt: whether the draft answers the prompt.
- word_count_note: one sentence about length against the limit if given, otherwise "".
- next_step: one concrete thing to do next.

${RULES}`;

const BRAINSTORM_SYSTEM = `You are a warm college admissions essay coach helping a US high school student find a topic before they write. You'll get the prompt, the college if any, and the student's activities.

- questions: 5 or 6 short, specific questions that help the student recall real moments and opinions of their own, drawing on their activities (e.g. "At the barn, was there a horse you couldn't get through to at first? What changed?"). Mix moments, people, turning points and what they care about. Do not suggest a finished topic or thesis.
- next_step: one concrete thing to do next (e.g. "Pick the question you answered with the most detail and write freely for 15 minutes, without worrying about the word limit.").

${RULES}`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The essay coach isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { essayId?: unknown; mode?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const essayId = typeof body.essayId === "string" ? body.essayId : "";
  const mode = body.mode === "brainstorm" ? "brainstorm" : "feedback";
  if (!essayId) return json(400, "Open an essay first.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");
  // Row security means this only finds essays this person may see.
  const { data: e } = await sb.from("student_essays").select("student_id, kind, title, prompt, word_limit, draft, college_id").eq("id", essayId).maybeSingle();
  if (!e) return json(404, "That essay wasn't found.");
  const essay = e as { student_id: string; kind: string; title: string; prompt: string | null; word_limit: number | null; draft: string; college_id: string | null };
  const draft = essay.draft.trim().slice(0, 20000);
  if (mode === "feedback" && draft.length < 40) return json(400, "Write at least a few sentences first, then ask for feedback. Stuck? Tap Help me find a topic.");

  const [st, col, acts] = await Promise.all([
    sb.from("students").select("grade_level").eq("id", essay.student_id).maybeSingle(),
    essay.college_id ? sb.from("student_colleges").select("name").eq("id", essay.college_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("student_activities").select("kind, position, organization, description").eq("student_id", essay.student_id).order("sort_order").limit(15),
  ]);
  if (!st.data) return json(403, "You don't have access to this student.");

  const limit = await aiDailyLimit(sb, essay.student_id);
  const turn = await sb.rpc("ai_take_turn", { p_student: essay.student_id, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? "AI features are turned off for this student. A parent can turn on AI chat in Family and permissions." : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const activities = ((acts.data as { kind: string; position: string; organization: string | null; description: string | null }[] | null) ?? [])
    .map((a) => `- ${a.kind === "honor" ? "Award: " : ""}${a.position}${a.organization ? `, ${a.organization}` : ""}${a.description ? `: ${a.description}` : ""}`).join("\n");
  const words = draft.split(/\s+/).filter(Boolean).length;
  const context = [
    `Essay: ${essay.kind === "personal" ? "Common App personal statement" : essay.kind === "supplement" ? "College supplemental essay" : "Essay"} (${essay.title}).`,
    (col.data as { name: string } | null)?.name ? `College: ${(col.data as { name: string }).name}.` : "",
    `Student: grade ${(st.data as { grade_level: number }).grade_level}.`,
    essay.prompt ? `Prompt: ${essay.prompt}` : "Prompt: not given.",
    essay.word_limit ? `Word limit: ${essay.word_limit}` : "",
    activities ? `Student's activities (already on the application):\n${activities}` : "Activities: none entered.",
    mode === "feedback" ? `Draft (${words} words):\n<draft>\n${draft}\n</draft>` : draft ? `Notes or start so far:\n<draft>\n${draft.slice(0, 3000)}\n</draft>` : "",
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: mode === "feedback" ? FEEDBACK_SCHEMA : BRAINSTORM_SCHEMA } },
      system: mode === "feedback" ? FEEDBACK_SYSTEM : BRAINSTORM_SYSTEM,
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, the coach can't help with that one.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json({ mode, ...JSON.parse(text), words }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("college essay coach failed", err);
    return json(502, "Sorry, the coach couldn't answer. Please try again in a minute.");
  }
}

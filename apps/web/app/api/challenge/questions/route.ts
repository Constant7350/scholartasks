import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Team only: writes a practice competition's question set with AI, then has a second AI pass
// solve every question on its own. Only questions where the two agree are saved, as "pending"
// for our team to approve. This keeps grading work off the team: the app scores the answers.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-sonnet-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

interface Item { topic: string; level: number; question: string; options: string[]; answer_index: number; explanation: string }

const WRITE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          level: { type: "integer", enum: [3, 4, 5] },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["topic", "level", "question", "options", "answer_index", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};
const SOLVE_SCHEMA = {
  type: "object",
  properties: { answers: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, choice: { type: "integer" } }, required: ["i", "choice"], additionalProperties: false } } },
  required: ["answers"],
  additionalProperties: false,
};

const WRITE_SYSTEM = `You write original multiple-choice questions for a timed US student competition in one school class. Every student gets the same set, so each question must have exactly one clearly correct answer that a strong student can work out without a calculator or outside sources in about one minute.
- level 3 (Strong), 4 (Advanced) or 5 (Expert): mix them about 30% / 40% / 30%. Expert questions need several steps of reasoning, at the level of an honors or AP final, never trivia.
- exactly 4 options, short, with believable wrong answers; vary where the right option sits; answer_index is its 0-based position.
- topic: 1 to 3 words. explanation: 1 to 2 sentences showing why.
- Cover different topics across the class. Never copy real SAT, ACT, AP or other published test questions. Fair for every student whatever their background; no politics, religion or private topics. For a world language class, write questions in English plus the language being learned.`;

const SOLVE_SYSTEM = `Solve each multiple-choice question carefully on your own. Reply with the 0-based index of the one correct option for each, using the question's number as i.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "AI isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: isAdmin } = await sb.rpc("is_app_admin");
  if (isAdmin !== true) return json(403, "This is for the ScholarTasks team.");

  const b = (await req.json().catch(() => ({}))) as { challengeId?: unknown; count?: unknown };
  const challengeId = typeof b.challengeId === "string" ? b.challengeId : "";
  const count = Math.min(40, Math.max(5, Number(b.count) || 20));
  const { data: c } = await sb.from("challenges").select("id, kind, subject, grade_min, grade_max, status").eq("id", challengeId).maybeSingle();
  if (!c || c.kind !== "practice") return json(404, "That competition wasn't found.");
  if (c.status !== "draft") return json(400, "Change questions only before the competition opens.");
  const { data: have } = await sb.from("challenge_questions").select("n, question").eq("challenge_id", c.id).order("n");
  const existing = (have as { n: number; question: string }[] | null) ?? [];

  try {
    const client = new Anthropic({ apiKey });
    const ask = async (system: string, schema: Record<string, unknown>, content: string) => {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content }],
      });
      return JSON.parse(res.content.map((x) => (x.type === "text" ? x.text : "")).join(""));
    };
    const written = (await ask(WRITE_SYSTEM, WRITE_SCHEMA,
      `Class: ${c.subject}. Grades ${c.grade_min} to ${c.grade_max}. Write ${count} questions.` +
      (existing.length ? `\nAlready in the set (don't repeat these):\n${existing.map((q) => `- ${q.question}`).join("\n")}` : ""),
    )).questions as Item[];
    const good = written.filter((q) => q.options?.length === 4 && new Set(q.options).size === 4 && q.answer_index >= 0 && q.answer_index < 4 && q.question?.trim().length >= 5);
    if (good.length === 0) return json(502, "The AI didn't write usable questions. Please try again.");

    // Second pass: solve without the key; keep only questions where both agree.
    const solved = (await ask(SOLVE_SYSTEM, SOLVE_SCHEMA,
      good.map((q, i) => `${i}. ${q.question}\n${q.options.map((o, j) => `   ${j}) ${o}`).join("\n")}`).join("\n\n"),
    )).answers as { i: number; choice: number }[];
    const agreed = good.filter((q, i) => solved.find((s) => s.i === i)?.choice === q.answer_index);

    const start = (existing.at(-1)?.n ?? 0) + 1;
    const rows = agreed.map((q, i) => ({
      challenge_id: c.id, n: start + i, topic: q.topic.slice(0, 60), level: [3, 4, 5].includes(q.level) ? q.level : 4,
      question: q.question.slice(0, 1000), options: q.options, answer_index: q.answer_index, explanation: q.explanation?.slice(0, 1000) ?? null, status: "pending",
    }));
    if (rows.length) {
      const { error } = await sb.from("challenge_questions").insert(rows);
      if (error) return json(500, error.message);
    }
    return Response.json({ added: rows.length, dropped: good.length - rows.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("challenge questions failed", err);
    return json(502, "Sorry, the AI couldn't write questions this time. Please try again in a minute.");
  }
}

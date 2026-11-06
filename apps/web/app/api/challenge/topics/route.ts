import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Team only: AI ideas for new essay challenges, for any subject and grade group.
// Our team picks one, edits it and saves it as a draft; nothing is published by itself.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-haiku-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: { type: "string" },
          title: { type: "string" },
          prompt: { type: "string" },
          tips: { type: "string" },
        },
        required: ["subject", "title", "prompt", "tips"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

const SYSTEM = `You write topics for a US student essay contest run inside a college and career planning app. You'll get a subject (or "every subject"), a grade range and maybe a theme or season.

Give 6 original contest ideas. For each:
- subject: a short school subject name (for example Science, History, Math in real life, English, Careers and trades, Animals and agriculture, Technology, Health, Arts, Money and life skills, Community and service).
- title: a short, fun contest name (max 8 words), e.g. "The Invention That Changed My Day".
- prompt: the topic in 1 to 3 plain sentences, right for the grade range, that a student can answer from their own life, ideas and what they learned in school. No outside research needed.
- tips: 2 or 3 short tips, one per line, that help students start without telling them what to write.

Rules: original wording (never copy known contests or test questions). Fair for every student whatever their family's money, background or beliefs. Avoid party politics, religion debates, and anything that asks for private family details, trauma or health information. Keep it positive and doable. When "every subject" is asked, give 6 different subjects.`;

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

  const b = (await req.json().catch(() => ({}))) as { subject?: unknown; gradeMin?: unknown; gradeMax?: unknown; theme?: unknown };
  const subject = typeof b.subject === "string" && b.subject.trim() ? b.subject.trim().slice(0, 60) : "every subject";
  const gMin = Math.min(12, Math.max(6, Number(b.gradeMin) || 9));
  const gMax = Math.min(12, Math.max(gMin, Number(b.gradeMax) || 12));
  const theme = typeof b.theme === "string" ? b.theme.trim().slice(0, 200) : "";

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Subject: ${subject}\nGrades: ${gMin} to ${gMax}\n${theme ? `Theme or season: ${theme}` : "No theme."}` }],
    });
    const text = res.content.map((x) => (x.type === "text" ? x.text : "")).join("");
    return Response.json(JSON.parse(text), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("challenge topics failed", err);
    return json(502, "Sorry, no ideas this time. Please try again in a minute.");
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../lib/ai-consent";
import { aiDailyLimit } from "../../../lib/ai-limit";
import { aiOffMessage } from "../../../lib/ai-off";

// Turns a photo or PDF of the student's own draft (handwritten or printed)
// into text for the essay box, word for word. It types out; it never fixes,
// finishes or improves anything. Costs one of the day's AI uses.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const MAX_FILE_CHARS = 3_500_000;
const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    unclear_words: { type: "integer" },
    is_writing: { type: "boolean" },
  },
  required: ["text", "unclear_words", "is_writing"],
  additionalProperties: false,
};

const SYSTEM = `You type out a student's own draft from a photo or PDF, exactly as written, so they can keep working on it in the app.

- text: the writing, word for word, with the student's paragraphs kept (a blank line between paragraphs). Keep every spelling, grammar and punctuation mistake exactly as written. Do not correct, improve, reword, shorten, finish or add anything. Do not add a title or comments. Leave out crossed-out words. Write [?] for any word you can't read.
- unclear_words: how many [?] you wrote.
- is_writing: false if the image has no paragraphs of writing (for example a math worksheet or a photo of something else); then text is "".`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "Reading photos isn't switched on yet. Type or paste your draft instead.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { studentId?: unknown; file?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  if (!studentId) return json(400, "Pick a student first.");
  const m = typeof body.file === "string" ? /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(body.file) : null;
  if (!m || m[2]!.length > MAX_FILE_CHARS) return json(400, "That photo or file didn't work. Try a smaller one, or only the pages of your draft.");
  const mediaType = m[1] as "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");
  const { data: st } = await sb.from("students").select("id").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");

  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? aiOffMessage(turn.error) : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          mediaType === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: m[2]! } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data: m[2]! } },
          { type: "text", text: "Type out my draft exactly as written." },
        ],
      }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, that file couldn't be read.");
    const out = JSON.parse(res.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as { text: string; unclear_words: number; is_writing: boolean };
    if (!out.is_writing || !out.text.trim()) return json(422, "No writing was found in that photo. Take a clear, close photo of your draft in good light.");
    return Response.json({ text: out.text.trim().slice(0, 20000), unclear: Math.max(0, out.unclear_words | 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("read writing failed", err);
    return json(502, "Sorry, the photo couldn't be read. Please try again in a minute, or type your draft.");
  }
}

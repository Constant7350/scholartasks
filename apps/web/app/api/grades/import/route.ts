import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";
import { aiOffMessage } from "../../../../lib/ai-off";

// Reads a report card or transcript (photo or PDF) and returns the courses it
// finds. Nothing is saved here: the family checks the list and saves it
// themselves, and the database rules decide who may save grades.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const MAX_BYTES = 3_000_000; // base64 must stay under Vercel's 4.5 MB request limit
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          course: { type: "string" },
          grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
          original_grade: { type: "string" },
          level: { type: "string", enum: ["standard", "honors", "AP", "IB", "DE"] },
          core: { type: "boolean" },
          grade_level: { type: "integer", enum: [6, 7, 8, 9, 10, 11, 12] },
          term: { type: "string", enum: ["Fall", "Spring", "Full year", "Summer"] },
        },
        required: ["course", "grade", "original_grade", "level", "core", "grade_level", "term"],
        additionalProperties: false,
      },
    },
    note: { type: "string" },
  },
  required: ["courses", "note"],
  additionalProperties: false,
};

const SYSTEM = `You read US high school report cards and transcripts (mostly from the Southeast) and list each course with a final or current grade.

For each course:
- course: the course name as written, with abbreviations expanded where obvious (e.g. "AP BIO" becomes "AP Biology").
- original_grade: exactly what the document shows (e.g. "93", "A-", "B+").
- grade: the letter. Number grades use 90-100 A, 80-89 B, 70-79 C, 60-69 D, below 60 F. Drop plus and minus (B+ is B).
- level: AP, IB, DE (dual enrollment or college courses), honors (Honors, H, Hon, Gifted, Accelerated), otherwise standard.
- core: true for English, math, science, social studies/history/government/economics and world languages; false for everything else (PE, health, arts, electives, career courses).
- grade_level: the school grade when taken (9 to 12, or 6 to 8 for middle school). If the document shows a school year instead, work it out from the student's current grade given below; if unclear, use the student's current grade.
- term: Fall, Spring, Full year or Summer (semester 1 is Fall, semester 2 is Spring; a single year-end grade is Full year).

Skip rows without a grade (in progress with no grade yet, pass/fail, conduct, attendance, GPA totals). If the image isn't a report card or transcript, or is unreadable, return no courses and say why in note. Otherwise use note for anything the family should double-check (e.g. "Grades were numbers and were converted to letters."), or leave it empty.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "Reading report cards isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; mediaType?: unknown; data?: unknown };
  try { body = await req.json(); } catch { return json(400, "That file is too large. Try a smaller photo or a PDF under 3 MB."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const mediaType = typeof body.mediaType === "string" ? body.mediaType : "";
  const data = typeof body.data === "string" ? body.data : "";
  const isPdf = mediaType === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(mediaType);
  if (!studentId || !data || (!isPdf && !isImage)) return json(400, "Please choose a photo (JPG or PNG) or a PDF.");
  if (data.length * 0.75 > MAX_BYTES) return json(413, "That file is too large. Try a smaller photo or a PDF under 3 MB.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  const { data: student } = await sb.from("students").select("id, grade_level, permissions").eq("id", studentId).maybeSingle();
  if (!student) return json(403, "You don't have access to this student.");

  // Reading a document counts as one counselor message toward today's limit.
  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? aiOffMessage(turn.error) : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const doc = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as (typeof IMAGE_TYPES)[number], data } };

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: [doc, { type: "text", text: `The student is currently in grade ${(student as { grade_level: number }).grade_level}. List the courses.` }] }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, that document couldn't be read. Try a clearer photo.");
    if (res.stop_reason === "max_tokens") return json(422, "That document has too many courses to read at once. Try one page or one year at a time.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const out = JSON.parse(text) as { courses: unknown[]; note: string };
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("grade import failed", e);
    return json(502, "Sorry, reading the document failed. Please try again in a minute.");
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { limitReached } from "../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../lib/ai-consent";
import { aiDailyLimit } from "../../../lib/ai-limit";
import { HOMEWORK_DAILY_LIMIT, HOMEWORK_MONTHLY_LIMIT, PAYWALL_ON } from "../../../lib/prices";
import { CHECKER_RULES, HELPER_RULES, HELP_TYPES, SAFE_FALLBACK, gradeBand, subjectById, type HelpType } from "../../../lib/homework";

// Homework Helper. Every reply is written by the helper model, then read by a
// separate checker model before the student sees it: a reply that gives away
// an answer, does a step, or contains hand-in text is rewritten once, and if it
// fails again the student gets a safe guiding question instead. A one-line
// summary (never the chat itself) is saved for the parent's view.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const CHECKER = "claude-haiku-5-5";
const MAX_TURNS = 16;
const MAX_CHARS = 4000;
const MAX_IMAGE_BYTES = 3_500_000; // base64 characters; the page shrinks photos well below this

const json = (status: number, error: string) => Response.json({ error }, { status });

interface Turn { role: "user" | "assistant"; content: string }
interface Draft {
  reply: string; help_type: HelpType; hints_this_problem: number; solved: boolean;
  said_no: "none" | "answer" | "writing" | "test" | "other"; safety: boolean;
  topic: string; problem_text: string; parent_note: string;
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    help_type: { type: "string", enum: [...HELP_TYPES] },
    hints_this_problem: { type: "integer" },
    solved: { type: "boolean" },
    said_no: { type: "string", enum: ["none", "answer", "writing", "test", "other"] },
    safety: { type: "boolean" },
    topic: { type: "string" },
    problem_text: { type: "string" },
    parent_note: { type: "string" },
  },
  required: ["reply", "help_type", "hints_this_problem", "solved", "said_no", "safety", "topic", "problem_text", "parent_note"],
  additionalProperties: false,
};

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    pass: { type: "boolean" },
    problem: { type: "string", enum: ["none", "final_answer", "next_step", "hand_in_text", "test_help"] },
    fix: { type: "string" },
  },
  required: ["pass", "problem", "fix"],
  additionalProperties: false,
};

function textOf(res: { content: { type: string; text?: string }[] }): string {
  return res.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
}

async function studentContext(sb: SupabaseClient, studentId: string): Promise<{ name: string; text: string } | null> {
  const { data: st } = await sb.from("students").select("first_name, grade_level").eq("id", studentId).maybeSingle();
  if (!st) return null;
  const s = st as { first_name: string; grade_level: number };
  const { data: g } = await sb.from("course_grades").select("course, level, grade, grade_level").eq("student_id", studentId).order("created_at", { ascending: false }).limit(20);
  const courses = ((g as { course: string; level: string; grade: string; grade_level: number }[]) ?? [])
    .filter((c) => c.grade_level === s.grade_level)
    .map((c) => `${c.course}${c.level !== "standard" ? ` (${c.level})` : ""}: ${c.grade}`);
  const lines = [
    `The student is in grade ${s.grade_level}. ${gradeBand(s.grade_level)}`,
    courses.length ? `Classes this year with latest grades: ${courses.join("; ")}. Be extra patient in classes with a C or lower.` : "",
  ];
  return { name: s.first_name, text: lines.filter(Boolean).join("\n") };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The Homework Helper isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; subject?: unknown; messages?: unknown; image?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  if (!studentId) return json(400, "Pick a student first.");
  const subject = subjectById(typeof body.subject === "string" ? body.subject : null);
  const messages = Array.isArray(body.messages) ? (body.messages as Turn[]).slice(-MAX_TURNS) : [];
  while (messages.length && messages[0]!.role !== "user") messages.shift();
  const valid =
    messages.length > 0 && messages[messages.length - 1]!.role === "user" &&
    messages.every((m, i) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0 && m.content.length <= MAX_CHARS && (i === 0 || m.role !== messages[i - 1]!.role));
  if (!valid) return json(400, "Messages must be under 4,000 characters.");
  let image: { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } | null = null;
  if (typeof body.image === "string" && body.image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if (!m || m[2]!.length > MAX_IMAGE_BYTES) return json(400, "That photo didn't work. Try a smaller photo, or type the problem.");
    image = { media_type: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2]! };
  }

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  // The add-on (billing kind "study_coach") gives its own, larger limits; everyone else uses the day's AI uses.
  const plan = await sb.rpc("my_plan", { p_student: studentId });
  const addon = !plan.error && !!(plan.data as { study_coach: boolean }[] | null)?.[0]?.study_coach;
  const daily = addon ? HOMEWORK_DAILY_LIMIT : await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("homework_take_turn", { p_student: studentId, p_addon: addon, p_daily: daily, p_monthly: HOMEWORK_MONTHLY_LIMIT });
  if (turn.error) {
    if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
    if (turn.error.code === "PGRST202" || turn.error.code === "42883") return json(503, "The Homework Helper needs the latest database update first.");
    if (/helper turned off/.test(turn.error.message)) return json(403, "A parent has turned off the Homework Helper for your account.");
    if (/not allowed/.test(turn.error.message)) return json(403, "AI help is turned off for this student. A parent can turn on AI chat in Family and permissions.");
    return json(500, "Something went wrong. Please try again.");
  }
  if (turn.data === false) {
    return json(429, addon
      ? `You've used today's ${daily} Homework Helper turns (or the family's ${HOMEWORK_MONTHLY_LIMIT} this month). They reset at midnight, or a parent can add a message pack on the Plan and billing page.`
      : limitReached(daily, "AI uses") + (PAYWALL_ON ? " The Homework Helper add-on gives up to 30 helper turns a day." : ""));
  }

  const ctx = await studentContext(sb, studentId);
  if (!ctx) return json(403, "You don't have access to this student.");

  // The long fixed rules come first and are cached; the per-student parts follow.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: HELPER_RULES, cache_control: { type: "ephemeral" } },
    { type: "text", text: `SUBJECT RULES\n${subject.rules}\n\nABOUT THIS STUDENT\n${ctx.text}` },
  ];
  const last = messages[messages.length - 1]!;
  const history: Anthropic.MessageParam[] = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  history.push({
    role: "user",
    content: image
      ? [{ type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } }, { type: "text", text: last.content }]
      : last.content,
  });

  const client = new Anthropic({ apiKey });
  const write = async (extra?: string): Promise<Draft | null> => {
    const request = {
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: DRAFT_SCHEMA } },
      system: extra ? [...system, { type: "text" as const, text: extra }] : system,
      messages: history,
    };
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) res = await client.beta.messages.create(request);
      else throw e;
    }
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    return JSON.parse(textOf(res)) as Draft;
  };
  const check = async (draft: Draft): Promise<{ pass: boolean; fix: string }> => {
    const recent = messages.slice(-4).map((m) => `${m.role === "user" ? "STUDENT" : "TUTOR"}: ${m.content}`).join("\n\n");
    try {
      const res = await client.messages.create({
        model: CHECKER,
        max_tokens: 1000,
        output_config: { effort: "low", format: { type: "json_schema", schema: CHECK_SCHEMA } },
        system: CHECKER_RULES,
        messages: [{ role: "user", content: `<subject>${subject.label}</subject>\n<conversation>\n${recent}\n</conversation>${draft.problem_text ? `\n<problem_from_photo>${draft.problem_text}</problem_from_photo>` : ""}\n<draft_reply>\n${draft.reply}\n</draft_reply>` }],
      });
      if (res.stop_reason !== "end_turn") return { pass: false, fix: "Ask a guiding question instead." };
      const out = JSON.parse(textOf(res)) as { pass: boolean; fix: string };
      return { pass: out.pass, fix: out.fix };
    } catch (e) {
      // If the checker can't run, don't let an unchecked reply through.
      console.error("homework checker failed", e);
      return { pass: false, fix: "Ask a guiding question instead." };
    }
  };

  let draft: Draft | null;
  let rewritten = false;
  try {
    draft = await write();
    if (!draft) return json(422, "Sorry, the helper can't help with that one. Try asking about the schoolwork another way.");
    let verdict = await check(draft);
    if (!verdict.pass) {
      rewritten = true;
      const again = await write(`IMPORTANT: your previous draft was not allowed because it did the student's work. ${verdict.fix} Write a new reply that keeps the student doing every step: give a hint or ask a guiding question instead.`);
      verdict = again ? await check(again) : { pass: false, fix: "" };
      draft = again && verdict.pass ? again : { ...draft, reply: SAFE_FALLBACK, help_type: "question", solved: false };
    }
  } catch (e) {
    console.error("homework helper failed", e);
    return json(502, "Sorry, the helper couldn't answer. Please try again in a minute.");
  }

  const final = draft;
  const saidNo = final.said_no === "none" ? null : final.said_no;
  const save = async () => {
    const { error } = await sb.rpc("homework_log_add", {
    p_student: studentId, p_subject: subject.label, p_topic: final.topic.slice(0, 120), p_help: final.help_type,
    p_hints: final.hints_this_problem, p_solved: final.solved, p_said_no: saidNo, p_safety: final.safety,
      p_note: final.parent_note.slice(0, 300),
    });
    if (error) console.error("homework log failed", error.message);
  };
  try { after(save); } catch { await save(); }

  return Response.json({
    reply: final.reply,
    help_type: final.help_type,
    hints: Math.max(0, Math.min(20, final.hints_this_problem | 0)),
    solved: final.solved,
    said_no: saidNo,
    safety: final.safety,
    problem_text: final.problem_text.slice(0, 300),
    checked: true,
    rewritten,
  }, { headers: { "Cache-Control": "no-store" } });
}

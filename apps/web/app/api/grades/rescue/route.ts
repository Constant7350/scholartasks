import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { CHECKIN, cleanAnswers, type RescuePlan } from "../../../grades/rescue-questions";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";
import { aiLanguageNote } from "../../../../lib/lang";
import { aiOffMessage } from "../../../../lib/ai-off";

// Grade rescue: the student answers a short check-in about one class, and the
// AI drafts a step-by-step plan to bring the grade back up. The plan is saved
// so the family can check steps off. It coaches; it never does the work.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const GRADES = ["A", "B", "C", "D", "F"];
const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    likely_causes: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          when: { type: "string", enum: ["Today", "This week", "Next 2 weeks", "Every week"] },
          action: { type: "string" },
          why: { type: "string" },
        },
        required: ["when", "action", "why"],
        additionalProperties: false,
      },
    },
    talk_to_teacher: { type: "string" },
    parent_tip: { type: "string" },
    study_tips: { type: "array", items: { type: "string" } },
    check_back_days: { type: "integer", enum: [7, 14, 21] },
  },
  required: ["summary", "likely_causes", "steps", "talk_to_teacher", "parent_tip", "study_tips", "check_back_days"],
  additionalProperties: false,
};

const SYSTEM = `You are a caring, practical academic coach for a US middle or high school student (mostly in the Southeast). A grade has slipped below the standard the family set. From the student's check-in answers, find the most likely causes and write a short plan they can actually follow.

- summary: two or three warm, honest sentences to the student ("you"), without blame.
- likely_causes: 1 to 3 short causes, based only on their answers.
- steps: 4 to 7 concrete steps, most important first. Each has when (Today, This week, Next 2 weeks or Every week), action (one specific thing, e.g. "Ask your teacher which missing assignments can still be turned in"), and why (one sentence). Include missing work first if they have any, a talk with the teacher if they haven't had one, and a weekly study routine that fits the time they said they have. Use proven methods: practice testing, spaced review, working problems before looking at answers, explaining a topic out loud.
- talk_to_teacher: two or three sentences the student could say to the teacher, in their own voice.
- parent_tip: one or two sentences on how a parent can help without taking over.
- study_tips: 2 or 3 short tips matched to how they said they learn best.
- check_back_days: 7 if the grade is D or F or a test is this week, otherwise 14 (21 only if nothing is due soon).

Never do the student's homework, projects or test answers, and never offer to. You coach how to learn. Keep it encouraging; this is advice only, and the family and teacher know the student best. If the answers mention feeling hopeless, being unsafe or being hurt, gently suggest talking with a parent, school counselor or a trusted adult right away.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "Grade check-ins aren't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; course?: unknown; grade?: unknown; answers?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const course = typeof body.course === "string" ? body.course.trim().slice(0, 120) : "";
  const grade = typeof body.grade === "string" && GRADES.includes(body.grade) ? body.grade : "";
  const answers = cleanAnswers(body.answers);
  if (!studentId || !course || !grade) return json(400, "Pick the class you want a plan for.");
  if (answers.struggles.length === 0) return json(400, "Pick at least one thing that's making this class hard.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  const { data: st } = await sb.from("students").select("*").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");
  const student = st as { first_name: string; grade_level: number; goal_gpa?: number | null; min_grade?: string | null };

  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? aiOffMessage(turn.error) : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const label = (id: string, v: string) => CHECKIN.find((q) => q.id === id)?.options.find((o) => o.v === v)?.label ?? v;
  const context = [
    `Student: ${student.first_name}, grade ${student.grade_level}.`,
    `Class: ${course}. Current grade: ${grade}. The family's standard: at least ${student.min_grade ?? "B"} in core classes; GPA goal ${student.goal_gpa != null ? Number(student.goal_gpa).toFixed(1) : "3.0 (state scholarship, default)"}.`,
    `What's hard: ${answers.struggles.map((v) => label("struggles", v)).join("; ")}.`,
    `Missing assignments: ${label("missing", answers.missing)}.`,
    `Time spent on this class outside school each week: ${label("hours", answers.hours)}.`,
    `Next test or big assignment: ${label("next_due", answers.next_due)}.`,
    `Talked with the teacher about the grade: ${label("talked_teacher", answers.talked_teacher)}.`,
    `Learns best with: ${answers.learns_best.map((v) => label("learns_best", v)).join("; ") || "not sure"}.`,
    answers.note ? `In their own words: ${answers.note}` : "",
  ].filter(Boolean).join("\n");

  let plan: RescuePlan;
  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM + aiLanguageNote(req),
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, a plan isn't available for this. Try the AI counselor instead.");
    if (res.stop_reason === "max_tokens") return json(422, "Sorry, the plan came out too long. Please try again.");
    plan = JSON.parse(res.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as RescuePlan;
  } catch (e) {
    console.error("rescue plan failed", e);
    return json(502, "Sorry, the plan couldn't be made. Please try again in a minute.");
  }

  const checkBack = new Date(Date.now() + plan.check_back_days * 864e5).toISOString().slice(0, 10);
  const { data: saved, error: saveErr } = await sb.from("rescue_plans")
    .insert({ student_id: studentId, course, grade, answers, plan, check_back: checkBack })
    .select("id, course, grade, plan, done_steps, status, check_back, created_at").single();
  // Before the database update runs, still show the plan; it just isn't saved.
  if (saveErr) return Response.json({ id: null, course, grade, plan, done_steps: [], status: "active", check_back: checkBack, created_at: new Date().toISOString(), unsaved: true });
  return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { checkPlan, primaryGpa, type CourseLevel, type PlanCourse } from "@scholartasks/core";
import { packFor } from "../../../../lib/state-packs";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";
import { subjectOf } from "../../../grades/courses";
import { aiLanguageNote } from "../../../../lib/lang";
import { aiOffMessage } from "../../../../lib/ai-off";

// AI check of a student's four-year course plan. Reads the saved plan and
// grades, adds the rules check from core, and returns advice. Nothing is saved.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    years: { type: "array", items: { type: "object", properties: { grade: { type: "integer" }, note: { type: "string" } }, required: ["grade", "note"], additionalProperties: false } },
    suggestions: { type: "array", items: { type: "string" } },
    questions_for_counselor: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "years", "suggestions", "questions_for_counselor"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The plan check isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { studentId?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  if (!studentId) return json(400, "Pick a student first.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");
  const { data: st } = await sb.from("students").select("first_name, state, grade_level, goal_gpa").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");
  const student = st as { first_name: string; state: string; grade_level: number; goal_gpa: number | null };

  const [p, g] = await Promise.all([
    sb.from("course_plan").select("grade_level, course, subject, level, credits").eq("student_id", studentId),
    sb.from("course_grades").select("course, grade, level, grade_level").eq("student_id", studentId).gte("grade_level", 9),
  ]);
  const planned = (p.data as { grade_level: number; course: string; subject: string | null; level: CourseLevel; credits: number }[]) ?? [];
  const taken = (g.data as { course: string; grade: string; level: CourseLevel; grade_level: number }[]) ?? [];
  if (!planned.length && !taken.length) return json(400, "Add some classes to the plan first.");

  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? aiOffMessage(turn.error) : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const pack = packFor(student.state);
  const main = primaryGpa(pack);
  const all: PlanCourse[] = [
    ...taken.map((t) => ({ grade: t.grade_level, course: t.course, subject: subjectOf(t.course)?.name ?? null, level: t.level, done: true })),
    ...planned.map((r) => ({ grade: r.grade_level, course: r.course, subject: r.subject, level: r.level, credits: Number(r.credits) })),
  ];
  const check = checkPlan(all, { state: student.state, rigorNeeded: main?.rigorNeeded, rigorLevels: main?.program.rules.rigor_levels });

  const context = [
    `Student: ${student.first_name}, now in grade ${student.grade_level}, state ${student.state}. GPA goal: ${student.goal_gpa ?? "not set"}.`,
    main ? `State scholarship: ${main.program.name} needs a ${main.target} ${main.label}${main.rigorNeeded ? ` and ${main.rigorNeeded} rigor courses (${main.program.rules.rigor_levels?.join(", ")})` : ""}.` : "No grade-based state scholarship in ScholarTasks for this state.",
    `Rules check (${check.rules.label}): ` + check.lines.map((l) => `${l.label} ${l.planned}/${l.needed}`).join("; ") + `. Rigor ${check.rigorPlanned}/${check.rigorNeeded}. Same world language years: ${check.sameLanguageYears}.`,
    check.warnings.length ? "Warnings: " + check.warnings.join(" ") : "",
    "Taken (with grades):\n" + (taken.map((t) => `- Grade ${t.grade_level}: ${t.course} (${t.level}) ${t.grade}`).join("\n") || "none"),
    "Planned:\n" + (planned.map((r) => `- Grade ${r.grade_level}: ${r.course} (${r.level}, ${r.subject ?? "elective"}, ${r.credits} credit)`).join("\n") || "none"),
  ].filter(Boolean).join("\n");

  const system = `You check a U.S. high school student's four-year course plan for their family. Use the rules check given (don't recount credits yourself). Look at: whether the plan meets graduation and the state scholarship's rigor courses in time, whether rigor rises sensibly year by year given their grades so far, workload balance, a math and science path that suits their goals, and a world language for four-year colleges.
- summary: two or three plain, encouraging, honest sentences.
- years: one short note for each grade that has classes.
- suggestions: up to 4 specific ideas (e.g. "Move AP Biology to grade 11 after Honors Chemistry").
- questions_for_counselor: up to 3 short questions (what the school offers, prerequisites, dual enrollment).
Never invent the school's course offerings; say "if your school offers it". This is advice only; the family and school counselor decide.`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: system + aiLanguageNote(req),
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return json(422, "Sorry, the plan couldn't be checked this time. Try again later.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json(JSON.parse(text), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("plan check failed", e);
    return json(502, "Sorry, the plan couldn't be checked. Please try again in a minute.");
  }
}

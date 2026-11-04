import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { buildScorecard, displayGpa, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../../../../packs/states/GA.json";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";

// Advice on next year's classes: the student lists the courses they're
// considering, and the AI weighs their goal, grades and HOPE's rigor rule.
// Advice only; nothing is saved and the family decides.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GA = gaPack as unknown as StatePack;
const MODEL = "claude-sonnet-5-5";
const LEVELS = ["standard", "honors", "AP", "IB", "DE"] as const;

const json = (status: number, error: string) => Response.json({ error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          course: { type: "string" },
          planned_level: { type: "string", enum: [...LEVELS] },
          suggested_level: { type: "string", enum: [...LEVELS] },
          fit: { type: "string", enum: ["good fit", "stretch", "reconsider"] },
          reason: { type: "string" },
        },
        required: ["course", "planned_level", "suggested_level", "fit", "reason"],
        additionalProperties: false,
      },
    },
    rigor_note: { type: "string" },
    workload_note: { type: "string" },
    questions_for_counselor: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "courses", "rigor_note", "workload_note", "questions_for_counselor"],
  additionalProperties: false,
};

const SYSTEM = `You help a Georgia high school family choose next year's classes and their level (standard, honors, AP, IB, dual enrollment).

Weigh, for each planned course: the student's grades in that subject so far, the family's GPA goal and grade standard, the HOPE rules (HOPE GPA from core classes in grades 9-12; AP, IB and dual enrollment add 0.5 to B-F grades; honors gets nothing extra; HOPE and Zell Miller need 4 rigor courses before graduation), and the total workload (several AP classes at once is a heavy year).

- fit: "good fit" if the level matches their record, "stretch" if it's harder but reachable with effort, "reconsider" if it's likely to pull the GPA below their goal or the workload is too heavy.
- suggested_level: the level you'd suggest; it can equal planned_level.
- reason: one or two plain sentences that point to their actual grades.
- rigor_note: where they stand on the 4 rigor courses and whether this plan gets them there in time.
- workload_note: one or two sentences on the overall load.
- summary: two or three sentences, encouraging and honest.
- questions_for_counselor: up to 3 short questions to ask the school counselor (prerequisites, what the school offers, dual enrollment options).

Respect the family's goal; if it's below what a scholarship needs, say so kindly. This is advice only: the family and the school counselor make the final decision. Never invent course offerings at their school.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "Course advice isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; courses?: unknown; nextGrade?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const nextGrade = typeof body.nextGrade === "number" && body.nextGrade >= 8 && body.nextGrade <= 12 ? body.nextGrade : null;
  const planned = Array.isArray(body.courses)
    ? body.courses
        .filter((c): c is { course: string; level: string } => !!c && typeof c.course === "string" && typeof c.level === "string")
        .map((c) => ({ course: c.course.trim().slice(0, 120), level: (LEVELS as readonly string[]).includes(c.level) ? c.level : "standard" }))
        .filter((c) => c.course)
        .slice(0, 12)
    : [];
  if (!studentId || planned.length === 0) return json(400, "Add at least one course you're thinking about.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  const { data: st } = await sb.from("students").select("*").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");
  const student = st as { first_name: string; grade_level: number; sat: number | null; act: number | null; goal_gpa?: number | null; min_grade?: string | null };

  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? "AI features are turned off for this student. A parent can turn on AI chat in Family and permissions." : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  const { data: gr } = await sb.from("course_grades").select("course, grade, level, core, grade_level, term").eq("student_id", studentId).order("grade_level");
  const rows = (gr as { course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string }[]) ?? [];
  const grades: CourseGrade[] = rows.map((r) => ({ term: r.term, course: r.course, grade: r.grade, level: r.level, core: r.core, gradeLevel: r.grade_level }));
  const goal = student.goal_gpa != null ? Number(student.goal_gpa) : 3;
  const card = buildScorecard(grades, { currentGrade: student.grade_level, formula: GA.gpa_formulas.ga_hope_gpa!, target: goal, rigorNeeded: 4, minGrade: (student.min_grade ?? "B") as CourseGrade["grade"] });

  const context = [
    `Student: ${student.first_name}, now in grade ${student.grade_level}; planning grade ${nextGrade ?? Math.min(12, student.grade_level + 1)}.`,
    `Goal: HOPE GPA ${goal.toFixed(1)}${student.goal_gpa == null ? " (default, not set by the family)" : ""}; lowest grade they're OK with in a core class: ${student.min_grade ?? "B"}.`,
    `Current HOPE GPA: ${card.stateGpa === null ? "no core grades yet" : displayGpa(card.stateGpa)}. Rigor courses so far: ${card.rigorDone} of 4.`,
    `Test scores: SAT ${student.sat ?? "none"}, ACT ${student.act ?? "none"}.`,
    rows.length ? "Grades so far:\n" + rows.map((r) => `- Grade ${r.grade_level} ${r.term}: ${r.course} (${r.level}${r.core ? ", core" : ""}) ${r.grade}`).join("\n") : "No grades saved yet.",
    "Planned courses:\n" + planned.map((c) => `- ${c.course} (${c.level})`).join("\n"),
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal") return json(422, "Sorry, advice isn't available for this plan. Try the AI counselor instead.");
    if (res.stop_reason === "max_tokens") return json(422, "That plan is too long to review at once. Try fewer courses.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json(JSON.parse(text), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("course advice failed", e);
    return json(502, "Sorry, the advice couldn't be loaded. Please try again in a minute.");
  }
}

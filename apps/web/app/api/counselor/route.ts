import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { displayGpa, evaluateStatePrograms, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../../../packs/states/GA.json";

// AI counselor chat. The browser sends the signed-in person's Supabase token;
// every read below runs under that token, so row-level security decides what
// the AI may see. ANTHROPIC_API_KEY is set in Vercel and never reaches the browser.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GA = gaPack as unknown as StatePack;
const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = 50;
const MAX_TURNS = 20;
const MAX_CHARS = 4000;

interface ChatMessage { role: "user" | "assistant"; content: string }
interface Student {
  id: string; first_name: string; birth_date: string; grade_level: number; state: string;
  sat: number | null; act: number | null; income_band: string | null; permissions: Record<string, boolean>;
}

const json = (status: number, error: string) => Response.json({ error }, { status });

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function age(birth: string, today: string): number {
  const [by, bm, bd] = birth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Reads a table, treating "table not created yet" as empty so the chat still works. */
async function rows<T>(q: PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error && error.code !== "PGRST205" && error.code !== "42P01") throw new Error("Could not load your plan.");
  return (data as T[]) ?? [];
}

async function studentContext(sb: SupabaseClient, s: Student, isParent: boolean, today: string): Promise<string> {
  const [grades, colleges, tasks] = await Promise.all([
    rows<{ term: string; course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number }>(
      sb.from("course_grades").select("term, course, grade, level, core, grade_level").eq("student_id", s.id).order("grade_level"),
    ),
    rows<{ name: string; plan: string; deadline: string | null; status: string; notes: string | null }>(
      sb.from("student_colleges").select("name, plan, deadline, status, notes").eq("student_id", s.id).order("deadline"),
    ),
    rows<{ title: string; kind: string | null; due_on: string | null; status: string; amount: number | null }>(
      sb.from("tasks").select("title, kind, due_on, status, amount").eq("student_id", s.id).order("due_on"),
    ),
  ]);

  const lines: string[] = [
    `Student: ${s.first_name}, age ${age(s.birth_date, today)}, grade ${s.grade_level}, lives in ${s.state}.`,
    `Test scores: SAT ${s.sat ?? "not entered"}, ACT ${s.act ?? "not entered"}.`,
  ];
  if (isParent || s.permissions?.see_income_and_costs) {
    lines.push(`Family income band: ${s.income_band ?? "not entered"}.`);
  }

  if (s.state === GA.state) {
    const cg: CourseGrade[] = grades.map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level }));
    const results = evaluateStatePrograms({ state: s.state, gradeLevel: s.grade_level, grades: cg, sat: s.sat ?? undefined, act: s.act ?? undefined }, GA);
    lines.push("Georgia scholarship check (from the grades saved in ScholarTasks; the official HOPE GPA is calculated by GSFC):");
    for (const r of results) {
      const gpa = r.gpa === null ? "no core grades saved" : `GPA ${displayGpa(r.gpa)}`;
      lines.push(`- ${r.programName}: ${r.status === "eligible" ? "meets every rule" : "not yet"} (${gpa})${r.gaps.length ? ". " + r.gaps.map((g) => g.message).join(" ") : ""}`);
    }
  }

  lines.push(
    grades.length
      ? "Saved courses:\n" + grades.map((g) => `- Grade ${g.grade_level} ${g.term}: ${g.course} (${g.level}${g.core ? ", core" : ""}) ${g.grade}`).join("\n")
      : "Saved courses: none yet.",
  );
  lines.push(
    colleges.length
      ? "College list:\n" + colleges.map((c) => `- ${c.name}: ${c.plan}, deadline ${c.deadline ?? "not set"}, status ${c.status}${c.notes ? `, notes: ${c.notes}` : ""}`).join("\n")
      : "College list: empty.",
  );
  lines.push(
    tasks.length
      ? "Scholarships and other deadlines:\n" + tasks.map((t) => `- ${t.title} (${t.kind ?? "other"}): due ${t.due_on ?? "no date"}, ${t.status}${t.amount ? `, $${t.amount}` : ""}`).join("\n")
      : "Scholarships and other deadlines: none saved.",
  );
  return lines.join("\n");
}

function systemPrompt(talkingTo: "parent" | "student", context: string, today: string): string {
  const pack = GA;
  const deadlines = pack.deadlines.map((d) => `- ${d.date}: ${d.title} (${d.where})`).join("\n");
  const programs = pack.programs.map((p) => `- ${p.name}: ${p.summary} ${p.award?.summary ?? ""} Source: ${p.source_url}`).join("\n");
  return `You are the ScholarTasks counselor, a warm, practical college and financial-aid advisor for families. Today is ${today}.

You are talking with the student's ${talkingTo === "parent" ? "parent or guardian" : "own self: the student"}. Write in plain, friendly language a busy parent or a teenager can act on. Keep answers short (a few sentences or a short list) unless asked for more, and end with the single most useful next step when there is one.

What you know about this family (from their ScholarTasks account):
${context}

Georgia programs in ScholarTasks (draft data still being verified with the Georgia Student Finance Commission):
${programs}

Georgia dates in ScholarTasks (draft):
${deadlines}

How to help:
- Build advice around this student's actual grades, scores, college list and deadlines above. If something important is missing, say what to add in ScholarTasks (Grades and HOPE page, or College list and deadlines page).
- Dates, amounts and rules change every year. When you state one, say it should be confirmed on the official site (studentaid.gov, gafutures.org, gsfc.georgia.gov, or the college's own admissions or aid page). Never invent a scholarship, deadline or amount; if you aren't sure, say so.
- For essays, help the student brainstorm, outline and improve their own writing, and give feedback. Don't write a whole essay for them to submit as their own.
- Families file the FAFSA and GSFAPP themselves with their own accounts. Never ask for or accept Social Security numbers, FSA IDs, passwords or bank details; if someone shares one, tell them not to and don't repeat it.
- You are not a lawyer, tax preparer or the college's official aid office. For appeals, tax questions or special circumstances, explain the options and point them to the college's financial aid office or the school counselor.
- If a student seems stressed or overwhelmed, be kind and encouraging, and suggest talking with a parent or school counselor. If anyone mentions thoughts of self-harm or being unsafe, tell them they can call or text 988 (Suicide and Crisis Lifeline) right now, and encourage them to reach a trusted adult.
- Stay on school, college, careers, test prep, scholarships and paying for college. Politely steer other topics back.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !url || !key) return json(503, "The AI counselor isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { studentId?: unknown; messages?: unknown };
  try { body = await req.json(); } catch { return json(400, "Bad request."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]).slice(-MAX_TURNS) : [];
  const valid =
    studentId && messages.length > 0 && messages[messages.length - 1]?.role === "user" &&
    messages.every((m, i) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0 && m.content.length <= MAX_CHARS && (i === 0 ? m.role === "user" : m.role !== messages[i - 1]!.role));
  if (!valid) return json(400, "Messages must be under 4,000 characters.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: DAILY_LIMIT });
  if (turn.error) {
    if (turn.error.code === "PGRST202" || turn.error.code === "42883") return json(503, "The AI counselor needs the latest database update first.");
    if (/not allowed/.test(turn.error.message)) return json(403, "AI chat is turned off for this student. A parent can turn it on in Family and permissions.");
    return json(500, "Something went wrong. Please try again.");
  }
  if (turn.data === false) return json(429, `You've reached today's limit of ${DAILY_LIMIT} counselor messages. It resets at midnight.`);

  const [st, mem] = await Promise.all([
    sb.from("students").select("id, first_name, birth_date, grade_level, state, sat, act, income_band, permissions").eq("id", studentId).maybeSingle(),
    sb.from("family_members").select("role, student_id").eq("user_id", user.user.id),
  ]);
  const student = st.data as Student | null;
  if (!student) return json(403, "You don't have access to this student.");
  const isParent = ((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent");

  const today = todayEastern();
  let system: string;
  try {
    system = systemPrompt(isParent ? "parent" : "student", await studentContext(sb, student, isParent, today), today);
  } catch (e) {
    return json(500, (e as Error).message);
  }

  const client = new Anthropic({ apiKey });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nSorry, I can't help with that one. Try asking another way, or ask about colleges, scholarships or deadlines."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n(That answer got cut off. Ask me to continue.)"));
        }
      } catch (e) {
        console.error("counselor stream failed", e);
        controller.enqueue(encoder.encode("\n\nSorry, the counselor hit a problem. Please try again in a minute."));
      } finally {
        controller.close();
      }
    },
    cancel() { stream.abort(); },
  });

  return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

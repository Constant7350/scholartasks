import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { limitReached } from "../../../../lib/billing";
import { AI_CONSENT_NEEDED, needsAiConsent } from "../../../../lib/ai-consent";
import { aiDailyLimit } from "../../../../lib/ai-limit";

// "Get ready to apply": a short checklist for one scholarship, read from the
// sponsor's official page. It's made once per award and shared by every
// family, so only the first family to ask uses one of the day's AI uses.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = "claude-haiku-5-5";
const json = (status: number, error: string) => Response.json({ error }, { status });

const SYSTEM = `You help a US high school student and their parent get ready to apply for one scholarship or grant. You'll be given the award's record from ScholarTasks and today's date.

1. Fetch the award's official URL (if it fails, search for the sponsor's own page; never use aggregator sites like Fastweb, Scholarships.com, Bold.org or Niche).
2. Write a checklist of what the student must do to apply, in order: create an account, forms, essays or short answers, recommendation letters, transcripts, test scores, FAFSA or financial documents, nomination, interview, and the deadline. Only include steps the official page (or the record) supports. Each step: a short title (under 60 characters) and one or two plain sentences of detail. 3 to 10 steps.
3. List each essay or short-answer prompt word for word if the page shows it. If prompts aren't published yet, leave the list empty.

Finish with exactly one block:
<result>{"steps": [{"title": "...", "detail": "..."}], "essay_prompts": ["..."], "sources": ["https://..."]}</result>`;

type Step = { title: string; detail: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!apiKey || !url || !key || !secret) return json(503, "Application help isn't switched on yet.");

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  let body: { studentId?: unknown; scholarshipId?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const scholarshipId = typeof body.scholarshipId === "string" ? body.scholarshipId : "";
  if (!studentId || !scholarshipId) return json(400, "Pick a scholarship first.");

  const sb = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user.user) return json(401, "Please sign in again.");

  const { data: cached } = await sb.from("scholarship_steps").select("steps, essay_prompts, sources").eq("scholarship_id", scholarshipId).maybeSingle();
  if (cached) return Response.json(cached, { headers: { "Cache-Control": "no-store" } });

  const { data: st } = await sb.from("students").select("id").eq("id", studentId).maybeSingle();
  if (!st) return json(403, "You don't have access to this student.");
  const { data: s } = await sb.from("scholarships")
    .select("name, sponsor, url, summary, how_to_apply, amount_text, deadline, deadline_text, other_requirements")
    .eq("id", scholarshipId).maybeSingle();
  if (!s) return json(404, "That scholarship wasn't found.");

  const limit = await aiDailyLimit(sb, studentId);
  const turn = await sb.rpc("ai_take_turn", { p_student: studentId, p_limit: limit });
  if (needsAiConsent(turn.error)) return json(428, AI_CONSENT_NEEDED);
  if (turn.error) return json(403, /not allowed/.test(turn.error.message) ? "AI features are turned off for this student. A parent can turn on AI chat in Family and permissions." : "Something went wrong. Please try again.");
  if (turn.data === false) return json(429, limitReached(limit));

  try {
    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\nRecord:\n${JSON.stringify(s, null, 2)}` }];
    let text = "";
    for (let i = 0; i < 4; i++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        output_config: { effort: "low" },
        tools: [
          { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, max_content_tokens: 20000 },
          { type: "web_search_20250305", name: "web_search", max_uses: 2 },
        ],
        messages,
      });
      text += res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content });
    }
    const out = parseSteps(text);
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    await admin.from("scholarship_steps").upsert({ scholarship_id: scholarshipId, ...out });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("scholarship steps failed", e);
    return json(502, "Sorry, we couldn't read the sponsor's page just now. Please try again in a minute.");
  }
}

function parseSteps(text: string): { steps: Step[]; essay_prompts: string[]; sources: string[] } {
  const m = text.match(/<result>([\s\S]*?)<\/result>/);
  if (!m?.[1]) throw new Error("no result");
  const raw = JSON.parse(m[1]) as { steps?: unknown; essay_prompts?: unknown; sources?: unknown };
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter((x): x is Step => !!x && typeof (x as Step).title === "string")
    .slice(0, 12)
    .map((x) => ({ title: x.title.slice(0, 100), detail: String(x.detail ?? "").slice(0, 400) }));
  if (!steps.length) throw new Error("no steps");
  const strs = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").slice(0, n).map((x) => x.slice(0, len));
  return { steps, essay_prompts: strs(raw.essay_prompts, 6, 1000), sources: strs(raw.sources, 6, 500).filter((u) => /^https:\/\//.test(u)) };
}

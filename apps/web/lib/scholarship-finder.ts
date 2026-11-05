import Anthropic from "@anthropic-ai/sdk";
import { GROUP_TAGS, INTERESTS } from "@scholartasks/core";
import { CHECK_MODEL } from "./scholarship-check";
import { FINDER_TOPICS } from "./scholarship-finder-topics";
export { FINDER_TOPICS };

// The AI scholarship finder: given a search topic or a page address, it finds
// real awards on their official pages and returns them as new records. They
// are saved as status 'found', which families never see. The checker then
// reads each official page again before an award goes live (see
// scholarship-check.ts), so every award is checked twice before families see it.

/** The scholarships table's columns the finder fills in. */
export interface FoundAward {
  kind: "scholarship" | "grant";
  name: string; sponsor: string; url: string; summary: string; how_to_apply: string | null;
  amount_text: string; amount_max: number | null; deadline: string | null; deadline_text: string | null;
  scope: string; grades: number[]; min_gpa: number | null; gpa_kind: "unweighted" | "weighted" | "hope" | null;
  min_sat: number | null; min_act: number | null; max_income: number | null; need_based: boolean; citizen_required: boolean;
  interests: string[] | null; groups: string[] | null; college_type: "any" | "four_year" | "technical"; college: string | null;
  other_requirements: string | null;
}

const AGGREGATORS = /fastweb|scholarships\.com|bold\.org|niche\.com|goingmerry|scholarshipowl|unigo|cappex|collegeboard\.org\/scholarship|scholarships360|petersons|careeronestop|myscholly|raise\.me|scholarshipamerica\.org\/scholarship-search/i;

const SYSTEM = `You find real college scholarships and grants for a family app (USA, Georgia first, families in every state).

Use web search to find awards for the topic, then open each award's OFFICIAL page (the organization's own site, or a community foundation's or college's own page). Never use an aggregator (Fastweb, Scholarships.com, Bold.org, Niche, Going Merry, ScholarshipOwl, Unigo, Scholarships360) as the source, and never copy from one.

Only include an award when you read its official page in this session and it:
- is open to high school students (grades 9 to 12) or students starting college or technical college next year,
- is still offered (this cycle or a recurring yearly award),
- is not a loan, a sweepstakes with no merit or need element, or a pay-to-enter contest,
- is not already in the "Skip" list.

Fill every field only from what the official page says. If the page doesn't say, use null (or the default shown). Never guess an amount, a date or a GPA. Dates are YYYY-MM-DD for the upcoming or current cycle; if only a month is known, use deadline null and put it in deadline_text ("Usually mid-February").
Write summary and how_to_apply in plain, friendly English for parents (1 to 3 sentences each). Don't use the word "sponsor" in summary or how_to_apply.

Return at most the number of awards asked for. Finish your reply with exactly one block:
<awards>[{"kind": "scholarship" | "grant", "name": "...", "sponsor": "organization that gives it", "url": "https://official page", "summary": "...", "how_to_apply": "..." | null, "amount_text": "$1,000" | "Up to $5,000" | "Varies", "amount_max": 5000 | null, "deadline": "YYYY-MM-DD" | null, "deadline_text": "..." | null, "scope": "US" or a two-letter state like "GA", "grades": [12], "min_gpa": 3.0 | null, "gpa_kind": "unweighted" | "weighted" | null, "min_sat": null, "min_act": null, "max_income": null, "need_based": false, "citizen_required": false, "interests": [from INTERESTS] | null, "groups": [from GROUPS] | null, "college_type": "any" | "four_year" | "technical", "college": "only if it must be used at one college" | null, "other_requirements": "county, school, major, membership..." | null}]</awards>
INTERESTS: ${INTERESTS.join(", ")}
GROUPS: ${GROUP_TAGS.join(", ")}`;

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : null);

/** Keeps only well-formed awards from official pages; fixes types and drops anything out of range. */
export function cleanAwards(raw: unknown, today: string): FoundAward[] {
  if (!Array.isArray(raw)) return [];
  const out: FoundAward[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const name = str(r.name, 200), sponsor = str(r.sponsor, 200), url = str(r.url, 500), summary = str(r.summary, 1500), amount = str(r.amount_text, 200);
    if (!name || name.length < 2 || !sponsor || sponsor.length < 2 || !url || !/^https:\/\/[^\s]+$/.test(url) || AGGREGATORS.test(url) || !summary || summary.length < 10 || !amount) continue;
    const deadline = typeof r.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.deadline) && r.deadline >= today ? r.deadline : null;
    const grades = Array.isArray(r.grades) ? [...new Set((r.grades as unknown[]).filter((g): g is number => Number.isInteger(g) && (g as number) >= 6 && (g as number) <= 12))] : [];
    const scope = typeof r.scope === "string" && /^(US|[A-Z]{2})$/.test(r.scope) ? r.scope : "US";
    const gpaKind = r.gpa_kind === "unweighted" || r.gpa_kind === "weighted" || r.gpa_kind === "hope" ? r.gpa_kind : null;
    const minGpa = typeof r.min_gpa === "number" && r.min_gpa > 0 && r.min_gpa <= 5 ? Math.round(r.min_gpa * 100) / 100 : null;
    const interests = Array.isArray(r.interests) ? (r.interests as unknown[]).filter((i): i is string => (INTERESTS as readonly string[]).includes(i as string)) : [];
    const groups = Array.isArray(r.groups) ? (r.groups as unknown[]).filter((g): g is string => GROUP_TAGS.includes(g as string)) : [];
    out.push({
      kind: r.kind === "grant" ? "grant" : "scholarship", name, sponsor, url, summary,
      how_to_apply: str(r.how_to_apply, 1500), amount_text: amount, amount_max: int(r.amount_max, 1, 1000000),
      deadline, deadline_text: str(r.deadline_text, 200) ?? (deadline ? null : "Check the official page for this year's date"),
      scope, grades: grades.length ? grades : [12], min_gpa: minGpa, gpa_kind: minGpa ? gpaKind ?? "unweighted" : null,
      min_sat: int(r.min_sat, 400, 1600), min_act: int(r.min_act, 1, 36), max_income: int(r.max_income, 1, 10000000),
      need_based: r.need_based === true, citizen_required: r.citizen_required === true,
      interests: interests.length ? interests : null, groups: groups.length ? groups : null,
      college_type: r.college_type === "four_year" || r.college_type === "technical" ? r.college_type : "any",
      college: str(r.college, 200), other_requirements: str(r.other_requirements, 1000),
    });
  }
  return out;
}

/** Same award? Names compared without case, punctuation or "scholarship"/"program"/"the". */
export const awardKey = (name: string) => name.toLowerCase().replace(/\b(the|scholarship|scholarships|program|award|awards|fund|grant)\b/g, "").replace(/[^a-z0-9]+/g, "");

/** Finds up to `max` new awards for a topic (search words) or one page address. */
export async function findScholarships(apiKey: string, source: { query?: string; url?: string; label: string }, skipNames: string[], today: string, max = 12): Promise<{ awards: FoundAward[]; note: string }> {
  const client = new Anthropic({ apiKey });
  const ask = source.url
    ? `Read this page and the official pages it links to, and list the awards on it: ${source.url}`
    : `Topic: ${source.label}. Search for: ${source.query}`;
  const skip = skipNames.slice(0, 400).join("; ");
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Today is ${today}. ${ask}\n\nFind up to ${max} awards.\n\nSkip (already in our list): ${skip}` }];
  let text = "";
  for (let i = 0; i < 5; i++) {
    const res = await client.messages.create({
      model: CHECK_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 5 },
        { type: "web_fetch_20250910", name: "web_fetch", max_uses: 12, max_content_tokens: 15000 },
      ],
      messages,
    });
    text += res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  const m = text.match(/<awards>([\s\S]*?)<\/awards>/);
  let raw: unknown = [];
  try { raw = m?.[1] ? JSON.parse(m[1]) : []; } catch { raw = []; }
  const skipKeys = new Set(skipNames.map(awardKey));
  const awards = cleanAwards(raw, today).filter((a) => !skipKeys.has(awardKey(a.name))).slice(0, max);
  return { awards, note: m ? `Found ${awards.length} new award${awards.length === 1 ? "" : "s"}.` : "The finder didn't return a list this time." };
}

/** Which topics the weekly job runs: three a week, cycling through the whole list. */
export function topicsForWeek(d: Date, perRun = 3) {
  const week = Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
  const n = FINDER_TOPICS.length;
  return Array.from({ length: perRun }, (_, i) => FINDER_TOPICS[(week * perRun + i) % n]!);
}

/** Saves found awards as 'found' (hidden from families). Names already on the list are skipped. */
export async function saveFound(sb: import("@supabase/supabase-js").SupabaseClient, awards: FoundAward[], from: string): Promise<{ added: number; error?: string }> {
  if (!awards.length) return { added: 0 };
  const rows = awards.map((a) => ({ ...a, status: "found", found_from: from.slice(0, 300), last_checked: null }));
  const { data, error } = await sb.from("scholarships").upsert(rows, { onConflict: "name", ignoreDuplicates: true }).select("id");
  if (error) return { added: 0, error: error.message };
  return { added: (data as unknown[] | null)?.length ?? 0 };
}

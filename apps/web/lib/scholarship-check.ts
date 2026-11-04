import Anthropic from "@anthropic-ai/sdk";

// The AI checker: reads a scholarship's official page (and searches if the
// page moved) and reports what changed. It never edits the list itself; its
// findings are saved as a proposed update that a person accepts or dismisses.

// Haiku keeps each check to about half a cent, so the whole list can be
// re-checked every few weeks for a few dollars a month.
export const CHECK_MODEL = "claude-haiku-5-5";

/** Fields the checker may propose changing. */
export const CHECKED_FIELDS = [
  "url", "amount_text", "amount_max", "deadline", "deadline_text", "grades", "min_gpa", "gpa_kind",
  "min_sat", "min_act", "max_income", "need_based", "citizen_required", "how_to_apply", "other_requirements",
] as const;

export interface CheckRecord {
  id: string; name: string; sponsor: string; url: string; summary: string;
  [k: string]: unknown;
}
export interface CheckResult {
  still_offered: "yes" | "no" | "unclear";
  summary: string;
  changes: Record<string, unknown>;
  sources: string[];
}

const SYSTEM = `You keep a scholarship and grant database accurate for families in Georgia (USA). You will be given one record and today's date.

1. Fetch the record's official URL. If it fails or looks moved, search for the award's official page (the sponsor's or college's own site; never an aggregator like Fastweb, Scholarships.com, Bold.org or Niche).
2. Compare what the official page says now with the record: whether it is still offered, the amount, this cycle's deadline, eligible grades, GPA and test minimums, income limits, need, citizenship, how to apply and other requirements.
3. Only report a change when the official page clearly states the new value. Do not guess. Dates must be YYYY-MM-DD for the upcoming or current cycle.

Finish your reply with exactly one block:
<result>{"still_offered": "yes" | "no" | "unclear", "summary": "1 to 3 plain sentences for the reviewer: what you checked and what changed (or 'No changes found')", "changes": { "field": newValue, ... }, "sources": ["https://..."]}</result>
Allowed fields in changes: ${CHECKED_FIELDS.join(", ")}. Leave changes empty if nothing changed. Use the same types as the record (numbers as numbers, grades as an array of integers).`;

export async function checkScholarship(apiKey: string, rec: CheckRecord, today: string): Promise<CheckResult> {
  const client = new Anthropic({ apiKey });
  const record: Record<string, unknown> = { name: rec.name, sponsor: rec.sponsor, url: rec.url, summary: rec.summary };
  for (const f of CHECKED_FIELDS) record[f] = rec[f] ?? null;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Today is ${today}.\n\nRecord:\n${JSON.stringify(record, null, 2)}` }];

  let text = "";
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: CHECK_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      tools: [
        { type: "web_fetch_20250910", name: "web_fetch", max_uses: 4, max_content_tokens: 20000 },
        { type: "web_search_20250305", name: "web_search", max_uses: 3 },
      ],
      messages,
    });
    text += res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  return parseResult(text);
}

export function parseResult(text: string): CheckResult {
  const m = text.match(/<result>([\s\S]*?)<\/result>/);
  if (!m?.[1]) throw new Error("The checker didn't return a result.");
  const raw = JSON.parse(m[1]) as Partial<CheckResult>;
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.changes ?? {})) {
    if (!(CHECKED_FIELDS as readonly string[]).includes(k)) continue;
    if (k === "deadline" && v !== null && !(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))) continue;
    if (k === "url" && !(typeof v === "string" && /^https:\/\//.test(v))) continue;
    if (k === "grades" && !(Array.isArray(v) && v.every((g) => Number.isInteger(g) && g >= 6 && g <= 12))) continue;
    if (["amount_max", "min_sat", "min_act", "max_income"].includes(k) && v !== null && !Number.isInteger(v)) continue;
    if (k === "min_gpa" && v !== null && typeof v !== "number") continue;
    changes[k] = v;
  }
  const still = raw.still_offered === "yes" || raw.still_offered === "no" ? raw.still_offered : "unclear";
  return {
    still_offered: still,
    summary: String(raw.summary ?? "").slice(0, 1500) || "Checked.",
    changes,
    sources: (raw.sources ?? []).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 6),
  };
}

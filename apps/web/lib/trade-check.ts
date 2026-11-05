import Anthropic from "@anthropic-ai/sdk";
import { CHECK_MODEL } from "./scholarship-check";

// The monthly trades check: reads one fact from the trades list (an aid
// program or a Georgia license rule) against its official page and says
// whether it still holds. It never edits anything; a person reviews what
// it flags on /admin/trades and fixes the trades list.

export interface FactCheck { result: "ok" | "changed" | "unclear"; summary: string; sources: string[] }

const SYSTEM = `You keep a guide to skilled-trade training and aid accurate for families in Georgia (USA). You will be given one fact as it appears in the guide, its official URL, and today's date.

1. Fetch the official URL. If it fails or looks moved, search for the official page (a government, state agency, college system or program's own site; never an aggregator or blog).
2. Compare the official page with the fact: amounts, ages, hours, years of experience, deadlines, who qualifies, and whether the program still exists.
3. Say "changed" only when the official page clearly states something different, and say exactly what. Say "unclear" if you could not confirm it. Otherwise "ok". Small wording differences are "ok".

Finish your reply with exactly one block:
<result>{"result": "ok" | "changed" | "unclear", "summary": "1 to 3 plain sentences for the reviewer: what you checked and what (if anything) is different, with the new value", "sources": ["https://..."]}</result>`;

export async function checkTradeFact(apiKey: string, fact: { title: string; url: string; claim: string }, today: string): Promise<FactCheck> {
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Today is ${today}.\n\nFact: ${fact.claim}\nOfficial URL: ${fact.url}` }];
  let text = "";
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: CHECK_MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      output_config: { effort: "medium" },
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
  return parseFactCheck(text);
}

export function parseFactCheck(text: string): FactCheck {
  const m = text.match(/<result>([\s\S]*?)<\/result>/);
  if (!m?.[1]) throw new Error("The checker didn't return a result.");
  const raw = JSON.parse(m[1]) as Partial<FactCheck>;
  const result = raw.result === "ok" || raw.result === "changed" ? raw.result : "unclear";
  return {
    result,
    summary: String(raw.summary ?? "").slice(0, 1500) || "Checked.",
    sources: (raw.sources ?? []).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 6),
  };
}

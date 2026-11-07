import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NETWORKS, POST_NETWORKS, TOPICS, topicsFor, type Network, type Topic } from "./social";

// The weekly social media writer (server only). Writes short-video scripts and
// written posts as drafts for the team to read, change and approve. Nothing is
// ever posted by itself. Used by "Write this week's" on /admin/marketing and by
// the Monday job (/api/cron/social). About 5 to 10 cents a week with Sonnet.

const MODEL = "claude-sonnet-5-5";
const SITE = "scholartasks.com";

// Facts the writer may state. Anything else about program rules must point to the official site.
const FACTS = `- ScholarTasks is a college, scholarship and financial aid planning app for families (phone and website), grades 8 to 12, starting with the Southeast US. Website: ${SITE}.
- What it does: AI counselor for questions; scholarship and grant search with application help and essay feedback (feedback only, it never writes essays); grades and an always-visible HOPE GPA scorecard; grade rescue plans; study-skills lessons and practice questions; SAT/ACT practice with original questions; college list, compare colleges and compare aid offers; FAFSA and state aid checklist; majors and careers search with a career quiz; trades and apprenticeships; weekend and holiday jobs with parent consent; to-do list with reminders; activities and Common App activity list helper; Homework Helper that teaches reasoning and never just gives answers; Spanish version.
- The parent owns the account and controls what the student can use. ScholarTasks gives advice; families make the final decisions.
- Georgia HOPE Scholarship: needs a 3.0 HOPE GPA (core classes only, recalculated by the state, not the same as the school GPA). Zell Miller Scholarship: needs a 3.7 HOPE GPA plus a qualifying SAT or ACT score (exact scores: GAfutures.org). Official site: GAfutures.org.
- The FAFSA opens October 1 each year at StudentAid.gov and is free; never pay anyone to file it. Student and parent each need their own StudentAid.gov account (FSA ID).
- Never pay a fee to apply for a scholarship.`;

const SYSTEM = `You write social media for ScholarTasks, a college and scholarship planning app for families.

Voice: warm, plain, upbeat, helpful first and selling second. Short sentences. No jargon. Teens watch the videos; parents read the written posts.

Hard rules (never break these):
1. Only state facts from FACTS. For any other rule, number, cutoff or deadline, say to check the official site (GAfutures.org, StudentAid.gov, the college's site). Never invent statistics, quotes, reviews, awards or "studies show".
2. Never promise results (no "win scholarships guaranteed", "get into any college"). No prices or discounts.
3. Company voice: say "we" or "our team". Never describe who works at ScholarTasks, how many people, or any family connection. Never use the word "sponsor" (say "the group that gives the award"). Never use the word "Pay" as a heading.
4. The video host is a student. Write the host's lines in first person, but never say or show the host's name, school, town, workplace or any other student's name. Use HOST NOTE only to make the script feel natural (interests in general terms).
5. Safe for teens: no asking viewers for personal information, no "DM me", no risky challenges, no body or appearance talk, nothing political or religious. Comments call to action: "save this", "follow for more", "send this to a friend who needs it".
6. Each video ends by pointing to ScholarTasks ("link in bio" or "${SITE}").
7. Never copy real test questions or other creators' scripts.

Short videos (TikTok, Reels, Shorts): 20 to 30 seconds for students on TikTok, 15 to 25 seconds for parent videos on Facebook and Instagram. The hook is the first 2 seconds, on screen and spoken, and it states the payoff or the parent's worry ("I stopped searching for scholarships. My app does it for me." / "Parents: the FAFSA is already open."), never the logo or a greeting. Give the hook, then the script as numbered beats, each with what the host SAYS and what is ON SCREEN (text overlay or what to film). Add shot notes, a caption under 300 characters, and 3 to 6 hashtags.
- Easy for any student from grade 8 to 12 to film alone: every scene can be shot on a phone held vertically (9:16), at home or school, with no special gear, no crew, and no editing beyond cutting between beats and adding text in the app. At most 4 beats, each one take. Lines a student can say naturally after reading them twice: everyday words, sentences under 12 words, no lists to memorize. Big on-screen text carries the key fact so it works with the sound off.
- One message per video, said in the first 2 seconds, repeated in the on-screen text, and ended with one call to action.
- Shot notes start with "PHONE:" (how to film it with only a phone: face a window for light, quiet room, phone at eye level, wired or phone mic) and then "BETTER GEAR (optional):" one line for a better camera and a clip-on wireless mic (such as a DJI Mic) when the team films it.

Written posts: one per network listed, written for parents, each fitting that network: Facebook and Nextdoor 60 to 150 words with a friendly tip and the link ${SITE}; Instagram a caption with line breaks and 5 to 10 hashtags; X and Threads under 260 characters; LinkedIn 80 to 150 words, slightly more formal. Each post teaches one useful thing first.

Finish your reply with exactly one block of JSON and nothing after it:
<social>{"videos": [{"topic": "topic id", "title": "short title for the team", "hook": "...", "script": "1. SAY: ... | ON SCREEN: ...\\n2. ...", "shot_notes": "...", "caption": "...", "hashtags": "#a #b"}], "posts": [{"network": "facebook", "topic": "topic id", "title": "short title for the team", "text": "...", "hashtags": "#a #b" or ""}]}</social>`;

export interface WriteOptions {
  weekOf: string;
  videos: number;
  networks: Network[];
  hostNote: string;
  focus?: string | null;
  recentTopics: string[];
}

export interface Draft {
  kind: "video" | "post"; network: Network; week_of: string; topic: string | null; title: string;
  hook: string | null; body: string; caption: string | null; hashtags: string | null; shot_notes: string | null; ai_written: true;
}

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const BANNED = /\bsponsor/i;
const clean = (t: string | null) => (t ? t.replace(/\bsponsors?\b/gi, "group that gives the award").replace(/\bsponsored\b/gi, "given") : t);

/** Keeps only well-formed drafts and fixes anything over the limits. */
export function cleanDrafts(raw: unknown, o: Pick<WriteOptions, "weekOf" | "networks">): Draft[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as { videos?: unknown; posts?: unknown };
  const ids = new Set(TOPICS.map((t) => t.id));
  const out: Draft[] = [];
  for (const v of Array.isArray(r.videos) ? (r.videos as Record<string, unknown>[]) : []) {
    const title = s(v?.title, 200), script = s(v?.script, 8000);
    if (!title || !script) continue;
    out.push({
      kind: "video", network: "tiktok", week_of: o.weekOf, topic: ids.has(v.topic as string) ? (v.topic as string) : null, title: clean(title)!,
      hook: clean(s(v.hook, 400)), body: clean(script)!, caption: clean(s(v.caption, 2200)), hashtags: s(v.hashtags, 500), shot_notes: clean(s(v.shot_notes, 2000)), ai_written: true,
    });
  }
  for (const p of Array.isArray(r.posts) ? (r.posts as Record<string, unknown>[]) : []) {
    const network = p?.network as Network;
    const text = s(p?.text, 8000), title = s(p?.title, 200);
    if (!o.networks.includes(network) || NETWORKS[network]?.kind !== "post" || !text) continue;
    out.push({
      kind: "post", network, week_of: o.weekOf, topic: ids.has(p.topic as string) ? (p.topic as string) : null, title: clean(title ?? `${NETWORKS[network].label} post`)!,
      hook: null, body: clean(text)!, caption: null, hashtags: s(p.hashtags, 500), shot_notes: null, ai_written: true,
    });
  }
  return out.filter((d) => !BANNED.test(`${d.title} ${d.body} ${d.caption ?? ""}`));
}

async function ask(apiKey: string, user: string, maxTokens = 8000): Promise<string> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL, max_tokens: maxTokens, system: SYSTEM, output_config: { effort: "low" },
    messages: [{ role: "user", content: user }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

const parse = (text: string): unknown => {
  const m = text.match(/<social>([\s\S]*?)<\/social>/);
  try { return m?.[1] ? JSON.parse(m[1]) : null; } catch { return null; }
};

const topicLines = (ts: Topic[]) => ts.map((t) => `- ${t.id}: ${t.label}. ${t.angle} (App page: ${SITE}${t.page})`).join("\n");

/** Writes one week of drafts: `videos` short-video scripts and one post per network. */
export async function writeWeek(apiKey: string, o: WriteOptions): Promise<Draft[]> {
  const nets = o.networks.filter((n) => (POST_NETWORKS as readonly string[]).includes(n));
  const topics = topicsFor(o.weekOf, Math.max(o.videos, 1) + 1, o.recentTopics);
  const user = `FACTS:\n${FACTS}\n\nHOST NOTE (private, never name the host): ${o.hostNote}\n\nWeek of ${o.weekOf}.${o.focus ? `\nThe team's focus this week: ${o.focus}` : ""}

Topics to use this week (one topic per video, in this order; written posts can share the first topic or the extra one):
${topicLines(topics)}

Write ${o.videos} short video${o.videos === 1 ? "" : "s"} and one written post for each of these networks: ${nets.length ? nets.join(", ") : "none"}.`;
  return cleanDrafts(parse(await ask(apiKey, user)), { weekOf: o.weekOf, networks: nets });
}

/** Rewrites one draft the way the team asked ("make it funnier", "shorter", "about the FAFSA instead"). */
export async function rewriteOne(apiKey: string, item: Draft, request: string, hostNote: string): Promise<Draft | null> {
  const isVideo = item.kind === "video";
  const current = isVideo
    ? `Video "${item.title}"\nHook: ${item.hook ?? ""}\nScript:\n${item.body}\nShot notes: ${item.shot_notes ?? ""}\nCaption: ${item.caption ?? ""}\nHashtags: ${item.hashtags ?? ""}`
    : `${NETWORKS[item.network].label} post "${item.title}"\n${item.body}\nHashtags: ${item.hashtags ?? ""}`;
  const user = `FACTS:\n${FACTS}\n\nHOST NOTE (private, never name the host): ${hostNote}\n\nHere is the current draft:\n${current}\n\nThe team asks: ${request}\n\nRewrite it following every rule. Return the same JSON block with ${isVideo ? "one item in \"videos\" and an empty \"posts\"" : `one item in "posts" (network "${item.network}") and an empty "videos"`}. Keep topic "${item.topic ?? ""}" unless the team asks for a different subject.`;
  const out = cleanDrafts(parse(await ask(apiKey, user, 4000)), { weekOf: item.week_of, networks: isVideo ? [] : [item.network] });
  const d = out.find((x) => x.kind === item.kind);
  return d ? { ...d, network: item.network } : null;
}

/** Loads settings and recent topics, writes the week, and saves the drafts. */
export async function writeAndSave(sb: SupabaseClient, apiKey: string, weekOf: string, opts: { focus?: string | null; userId?: string | null; only?: "videos" | "posts" } = {}) {
  const { data: set } = await sb.from("social_settings").select("videos_per_week, networks, host_note, focus_note").maybeSingle();
  const since = new Date(new Date(`${weekOf}T12:00:00Z`).getTime() - 42 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: recent } = await sb.from("social_items").select("topic").gte("week_of", since).not("topic", "is", null);
  const drafts = await writeWeek(apiKey, {
    weekOf,
    videos: opts.only === "posts" ? 0 : (set?.videos_per_week ?? 3),
    networks: opts.only === "videos" ? [] : ((set?.networks as Network[] | undefined) ?? ["facebook", "instagram", "x", "nextdoor"]),
    hostNote: set?.host_note ?? "A high school student.",
    focus: opts.focus?.trim() || set?.focus_note || null,
    recentTopics: [...new Set(((recent as { topic: string }[] | null) ?? []).map((r) => r.topic))],
  });
  if (!drafts.length) return { added: 0, error: "The writer didn't return any drafts this time. Try again." };
  const { error } = await sb.from("social_items").insert(drafts.map((d) => ({ ...d, created_by: opts.userId ?? null })));
  return error ? { added: 0, error: error.message } : { added: drafts.length };
}

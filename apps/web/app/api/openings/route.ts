import { createClient } from "@supabase/supabase-js";
import { checkOpening, openingReviewFlags } from "@scholartasks/core";
import { SUPPORT_EMAIL, TRADE_SLUGS, emailShell, esc, kindLabel, place, sendEmail } from "../../../lib/openings";

export const runtime = "nodejs";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// Best-effort limit per visitor (each server copy keeps its own count): 5 listings per 10 minutes.
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 5;
}

/**
 * A company sends an opening from /trades/post (no account needed).
 * It is saved as pending; our team is emailed, and so is the company (so they know it arrived).
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) return json(429, { error: `That's a lot of listings in a short time. Please wait a few minutes, or email ${SUPPORT_EMAIL}.` });
  const check = checkOpening(await req.json().catch(() => null), { tradeSlugs: TRADE_SLUGS });
  if (!check.ok) return check.spam ? json(200, { ok: true }) : json(400, { error: check.error });
  const o = check.opening;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(503, { error: `Listings aren't switched on yet. Please email ${SUPPORT_EMAIL}.` });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.rpc("submit_opening", { p: o });
  if (error) {
    if (/too many/.test(error.message)) return json(429, { error: `You've sent five listings today. Please send more tomorrow, or email ${SUPPORT_EMAIL}.` });
    if (/schema cache|does not exist/i.test(error.message)) return json(503, { error: `Listings aren't switched on yet. Please email ${SUPPORT_EMAIL}.` });
    console.error("openings: save failed", error.message);
    return json(500, { error: `Sorry, that didn't save. Please try again, or email ${SUPPORT_EMAIL}.` });
  }

  const flags = openingReviewFlags(o);
  await Promise.all([
    sendEmail({
      to: SUPPORT_EMAIL, replyTo: o.contact_email,
      subject: `New listing to review: ${o.title} (${o.company_name}, ${o.city} ${o.state})`,
      html: emailShell("New local opening to review", `<p><b>${esc(o.company_name)}</b> sent <b>${esc(o.title)}</b> (${esc(kindLabel(o.kind))}) in ${esc(place(o))}, open to ages ${o.min_age}+.</p>
        ${flags.length ? `<p><b>Check:</b></p><ul>${flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        <p><a href="https://scholartasks.com/admin/openings">Review it on /admin/openings</a></p>`),
    }),
    sendEmail({
      to: o.contact_email,
      subject: `We got your listing: ${o.title}`,
      html: emailShell("Thanks, we got your listing", `<p>Hi ${esc(o.contact_name)},</p>
        <p>Thanks for posting <b>${esc(o.title)}</b> on ScholarTasks. Our review team checks every listing before students see it, usually within two business days. We'll email you when it's live, or if we have a question.</p>
        <p>Listings are free. Students apply the way you told us; ScholarTasks never shares students' details with companies.</p>
        <p>Need a change, or want to take it down? Just reply to this email.</p>`),
    }),
  ]);
  return json(200, { ok: true });
}

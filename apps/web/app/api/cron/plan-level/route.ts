import { createClient } from "@supabase/supabase-js";
import { extraStudents, familyPlanLevel, isPlanLevel, levelStep, type LevelNotice, type PlanLevel } from "@scholartasks/core";
import { CATALOG, EXTRA_STUDENT, FAMILY_LEVELS, familyCents, familyItem, saveSubscriptionRow, stripe, subscriptionRow, type StripeSubscription } from "../../../../lib/billing";
import { money } from "../../../../lib/prices";

// Daily Family plan price check (Vercel Cron, "Authorization: Bearer $CRON_SECRET").
// One price covers the whole family and follows the OLDEST student's grade; 2 students are
// included and each extra student adds to the price. When the level or the number of extra
// students changes (up or down), the parent gets an email, and Home and the
// Plan and billing page show a notice, about 30 days before the next bill (at least 7). The
// Stripe price is switched at the same moment with no charge today, so the new price starts
// only at the next billing date (renewal for yearly plans). What was sent is kept on the
// Stripe subscription (metadata) and copied to billing_subscriptions (database update 65).
// Does nothing until payments are switched on.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ACTIVE = ["active", "trialing", "past_due"];

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const levelInfo = (l: PlanLevel) => FAMILY_LEVELS.find((x) => x.key === l)!;
function longDate(iso: string, lang: "en" | "es"): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function noticeEmail(n: LevelNotice, appUrl: string): { subject: string; html: string } {
  const to = levelInfo(n.to), from = levelInfo(n.from);
  const levelUp = FAMILY_LEVELS.indexOf(to) > FAMILY_LEVELS.indexOf(from);
  const levelDown = FAMILY_LEVELS.indexOf(to) < FAMILY_LEVELS.indexOf(from);
  const old = n.old_cents ?? n.cents;
  const more = n.cents > old;
  const price = money(n.cents), diff = money(Math.abs(n.cents - old));
  const per = n.interval === "month" ? "a month" : "a year";
  const perEs = n.interval === "month" ? "al mes" : "al año";
  const name = esc(n.student);
  const date = longDate(n.starts_on, "en"), dateEs = longDate(n.starts_on, "es");
  const subject = more ? `Your ScholarTasks price is changing on ${date}` : `Good news: your ScholarTasks price is going down on ${date}`;
  const why = levelUp ? `${name} is now in grade ${n.grade}, so your family moves from the ${from.name} level to the <b>${to.name}</b> level (grades ${to.grades}). `
    : levelDown ? `${name} (grade ${n.grade}) is now your oldest student, so your family moves from the ${from.name} level to the <b>${to.name}</b> level (grades ${to.grades}). ` : "";
  const whyEs = levelUp ? `${name} ahora está en el grado ${n.grade}, así que su familia pasa del nivel ${from.name} al nivel <b>${to.name}</b> (grados ${to.grades}). `
    : levelDown ? `${name} (grado ${n.grade}) es ahora su estudiante mayor, así que su familia pasa del nivel ${from.name} al nivel <b>${to.name}</b> (grados ${to.grades}). ` : "";
  const kids = n.students ?? 0, extras = n.extras ?? 0;
  const count = kids ? ` Your family has ${kids} ${kids === 1 ? "student" : "students"} on the account${extras ? `: 2 are included and ${extras} ${extras === 1 ? "is an extra student" : "are extra students"} at ${money(EXTRA_STUDENT[n.interval])} ${per} each` : ", all included"}.` : "";
  const countEs = kids ? ` Su familia tiene ${kids} ${kids === 1 ? "estudiante" : "estudiantes"} en la cuenta${extras ? `: 2 están incluidos y ${extras} ${extras === 1 ? "es adicional" : "son adicionales"} a ${money(EXTRA_STUDENT[n.interval])} ${perEs} cada uno` : ", todos incluidos"}.` : "";
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b2433">
    <h2 style="color:#14305a">${subject}</h2>
    <p>${why}Starting with your bill on <b>${date}</b>, your Family plan will be <b>${price} ${per}</b>, ${diff} ${more ? "more" : "less"} than now.${count}</p>
    <p>The price is set by your oldest student's grade, and each student's app keeps following their own grade. Nothing is charged today. You can switch between monthly and yearly, or cancel, any time on the <a href="${appUrl}/billing">Plan and billing</a> page.</p>
    <hr style="border:none;border-top:1px solid #e3e7ee;margin:20px 0">
    <p lang="es">${whyEs}A partir de su cobro del <b>${dateEs}</b>, su plan Familiar será de <b>${price} ${perEs}</b>, ${diff} ${more ? "más" : "menos"} que ahora.${countEs} Hoy no se cobra nada. Puede cambiar entre mensual y anual, o cancelar, en la página <a href="${appUrl}/billing">Plan y pagos</a>.</p>
  </div>`;
  return { subject, html };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !process.env.STRIPE_SECRET_KEY) return Response.json({ ok: true, skipped: "payments are not switched on" });
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return Response.json({ ok: false, error: "RESEND_API_KEY is needed to tell families first" }, { status: 503 });
  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = todayEastern();

  const { data: subs, error } = await sb.from("billing_subscriptions").select("id, family_id").eq("kind", "family").in("status", ACTIVE);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const counts = { checked: 0, changed: 0, waiting: 0, failed: 0 };

  for (const row of (subs as { id: string; family_id: string }[]) ?? []) {
    counts.checked++;
    try {
      const sub = await stripe<StripeSubscription>("GET", `subscriptions/${row.id}`);
      const item = sub.items.data[0];
      if (!item) continue;
      const interval = item.price.recurring?.interval === "year" ? "year" : "month";
      const current = { level: (isPlanLevel(sub.metadata.level) ? sub.metadata.level : "apply") as PlanLevel, extras: Number(sub.metadata.extras) || 0 };
      const end = sub.current_period_end ?? item.current_period_end;
      const nextBill = sub.cancel_at_period_end || !end ? null : new Date(end * 1000).toISOString().slice(0, 10);

      const { data: kids } = await sb.from("students").select("first_name, grade_level").eq("family_id", row.family_id)
        .order("grade_level", { ascending: false }).order("first_name");
      const list = (kids as { first_name: string; grade_level: number }[]) ?? [];
      const step = levelStep({ current, target: { level: familyPlanLevel(list.map((k) => k.grade_level)), extras: extraStudents(list.length) }, today, nextBill });
      if (step.action === "none") continue;
      if (step.action === "wait") { counts.waiting++; continue; }

      const oldest = list[0]!;
      const newItem = familyItem(step.to.level, interval);
      const entry = CATALOG[newItem];
      const cents = familyCents(step.to.level, interval, list.length);
      const notice: LevelNotice = {
        from: current.level, to: step.to.level, student: oldest.first_name, grade: oldest.grade_level,
        students: list.length, extras: step.to.extras, old_cents: item.price.unit_amount ?? undefined,
        cents, interval, starts_on: step.startsOn, sent_on: today,
      };

      // Email first: the price only switches once the family has been told.
      const c = await stripe<{ email: string | null }>("GET", `customers/${sub.customer}`);
      if (!c.email) throw new Error("customer has no email");
      const msg = noticeEmail(notice, appUrl);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `level-${row.id}-${step.to.level}-${step.to.extras}-${step.startsOn}` },
        body: JSON.stringify({ from: "ScholarTasks <noreply@scholartasks.com>", to: [c.email], subject: msg.subject, html: msg.html }),
      });
      if (!res.ok) throw new Error(`email ${res.status}`);

      // proration_behavior none: nothing is charged today; the next bill uses the new price.
      const priceId = step.to.extras ? undefined : process.env[entry.priceEnv];
      const updated = await stripe<StripeSubscription>("POST", `subscriptions/${row.id}`, {
        items: [priceId
          ? { id: item.id, price: priceId }
          : { id: item.id, price_data: { currency: "usd", product: item.price.product, unit_amount: cents, recurring: { interval } } }],
        proration_behavior: "none",
        metadata: { level: step.to.level, item: newItem, students: String(list.length), extras: String(step.to.extras), level_notice: JSON.stringify(notice) },
      }, `level-${row.id}-${step.to.level}-${step.to.extras}-${step.startsOn}`);
      const saveErr = await saveSubscriptionRow(sb, subscriptionRow(updated));
      if (saveErr) console.error("plan level saved in Stripe but not copied", row.id, saveErr); // the webhook copies it too
      counts.changed++;
    } catch (e) {
      console.error("plan level check failed", row.id, e);
      counts.failed++;
    }
  }
  return Response.json({ ok: counts.failed === 0, today, ...counts });
}

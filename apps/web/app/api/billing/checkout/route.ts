import { CATALOG, StripeError, stripe, type BillingItem } from "../../../../lib/billing";
import { customerFor, parentFromRequest } from "../../../../lib/billing-auth";

// Starts a Stripe Checkout page for the family plan, the Study Coach add-on or
// a message pack. Stripe hosts the card form; card numbers never touch
// ScholarTasks. What was bought is recorded by the webhook, not here.
export const dynamic = "force-dynamic";

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const who = await parentFromRequest(req);
  if (!who.ok) return json(who.status, who.error);

  let body: { item?: unknown };
  try { body = await req.json(); } catch { return json(400, "Bad request."); }
  const item = typeof body.item === "string" && body.item in CATALOG ? (body.item as BillingItem) : null;
  if (!item) return json(400, "Pick a plan first.");
  const entry = CATALOG[item];

  const { data: subs } = await who.admin.from("billing_subscriptions").select("kind, status").eq("family_id", who.familyId);
  const has = (kind: string) => ((subs as { kind: string; status: string }[]) ?? []).some((s) => s.kind === kind && ["active", "trialing", "past_due"].includes(s.status));
  if (entry.kind !== "pack" && has(entry.kind)) return json(409, "Your family already has this. Use Manage billing to switch between monthly and yearly.");
  if (entry.kind === "study_coach" && !has("family")) return json(409, "Study Coach is an add-on. Start the Family plan first.");

  try {
    const customer = await customerFor(who.admin, who.familyId, who.email, async (familyId, email) =>
      (await stripe<{ id: string }>("POST", "customers", { email, metadata: { family_id: familyId } }, `customer-${familyId}`)).id,
    );
    const origin = new URL(req.url).origin;
    const price = process.env[entry.priceEnv];
    const line = price
      ? { price, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: entry.cents,
            product_data: { name: entry.name },
            ...(entry.interval ? { recurring: { interval: entry.interval } } : {}),
          },
        };
    const metadata = { family_id: who.familyId, kind: entry.kind, item, ...(entry.credits ? { credits: String(entry.credits) } : {}), bought_by: who.userId };
    const session = await stripe<{ url: string }>("POST", "checkout/sessions", {
      mode: entry.interval ? "subscription" : "payment",
      customer,
      client_reference_id: who.familyId,
      line_items: [line],
      metadata,
      ...(entry.interval ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      allow_promotion_codes: "true",
      success_url: `${origin}/billing?done=${item}`,
      cancel_url: `${origin}/billing`,
    });
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("checkout failed", e);
    return json(e instanceof StripeError && e.status === 503 ? 503 : 502, e instanceof StripeError && e.status === 503 ? e.message : "Couldn't open the payment page. Please try again.");
  }
}

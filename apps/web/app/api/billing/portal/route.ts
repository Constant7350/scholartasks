import { StripeError, stripe } from "../../../../lib/billing";
import { parentFromRequest } from "../../../../lib/billing-auth";

// Opens Stripe's billing page, where a parent can change card, switch
// monthly/yearly, see receipts or cancel.
export const dynamic = "force-dynamic";

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const who = await parentFromRequest(req);
  if (!who.ok) return json(who.status, who.error);
  const { data } = await who.admin.from("billing_customers").select("stripe_customer_id").eq("family_id", who.familyId).maybeSingle();
  if (!data) return json(404, "There's nothing to manage yet. Choose a plan first.");
  try {
    const portal = await stripe<{ url: string }>("POST", "billing_portal/sessions", {
      customer: (data as { stripe_customer_id: string }).stripe_customer_id,
      return_url: `${new URL(req.url).origin}/billing`,
    });
    return Response.json({ url: portal.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("billing portal failed", e);
    if (e instanceof StripeError && /configuration/i.test(e.message)) return json(503, "The billing page isn't set up in Stripe yet.");
    return json(502, "Couldn't open the billing page. Please try again.");
  }
}

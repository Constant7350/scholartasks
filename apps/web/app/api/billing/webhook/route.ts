import { createClient } from "@supabase/supabase-js";
import { stripe, subscriptionRow, verifyStripeSignature, type StripeSubscription } from "../../../../lib/billing";

// Stripe calls this after a payment or any subscription change. The signature
// check proves the call is from Stripe. Each subscription is re-read from
// Stripe so events that arrive out of order can't leave a stale status.
export const dynamic = "force-dynamic";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: { id: string; object: string; mode?: string; payment_status?: string; subscription?: string | null; metadata?: Record<string, string> } };
}

export async function POST(req: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!whSecret || !url || !secret || !process.env.STRIPE_SECRET_KEY) return new Response("not configured", { status: 503 });

  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), whSecret)) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(payload) as StripeEvent;
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const obj = event.data.object;

  const syncSubscription = async (id: string) => {
    const sub = await stripe<StripeSubscription>("GET", `subscriptions/${id}`);
    const row = subscriptionRow(sub);
    if (!row.family_id || (row.kind !== "family" && row.kind !== "study_coach")) return; // not one of ours
    const { error } = await admin.from("billing_subscriptions").upsert(row);
    if (error) throw new Error(`save subscription: ${error.message}`);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (obj.mode === "subscription" && obj.subscription) {
          await syncSubscription(obj.subscription);
        } else if (obj.mode === "payment" && obj.payment_status === "paid" && obj.metadata?.kind === "pack") {
          const credits = Number(obj.metadata.credits);
          const family = obj.metadata.family_id;
          if (family && Number.isInteger(credits) && credits > 0) {
            const { error } = await admin.rpc("billing_grant_credits", { p_session: obj.id, p_family: family, p_credits: credits });
            if (error) throw new Error(`grant credits: ${error.message}`);
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(obj.id);
        break;
      default:
        break;
    }
    await admin.from("billing_events").upsert({ id: event.id, type: event.type }, { ignoreDuplicates: true });
  } catch (e) {
    // A non-2xx answer makes Stripe retry later.
    console.error("stripe webhook failed", event.type, event.id, e);
    return new Response("retry", { status: 500 });
  }
  return new Response("ok");
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * For billing routes: checks the signed-in person's token and finds the family
 * they are a parent of. Returns a server client (secret key) for writes that
 * families aren't allowed to make themselves.
 */
export async function parentFromRequest(req: Request): Promise<
  | { ok: true; admin: SupabaseClient; userId: string; email: string | undefined; familyId: string }
  | { ok: false; status: number; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret || !process.env.STRIPE_SECRET_KEY) return { ok: false, status: 503, error: "Payments aren't switched on yet." };
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "Please sign in again." };
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Please sign in again." };
  const { data: m } = await admin.from("family_members").select("family_id").eq("user_id", data.user.id).eq("role", "parent")
    .order("family_id").limit(1).maybeSingle();
  if (!m) return { ok: false, status: 403, error: "Only a parent can manage the family's plan. Set up your family first." };
  return { ok: true, admin, userId: data.user.id, email: data.user.email, familyId: (m as { family_id: string }).family_id };
}

/** The family's Stripe customer, created the first time a parent checks out. */
export async function customerFor(admin: SupabaseClient, familyId: string, email: string | undefined, create: (familyId: string, email: string | undefined) => Promise<string>): Promise<string> {
  const { data } = await admin.from("billing_customers").select("stripe_customer_id").eq("family_id", familyId).maybeSingle();
  if (data) return (data as { stripe_customer_id: string }).stripe_customer_id;
  const id = await create(familyId, email);
  const { error } = await admin.from("billing_customers").insert({ family_id: familyId, stripe_customer_id: id });
  if (error) {
    // Another tab got there first; use the saved one.
    const again = await admin.from("billing_customers").select("stripe_customer_id").eq("family_id", familyId).maybeSingle();
    if (again.data) return (again.data as { stripe_customer_id: string }).stripe_customer_id;
    throw new Error("Could not save your billing account.");
  }
  return id;
}

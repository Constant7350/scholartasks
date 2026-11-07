import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlanLevel, type LevelNotice } from "@scholartasks/core";

// Server-only Stripe helpers. Talks to Stripe's REST API directly (no SDK), so
// there is nothing extra to install. STRIPE_SECRET_KEY and
// STRIPE_WEBHOOK_SECRET live only in Vercel and never reach the browser.

export { CATALOG, EXTRA_STUDENT, FAMILY_LEVELS, STUDY_COACH_DAILY_LIMIT, familyCents, familyItem, type BillingItem, type CatalogEntry } from "./prices";

/** The message shown when the day's free AI uses (and any message packs) are used up. */
export function limitReached(limit: number, what = "AI uses"): string {
  return `You've used today's ${limit} ${what}. They reset at midnight, or a parent can add a message pack on the Plan and billing page.`;
}

/** Flattens nested params the way Stripe expects: a[b][0][c]=v. */
export function formEncode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...formEncode(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export class StripeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Payments aren't switched on yet.", 503);
  const body = params ? formEncode(params).join("&") : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(data.error?.message ?? `Stripe error ${res.status}`, res.status);
  return data;
}

/** True when the key in Vercel is a test-mode key (no real charges). */
export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_") || (process.env.STRIPE_SECRET_KEY ?? "").startsWith("rk_test_");
}

/**
 * Checks Stripe's signature on a webhook (the Stripe-Signature header) so
 * nobody else can pretend to be Stripe. Rejects events older than 5 minutes.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || sigs.length === 0 || Math.abs(nowSeconds - t) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  metadata: Record<string, string>;
  items: { data: { id: string; current_period_end?: number; price: { id: string; product: string; unit_amount: number | null; recurring: { interval: string } | null } }[] };
}

/** The level notice saved on the subscription (metadata.level_notice, JSON), if any. */
function noticeFrom(md: Record<string, string>): LevelNotice | null {
  try {
    const n = md.level_notice ? (JSON.parse(md.level_notice) as LevelNotice) : null;
    return n && isPlanLevel(n.to) ? n : null;
  } catch { return null; }
}

/** The row we keep for a subscription. Newer Stripe API versions put the period end on the item. */
export function subscriptionRow(sub: StripeSubscription) {
  const item = sub.items?.data?.[0];
  const end = sub.current_period_end ?? item?.current_period_end;
  const interval = item?.price?.recurring?.interval;
  return {
    id: sub.id,
    family_id: sub.metadata.family_id,
    kind: sub.metadata.kind,
    status: sub.status,
    billing_interval: interval === "month" || interval === "year" ? interval : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    // Family plan price level (database update 65). Plans from before the levels were the top price.
    ...(sub.metadata.kind === "family"
      ? { level: isPlanLevel(sub.metadata.level) ? sub.metadata.level : "apply", level_notice: noticeFrom(sub.metadata) }
      : {}),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Saves a subscription row. If database update 65 hasn't been run yet, saves it without the
 * price level columns instead of failing, so payments keep working.
 */
export async function saveSubscriptionRow(admin: SupabaseClient, row: ReturnType<typeof subscriptionRow>): Promise<string | null> {
  const { error } = await admin.from("billing_subscriptions").upsert(row);
  if (!error) return null;
  if (/level/.test(error.message) && ("level" in row || "level_notice" in row)) {
    const { level: _l, level_notice: _n, ...rest } = row as typeof row & { level?: unknown; level_notice?: unknown };
    const again = await admin.from("billing_subscriptions").upsert(rest);
    return again.error ? again.error.message : null;
  }
  return error.message;
}

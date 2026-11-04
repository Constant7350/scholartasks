// ALL PRICES LIVE HERE. These are placeholders until running costs are known.
// Change a number here and the Plan and billing page and Stripe checkout both
// follow (amounts are in cents). Safe to import in the browser.

export type BillingItem = "family_month" | "family_year" | "coach_month" | "coach_year" | "pack_100";

export interface CatalogEntry {
  name: string;
  cents: number;
  /** Subscriptions renew every month or year; packs are one-time. */
  interval: "month" | "year" | null;
  kind: "family" | "study_coach" | "pack";
  credits?: number;
  /** Optional Stripe Price id from Vercel, if prices are made in the Stripe dashboard instead. */
  priceEnv: string;
}

export const CATALOG: Record<BillingItem, CatalogEntry> = {
  family_month: { name: "ScholarTasks Family plan (monthly)", cents: 1299, interval: "month", kind: "family", priceEnv: "STRIPE_PRICE_FAMILY_MONTH" },
  family_year: { name: "ScholarTasks Family plan (yearly)", cents: 9900, interval: "year", kind: "family", priceEnv: "STRIPE_PRICE_FAMILY_YEAR" },
  coach_month: { name: "ScholarTasks Study Coach add-on (monthly)", cents: 499, interval: "month", kind: "study_coach", priceEnv: "STRIPE_PRICE_COACH_MONTH" },
  coach_year: { name: "ScholarTasks Study Coach add-on (yearly)", cents: 3900, interval: "year", kind: "study_coach", priceEnv: "STRIPE_PRICE_COACH_YEAR" },
  pack_100: { name: "ScholarTasks 100 extra AI messages", cents: 299, interval: null, kind: "pack", credits: 100, priceEnv: "STRIPE_PRICE_PACK_100" },
};

/** Daily fair-use cap on tutor help for families with Study Coach (others get the normal 10). */
export const STUDY_COACH_DAILY_LIMIT = 30;

/** "$12.99", "$99" */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

/**
 * Off while ScholarTasks is in beta: paid features (like Study Coach's full
 * practice tests) are open to everyone. Turn on only after prices are set.
 */
export const PAYWALL_ON = false;

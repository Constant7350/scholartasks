import { createHmac, timingSafeEqual } from "node:crypto";

// One-click opt-out links for emails that aren't account emails (school invites).
// The link carries the address and a signature, so nobody can opt out someone else.
// Server only. Signs with UNSUBSCRIBE_SECRET, or CRON_SECRET if that isn't set.

const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";

export function unsubscribeToken(email: string): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(`optout:${email.trim().toLowerCase()}`).digest("base64url");
}

export function validUnsubscribe(email: string, token: string): boolean {
  const want = unsubscribeToken(email);
  if (!want || typeof token !== "string") return false;
  const a = Buffer.from(want), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The opt-out page link for this address, or null if signing isn't set up. */
export function unsubscribeUrl(appUrl: string, email: string): string | null {
  const t = unsubscribeToken(email);
  return t ? `${appUrl}/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${t}` : null;
}

/** Mailing address that must appear in invite emails (CAN-SPAM). Set MAILING_ADDRESS in Vercel. */
export const mailingAddress = () => process.env.MAILING_ADDRESS?.trim() || "";

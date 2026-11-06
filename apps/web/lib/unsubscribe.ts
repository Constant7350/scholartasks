import { createHmac, timingSafeEqual } from "node:crypto";

// One-click opt-out links for school invites and the weekly progress email.
// The link carries the address and a signature, so nobody can opt out someone else.
// Server only. Signs with UNSUBSCRIBE_SECRET, or CRON_SECRET if that isn't set.

const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";

/** Which emails a link stops: school invites (the default) or the weekly progress email. */
export type OptOutKind = "invites" | "progress";

export function unsubscribeToken(email: string, kind: OptOutKind = "invites"): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(`${kind === "progress" ? "progress" : "optout"}:${email.trim().toLowerCase()}`).digest("base64url");
}

export function validUnsubscribe(email: string, token: string, kind: OptOutKind = "invites"): boolean {
  const want = unsubscribeToken(email, kind);
  if (!want || typeof token !== "string") return false;
  const a = Buffer.from(want), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The opt-out page link for this address, or null if signing isn't set up. */
export function unsubscribeUrl(appUrl: string, email: string, kind: OptOutKind = "invites"): string | null {
  const t = unsubscribeToken(email, kind);
  return t ? `${appUrl}/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${t}${kind === "progress" ? "&k=progress" : ""}` : null;
}

/** Mailing address that must appear in invite emails (CAN-SPAM). Set MAILING_ADDRESS in Vercel. */
export const mailingAddress = () => process.env.MAILING_ADDRESS?.trim() || "";

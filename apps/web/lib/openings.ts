import { OPENING_KINDS, type OpeningKind } from "@scholartasks/core";
import { STATE_NAMES, TRADES } from "./trades";

export const SUPPORT_EMAIL = "support@scholartasks.com";
export const TRADE_SLUGS = TRADES.map((t) => t.slug);

/** One listing as students see it (the public_openings view). */
export interface PublicOpening {
  id: string; kind: OpeningKind; title: string; trade_slug: string | null; company_name: string; company_website: string | null;
  city: string; state: string; zip: string | null; min_age: number; pay: string | null; schedule: string | null;
  description: string; requirements: string | null; how_to_apply: string; apply_url: string | null;
  registered_apprenticeship: boolean; registered_verified: boolean; show_until: string; approved_at: string | null;
  featured: boolean;
}

/** One listing as our team sees it on /admin/openings. */
export interface TeamOpening extends Omit<PublicOpening, "featured"> {
  featured_until: string | null; views: number; apply_clicks: number;
  contact_name: string; contact_email: string; contact_phone: string | null; rapids_number: string | null;
  status: "pending" | "approved" | "rejected" | "hidden"; review_note: string | null; reports: number; created_at: string;
}

export const kindLabel = (k: OpeningKind) => OPENING_KINDS[k] ?? k;
export const tradeName = (slug: string | null) => (slug ? TRADES.find((t) => t.slug === slug)?.name ?? null : null);
export const place = (o: { city: string; state: string }) => `${o.city}, ${STATE_NAMES[o.state] ?? o.state}`;
export const ageLabel = (n: number) => (n >= 18 ? `${n} and older` : `Ages ${n} and up`);

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends one email through Resend. Returns false (and logs) when it fails or email isn't set up. */
export async function sendEmail(msg: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "ScholarTasks <noreply@scholartasks.com>", to: [msg.to], reply_to: msg.replyTo ?? SUPPORT_EMAIL, subject: msg.subject, html: msg.html }),
  }).catch(() => null);
  if (!res?.ok) console.error("openings: email failed", res?.status);
  return !!res?.ok;
}

/** Wraps an email body in the ScholarTasks look. */
export const emailShell = (title: string, body: string) => `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2a3a;line-height:1.5">
  <h2 style="color:#14305a;margin:0 0 12px">${esc(title)}</h2>${body}
  <p style="color:#5d6878;font-size:12px;margin-top:24px">ScholarTasks · scholartasks.com · Questions? Reply to this email.</p></div>`;

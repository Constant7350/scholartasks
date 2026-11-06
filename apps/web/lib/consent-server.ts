import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server helpers for signed consent (see migration 0055 and /api/consent/*).
// A parent proves it's really them right before signing: Face ID / fingerprint
// (a passkey on this device) or a 6-digit code sent to their own email.

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;

export const KINDS = ["job_application", "school_link", "school_agreement", "video", "challenge", "prize"] as const;
export type ConsentKind = (typeof KINDS)[number];

/** What each consent is called in the email receipt. */
export const KIND_TITLE: Record<ConsentKind, string> = {
  job_application: "a job application for your student",
  school_link: "connecting your student to their school",
  school_agreement: "your school's student data agreement",
  video: "your student appearing in ScholarTasks videos",
  challenge: "your student entering a ScholarTasks essay challenge",
  prize: "picking up your student's essay challenge prize",
};

export const hashCode = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");
export const newCode = () => String(randomInt(0, 1000000)).padStart(6, "0");

export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim().slice(0, 64) || null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sends one email through Resend. Returns false when it couldn't be sent. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "ScholarTasks <noreply@scholartasks.com>", to: [to], subject, html }),
  }).catch(() => null);
  return !!res?.ok;
}

export const codeEmail = (code: string) =>
  `<p>Your ScholarTasks signing code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
  `<p>It works for ${CODE_MINUTES} minutes. Type it on the screen where you are signing.</p>` +
  `<p style="color:#666">If you didn't ask for this, someone may be trying to sign in your name. Change your password and email support@scholartasks.com.</p>`;

export const receiptEmail = (kind: ConsentKind, name: string, wording: string, when: Date) =>
  `<p>You signed consent for ${esc(KIND_TITLE[kind])}.</p>` +
  `<p><b>Signed by:</b> ${esc(name)}<br><b>When:</b> ${esc(when.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }))} (Eastern)</p>` +
  `<p><b>What you agreed to:</b></p><blockquote style="border-left:3px solid #ddd;margin:0;padding:0 12px;color:#333">${esc(wording).replace(/\n/g, "<br>")}</blockquote>` +
  `<p><b>Wasn't you?</b> Email support@scholartasks.com right away and we will cancel it.</p>`;

/** Writes a line to the tamper-evident audit log (service role). */
export async function audit(admin: SupabaseClient, userId: string, action: string, kind: string, target: string | null, details: Record<string, unknown> = {}) {
  await admin.rpc("consent_audit", { p_user: userId, p_student: null, p_action: action, p_kind: kind, p_target: target, p_details: details });
}

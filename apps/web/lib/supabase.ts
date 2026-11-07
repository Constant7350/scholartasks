"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** "Remember me" on the sign-in page. "0" = forget the sign-in when the browser closes (shared computers). */
export const REMEMBER_KEY = "st-remember";
/** The email address saved by "Remember me", filled in next time. */
export const REMEMBER_EMAIL_KEY = "st-email";

export function rememberMe(): boolean {
  try { return localStorage.getItem(REMEMBER_KEY) !== "0"; } catch { return true; }
}

/**
 * Where the sign-in is kept: on the device (localStorage, the default) when "Remember me" is on,
 * or only for this browser window (sessionStorage) when it is off.
 */
const authStorage = {
  getItem(k: string) {
    try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch { return null; }
  },
  setItem(k: string, v: string) {
    try {
      const keep = rememberMe();
      (keep ? localStorage : sessionStorage).setItem(k, v);
      (keep ? sessionStorage : localStorage).removeItem(k);
    } catch { /* private mode: the sign-in lasts until the page closes */ }
  },
  removeItem(k: string) {
    try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* nothing saved */ }
  },
};

/** Returns the browser Supabase client, or null until the project's keys are configured. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { storage: typeof window === "undefined" ? undefined : authStorage } }) : null;
  return client;
}

/** Turns a database error into a message a parent can read. */
export function friendly(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (m.includes("student limit")) return "A family account can have up to 6 students. Big family? Email support@scholartasks.com and we'll add more at no charge.";
  if (m.includes("at least 13")) return "ScholarTasks is for students 13 and older, or 10 to 12 in grades 6 to 8.";
  if (m.includes("under 13")) return "Students get their own sign-in when they turn 13. Until then, use ScholarTasks with them from your account.";
  if (m.includes("invalid or expired")) return "That code is not valid or has expired. Ask your parent for a new one.";
  if (m.includes("already has an app account")) return "This child is already connected to the student app.";
  if (m.includes("not allowed")) return "You don't have access to do that.";
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again, or tap Forgot password.";
  if (/already registered|already exists/i.test(m)) return "You already have an account with this email. Sign in instead.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link we sent.";
  if (/password should be|weak password|at least \d+ characters/i.test(m)) return "Please choose a stronger password: at least 8 characters, mixing letters and numbers.";
  if (/same.*password|different from the old/i.test(m)) return "Please choose a password you haven't used before.";
  if (/unable to exchange external code|invalid_client|unauthorized_client/i.test(m)) return "Google sign-in isn't set up correctly yet (the Google client ID or secret doesn't match). Please use an email link for now.";
  if (/link is invalid or has expired|otp_expired/i.test(m)) return "That sign-in link has expired or was already used. Please ask for a new one.";
  if (/rate limit|too many/i.test(m)) return "Too many sign-in emails were sent in a short time. Please wait a few minutes and try again.";
  return m;
}

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Returns the browser Supabase client, or null until the project's keys are configured. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

/** Turns a database error into a message a parent can read. */
export function friendly(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (m.includes("at least 13")) return "ScholarTasks is for students 13 and older.";
  if (m.includes("invalid or expired")) return "That code is not valid or has expired. Ask your parent for a new one.";
  if (m.includes("already has an app account")) return "This child is already connected to the student app.";
  if (m.includes("not allowed")) return "You don't have access to do that.";
  if (/rate limit|too many/i.test(m)) return "Too many sign-in emails were sent in a short time. Please wait a few minutes and try again.";
  return m;
}

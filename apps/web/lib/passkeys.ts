import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server helpers for Face ID / fingerprint sign-in (passkeys).
 * Passkeys belong to one web address. They work on the address they were made
 * on (scholartasks.vercel.app now, scholartasks.com later), so set
 * PASSKEY_RP_ID=scholartasks.com once the domain is connected.
 */

export const RP_NAME = "ScholarTasks";

export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The site the request came from, checked against the address passkeys are tied to. */
export function relyingParty(req: Request): { rpID: string; origin: string } | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  let host: string;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  const rpID = process.env.PASSKEY_RP_ID || host;
  if (host !== rpID && !host.endsWith("." + rpID)) return null;
  // The browser must be on the same site this server answers for.
  const served = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (served && served.split(":")[0] !== host) return null;
  return { rpID, origin };
}

export async function userFromRequest(admin: SupabaseClient, req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

export async function saveChallenge(admin: SupabaseClient, kind: "register" | "login", challenge: string, userId: string | null) {
  await admin.from("passkey_challenges").delete().lt("expires_at", new Date().toISOString());
  const { data, error } = await admin.from("passkey_challenges").insert({ kind, challenge, user_id: userId }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Takes a challenge out of the table so it can only ever be used once. */
export async function useChallenge(admin: SupabaseClient, id: unknown, kind: "register" | "login") {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin.from("passkey_challenges").delete().eq("id", id).eq("kind", kind)
    .gt("expires_at", new Date().toISOString()).select("challenge, user_id").maybeSingle();
  return (data as { challenge: string; user_id: string | null } | null) ?? null;
}

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const toB64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

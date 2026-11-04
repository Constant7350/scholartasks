"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True inside the ScholarTasks phone app, which has its own Face ID lock. */
export const inPhoneApp = () => typeof navigator !== "undefined" && /ScholarTasksApp\//.test(navigator.userAgent);

/** True when this browser can use passkeys at all (the phone app uses its own Face ID lock instead). */
export const passkeysSupported = () => typeof window !== "undefined" && !inPhoneApp() && browserSupportsWebAuthn();

/** True when this phone or computer has Face ID, Touch ID, a fingerprint reader or Windows Hello. */
export async function hasBuiltInUnlock(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** A friendly name for this device, shown in the list of devices that can sign in. */
export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows computer";
  if (/CrOS/.test(ua)) return "Chromebook";
  return "This device";
}

/** What Face ID sign-in is called on this device. */
export function unlockName(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "Face ID";
  if (/Macintosh/.test(ua)) return "Touch ID";
  if (/Android/.test(ua)) return "fingerprint";
  if (/Windows/.test(ua)) return "Windows Hello";
  return "Face ID or fingerprint";
}

const cancelled = (e: unknown) => {
  const n = (e as { name?: string })?.name;
  return n === "NotAllowedError" || n === "AbortError";
};

async function post(path: string, body: unknown, token?: string) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
  return j;
}

/** Turns on Face ID / fingerprint sign-in for the signed-in person on this device. Returns false if they cancelled. */
export async function addPasskey(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const { options, challengeId } = await post("/api/passkeys/register-options", {}, token);
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (e) {
    if (cancelled(e)) return false;
    if ((e as { name?: string })?.name === "InvalidStateError") throw new Error("This device is already set up.");
    throw e;
  }
  await post("/api/passkeys/register", { challengeId, response, deviceName: deviceName() }, token);
  return true;
}

/** Signs in with Face ID / fingerprint. Returns false if the person cancelled. */
export async function signInWithPasskey(sb: SupabaseClient): Promise<boolean> {
  const { options, challengeId } = await post("/api/passkeys/login-options", {});
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (e) {
    if (cancelled(e)) return false;
    throw e;
  }
  const s = await post("/api/passkeys/login", { challengeId, response });
  const { error } = await sb.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) throw error;
  try { localStorage.setItem("st-passkey", "1"); } catch {}
  return true;
}
